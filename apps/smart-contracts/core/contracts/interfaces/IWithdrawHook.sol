// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IHook.sol";

interface IWithdrawHook is IHook {
  event WithdrawalsAllowedChange(bool allowed);

  event GlobalPeriodLengthChange(uint256 period);

  event GlobalWithdrawLimitPerPeriodChange(uint256 limit);

  function setWithdrawalsAllowed(bool withdrawalsAllowed) external;

  function setGlobalPeriodLength(uint256 globalPeriodLength) external;

  function setGlobalWithdrawLimitPerPeriod(
    uint256 globalWithdrawLimitPerPeriod
  ) external;

  function withdrawalsAllowed() external view returns (bool);

  function getGlobalPeriodLength() external view returns (uint256);

  function getGlobalWithdrawLimitPerPeriod() external view returns (uint256);

  function getLastGlobalPeriodReset() external view returns (uint256);

  function getGlobalAmountWithdrawnThisPeriod()
    external
    view
    returns (uint256);
}
