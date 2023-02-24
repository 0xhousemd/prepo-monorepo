// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../interfaces/IHook.sol";
import "../interfaces/IPrePOMarket.sol";

/// @notice this contract is a test contract made to test a use case where the redeem hook only takes a part of the fee
contract TestRedeemHook is IHook {
  address public treasury = address(5);

  function hook(
    address,
    address recipient,
    uint256 amountBeforeFee,
    uint256 amountAfterFee
  ) external virtual override {
    uint256 fee = ((amountBeforeFee - amountAfterFee) * 5) / 10;
    IPrePOMarket(msg.sender).getCollateral().transferFrom(
      msg.sender,
      treasury,
      fee
    );
  }
}
