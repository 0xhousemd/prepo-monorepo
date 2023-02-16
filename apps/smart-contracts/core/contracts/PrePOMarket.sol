// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ILongShortToken.sol";
import "./interfaces/IPrePOMarket.sol";
import "./interfaces/IHook.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract PrePOMarket is
  IPrePOMarket,
  ReentrancyGuard,
  SafeAccessControlEnumerable
{
  IHook private _mintHook;
  IHook private _redeemHook;

  IERC20 private immutable _collateral;
  ILongShortToken private immutable _longToken;
  ILongShortToken private immutable _shortToken;

  uint256 private immutable _floorLongPayout;
  uint256 private immutable _ceilingLongPayout;
  uint256 private _finalLongPayout;

  uint256 private immutable _floorValuation;
  uint256 private immutable _ceilingValuation;

  uint256 private _redemptionFee;

  uint256 private immutable _expiryTime;

  uint256 private constant MAX_PAYOUT = 1e18;
  uint256 private constant FEE_DENOMINATOR = 1000000;
  uint256 private constant FEE_LIMIT = 100000;

  bytes32 public constant SET_MINT_HOOK_ROLE = keccak256("setMintHook");
  bytes32 public constant SET_REDEEM_HOOK_ROLE = keccak256("setRedeemHook");
  bytes32 public constant SET_FINAL_LONG_PAYOUT_ROLE =
    keccak256("setFinalLongPayout");
  bytes32 public constant SET_REDEMPTION_FEE_ROLE =
    keccak256("setRedemptionFee");

  /**
   * Assumes `_collateral`, `_longToken`, and `_shortToken` are
   * valid, since they will be handled by the PrePOMarketFactory. The
   * treasury is initialized to governance due to stack limitations.
   *
   * Assumes that ownership of `_longToken` and `_shortToken` has been
   * transferred to this contract via `createMarket()` in
   * `PrePOMarketFactory.sol`.
   */
  constructor(
    address owner,
    address collateral,
    ILongShortToken longToken,
    ILongShortToken shortToken,
    uint256 floorLongPayout,
    uint256 ceilingLongPayout,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 expiryTime
  ) {
    require(ceilingLongPayout > floorLongPayout, "Ceiling must exceed floor");
    require(expiryTime > block.timestamp, "Invalid expiry");
    require(ceilingLongPayout <= MAX_PAYOUT, "Ceiling cannot exceed 1");

    _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(DEFAULT_ADMIN_ROLE, owner);

    _collateral = IERC20(collateral);
    _longToken = longToken;
    _shortToken = shortToken;

    _floorLongPayout = floorLongPayout;
    _ceilingLongPayout = ceilingLongPayout;
    _finalLongPayout = MAX_PAYOUT + 1;

    _floorValuation = floorValuation;
    _ceilingValuation = ceilingValuation;

    _expiryTime = expiryTime;

    emit MarketCreated(
      address(longToken),
      address(shortToken),
      floorLongPayout,
      ceilingLongPayout,
      floorValuation,
      ceilingValuation,
      expiryTime
    );
  }

  function mint(uint256 amount)
    external
    override
    nonReentrant
    returns (uint256)
  {
    require(_finalLongPayout > MAX_PAYOUT, "Market ended");
    require(
      _collateral.balanceOf(msg.sender) >= amount,
      "Insufficient collateral"
    );
    if (address(_mintHook) != address(0)) {
      _mintHook.hook(msg.sender, msg.sender, amount, amount);
    }
    _collateral.transferFrom(msg.sender, address(this), amount);
    _longToken.mint(msg.sender, amount);
    _shortToken.mint(msg.sender, amount);
    emit Mint(msg.sender, amount);
    return amount;
  }

  function redeem(
    uint256 longAmount,
    uint256 shortAmount,
    address recipient
  ) external override nonReentrant {
    require(
      _longToken.balanceOf(msg.sender) >= longAmount,
      "Insufficient long tokens"
    );
    require(
      _shortToken.balanceOf(msg.sender) >= shortAmount,
      "Insufficient short tokens"
    );
    uint256 collateralAmount;
    if (_finalLongPayout <= MAX_PAYOUT) {
      uint256 shortPayout = MAX_PAYOUT - _finalLongPayout;
      collateralAmount =
        (_finalLongPayout * longAmount + shortPayout * shortAmount) /
        MAX_PAYOUT;
    } else {
      require(longAmount == shortAmount, "Long and Short must be equal");
      collateralAmount = longAmount;
    }

    uint256 actualFee;
    uint256 expectedFee = (collateralAmount * _redemptionFee) /
      FEE_DENOMINATOR;
    if (_redemptionFee > 0) {
      require(expectedFee > 0, "fee = 0");
    } else {
      require(collateralAmount > 0, "amount = 0");
    }
    if (address(_redeemHook) != address(0)) {
      _collateral.approve(address(_redeemHook), expectedFee);
      uint256 collateralAllowanceBefore = _collateral.allowance(
        address(this),
        address(_redeemHook)
      );
      _redeemHook.hook(
        msg.sender,
        recipient,
        collateralAmount,
        collateralAmount - expectedFee
      );
      actualFee =
        collateralAllowanceBefore -
        _collateral.allowance(address(this), address(_redeemHook));
      _collateral.approve(address(_redeemHook), 0);
    } else {
      actualFee = 0;
    }

    _longToken.burnFrom(msg.sender, longAmount);
    _shortToken.burnFrom(msg.sender, shortAmount);
    uint256 collateralAfterFee = collateralAmount - actualFee;
    _collateral.transfer(recipient, collateralAfterFee);

    emit Redemption(msg.sender, recipient, collateralAfterFee, actualFee);
  }

  function setMintHook(IHook mintHook)
    external
    override
    onlyRole(SET_MINT_HOOK_ROLE)
  {
    _mintHook = mintHook;
    emit MintHookChange(address(_mintHook));
  }

  function setRedeemHook(IHook redeemHook)
    external
    override
    onlyRole(SET_REDEEM_HOOK_ROLE)
  {
    _redeemHook = redeemHook;
    emit RedeemHookChange(address(redeemHook));
  }

  function setFinalLongPayout(uint256 finalLongPayout)
    external
    override
    onlyRole(SET_FINAL_LONG_PAYOUT_ROLE)
  {
    require(
      finalLongPayout >= _floorLongPayout,
      "Payout cannot be below floor"
    );
    require(
      finalLongPayout <= _ceilingLongPayout,
      "Payout cannot exceed ceiling"
    );
    _finalLongPayout = finalLongPayout;
    emit FinalLongPayoutSet(finalLongPayout);
  }

  function setRedemptionFee(uint256 redemptionFee)
    external
    override
    onlyRole(SET_REDEMPTION_FEE_ROLE)
  {
    require(redemptionFee <= FEE_LIMIT, "Exceeds fee limit");
    _redemptionFee = redemptionFee;
    emit RedemptionFeeChange(redemptionFee);
  }

  function getMintHook() external view override returns (IHook) {
    return _mintHook;
  }

  function getRedeemHook() external view override returns (IHook) {
    return _redeemHook;
  }

  function getCollateral() external view override returns (IERC20) {
    return _collateral;
  }

  function getLongToken() external view override returns (ILongShortToken) {
    return _longToken;
  }

  function getShortToken() external view override returns (ILongShortToken) {
    return _shortToken;
  }

  function getFloorLongPayout() external view override returns (uint256) {
    return _floorLongPayout;
  }

  function getCeilingLongPayout() external view override returns (uint256) {
    return _ceilingLongPayout;
  }

  function getFinalLongPayout() external view override returns (uint256) {
    return _finalLongPayout;
  }

  function getFloorValuation() external view override returns (uint256) {
    return _floorValuation;
  }

  function getCeilingValuation() external view override returns (uint256) {
    return _ceilingValuation;
  }

  function getRedemptionFee() external view override returns (uint256) {
    return _redemptionFee;
  }

  function getExpiryTime() external view override returns (uint256) {
    return _expiryTime;
  }

  function getMaxPayout() external pure override returns (uint256) {
    return MAX_PAYOUT;
  }

  function getFeeDenominator() external pure override returns (uint256) {
    return FEE_DENOMINATOR;
  }

  function getFeeLimit() external pure override returns (uint256) {
    return FEE_LIMIT;
  }
}
