// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./IPrePOMarket.sol";

interface IPrePOMarketFactory {
  event CollateralValidityChanged(address collateral, bool allowed);

  event MarketAdded(address market, bytes32 longShortHash);

  function createMarket(
    string memory tokenNameSuffix,
    string memory tokenSymbolSuffix,
    bytes32 longTokenSalt,
    bytes32 shortTokenSalt,
    address collateral,
    address governance,
    uint256 floorLongPayout,
    uint256 ceilingLongPayout,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 expiryTime
  ) external;

  function setCollateralValidity(address collateral, bool validity) external;

  function isValidCollateral(address collateral) external view returns (bool);

  function getMarket(bytes32 longShortHash)
    external
    view
    returns (IPrePOMarket);

  function CREATE_MARKET_ROLE() external view returns (bytes32);

  function SET_COLLATERAL_VALIDITY_ROLE() external view returns (bytes32);
}
