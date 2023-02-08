// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IHook.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

interface ICollateral is IERC20Upgradeable, IERC20PermitUpgradeable {
  event Deposit(
    address indexed depositor,
    uint256 amountAfterFee,
    uint256 fee
  );

  event Withdraw(
    address indexed withdrawer,
    address indexed recipient,
    uint256 amountAfterFee,
    uint256 fee
  );

  event ManagerChange(address manager);

  event DepositFeeChange(uint256 fee);

  event WithdrawFeeChange(uint256 fee);

  event DepositHookChange(address hook);

  event WithdrawHookChange(address hook);

  event ManagerWithdrawHookChange(address hook);

  function deposit(address recipient, uint256 amount)
    external
    returns (uint256);

  function withdraw(address recipient, uint256 amount) external;

  function managerWithdraw(uint256 amount) external;

  function setManager(address newManager) external;

  function setDepositFee(uint256 newDepositFee) external;

  function setWithdrawFee(uint256 newWithdrawFee) external;

  function setDepositHook(IHook newHook) external;

  function setWithdrawHook(IHook newHook) external;

  function setManagerWithdrawHook(IHook newHook) external;

  function getBaseToken() external view returns (IERC20);

  function getManager() external view returns (address);

  function getDepositFee() external view returns (uint256);

  function getWithdrawFee() external view returns (uint256);

  function getDepositHook() external view returns (IHook);

  function getWithdrawHook() external view returns (IHook);

  function getManagerWithdrawHook() external view returns (IHook);

  function getReserve() external view returns (uint256);
}
