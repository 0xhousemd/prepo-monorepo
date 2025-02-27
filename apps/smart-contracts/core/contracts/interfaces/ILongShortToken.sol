// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILongShortToken is IERC20 {
  function owner() external returns (address);

  function mint(address recipient, uint256 amount) external;

  function burnFrom(address account, uint256 amount) external;
}
