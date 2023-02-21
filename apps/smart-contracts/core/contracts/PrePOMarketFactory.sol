// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./LongShortToken.sol";
import "./PrePOMarket.sol";
import "./interfaces/ILongShortToken.sol";
import "./interfaces/IPrePOMarketFactory.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract PrePOMarketFactory is
  IPrePOMarketFactory,
  ReentrancyGuardUpgradeable,
  SafeAccessControlEnumerableUpgradeable
{
  mapping(address => bool) private _validCollateral;
  mapping(bytes32 => address) private _deployedMarkets;

  bytes32 public constant CREATE_MARKET_ROLE = keccak256("createMarket");
  bytes32 public constant SET_COLLATERAL_VALIDITY_ROLE =
    keccak256("setCollateralValidity");

  function initialize() public initializer {
    __SafeAccessControlEnumerable_init();
    __ReentrancyGuard_init();
  }

  function isValidCollateral(address collateral)
    external
    view
    override
    returns (bool)
  {
    return _validCollateral[collateral];
  }

  function getMarket(bytes32 longShortHash)
    external
    view
    override
    returns (IPrePOMarket)
  {
    return IPrePOMarket(_deployedMarkets[longShortHash]);
  }

  function createMarket(
    string memory tokenNameSuffix,
    string memory tokenSymbolSuffix,
    bytes32 longTokenSalt,
    bytes32 shortTokenSalt,
    address owner,
    address collateral,
    uint256 floorLongPayout,
    uint256 ceilingLongPayout,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 expiryTime
  ) external override onlyRole(CREATE_MARKET_ROLE) nonReentrant {
    require(_validCollateral[collateral], "Invalid collateral");

    (LongShortToken longToken, LongShortToken shortToken) = _createPairTokens(
      tokenNameSuffix,
      tokenSymbolSuffix,
      longTokenSalt,
      shortTokenSalt
    );
    bytes32 salt = keccak256(abi.encodePacked(longToken, shortToken));

    PrePOMarket newMarket = new PrePOMarket{salt: salt}(
      owner,
      collateral,
      ILongShortToken(address(longToken)),
      ILongShortToken(address(shortToken)),
      floorLongPayout,
      ceilingLongPayout,
      floorValuation,
      ceilingValuation,
      expiryTime
    );
    _deployedMarkets[salt] = address(newMarket);

    longToken.transferOwnership(address(newMarket));
    shortToken.transferOwnership(address(newMarket));
    emit MarketAdded(address(newMarket), salt);
  }

  function setCollateralValidity(address collateral, bool validity)
    external
    override
    onlyRole(SET_COLLATERAL_VALIDITY_ROLE)
  {
    _validCollateral[collateral] = validity;
    emit CollateralValidityChanged(collateral, validity);
  }

  function _createPairTokens(
    string memory tokenNameSuffix,
    string memory tokenSymbolSuffix,
    bytes32 longTokenSalt,
    bytes32 shortTokenSalt
  )
    internal
    returns (LongShortToken newLongToken, LongShortToken newShortToken)
  {
    string memory longTokenName = string(
      abi.encodePacked("LONG", " ", tokenNameSuffix)
    );
    string memory shortTokenName = string(
      abi.encodePacked("SHORT", " ", tokenNameSuffix)
    );
    string memory longTokenSymbol = string(
      abi.encodePacked("L", "_", tokenSymbolSuffix)
    );
    string memory shortTokenSymbol = string(
      abi.encodePacked("S", "_", tokenSymbolSuffix)
    );
    newLongToken = new LongShortToken{salt: longTokenSalt}(
      longTokenName,
      longTokenSymbol
    );
    newShortToken = new LongShortToken{salt: shortTokenSalt}(
      shortTokenName,
      shortTokenSymbol
    );
    return (newLongToken, newShortToken);
  }
}
