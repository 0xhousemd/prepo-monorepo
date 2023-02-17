// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./AllowedCollateralCaller.sol";
import "./DepositRecordCaller.sol";
import "./interfaces/IManagerWithdrawHook.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract ManagerWithdrawHook is
  IManagerWithdrawHook,
  AllowedCollateralCaller,
  DepositRecordCaller,
  SafeAccessControlEnumerable
{
  uint256 private _minReservePercentage;

  uint256 public constant PERCENT_DENOMINATOR = 1000000;
  bytes32 public constant SET_COLLATERAL_ROLE = keccak256("setCollateral");
  bytes32 public constant SET_DEPOSIT_RECORD_ROLE =
    keccak256("setDepositRecord");
  bytes32 public constant SET_MIN_RESERVE_PERCENTAGE_ROLE =
    keccak256("setMinReservePercentage");

  function hook(
    address,
    address,
    uint256,
    uint256 amountAfterFee
  ) external view override {
    require(
      _collateral.getReserve() - amountAfterFee >= getMinReserve(),
      "Falls below min reserve"
    );
  }

  function setCollateral(ICollateral collateral)
    public
    override
    onlyRole(SET_COLLATERAL_ROLE)
  {
    super.setCollateral(collateral);
  }

  function setDepositRecord(IDepositRecord depositRecord)
    public
    override
    onlyRole(SET_DEPOSIT_RECORD_ROLE)
  {
    super.setDepositRecord(depositRecord);
  }

  function setMinReservePercentage(uint256 minReservePercentage)
    external
    override
    onlyRole(SET_MIN_RESERVE_PERCENTAGE_ROLE)
  {
    require(minReservePercentage <= PERCENT_DENOMINATOR, ">100%");
    _minReservePercentage = minReservePercentage;
    emit MinReservePercentageChange(minReservePercentage);
  }

  function getMinReservePercentage() external view override returns (uint256) {
    return _minReservePercentage;
  }

  function getMinReserve() public view override returns (uint256) {
    return
      (_depositRecord.getGlobalNetDepositAmount() * _minReservePercentage) /
      PERCENT_DENOMINATOR;
  }
}
