// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IHook.sol";
import "./interfaces/IPrePOMarket.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/AllowedMsgSenders.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "prepo-shared-contracts/contracts/TokenSenderCaller.sol";
import "prepo-shared-contracts/contracts/TreasuryCaller.sol";

contract RedeemHook is
  IHook,
  AccountListCaller,
  AllowedMsgSenders,
  SafeOwnable,
  TokenSenderCaller,
  TreasuryCaller
{
  function hook(
    address funder,
    address recipient,
    uint256 amountBeforeFee,
    uint256 amountAfterFee
  ) external virtual override onlyAllowedMsgSenders {
    require(_accountList.isIncluded(funder), "Redeemer not allowed");
    uint256 fee = amountBeforeFee - amountAfterFee;
    if (fee > 0) {
      IPrePOMarket(msg.sender).getCollateral().transferFrom(
        msg.sender,
        _treasury,
        fee
      );
      _tokenSender.send(recipient, fee);
    }
  }

  function setAllowedMsgSenders(IAccountList allowedMsgSenders)
    public
    virtual
    override
    onlyOwner
  {
    super.setAllowedMsgSenders(allowedMsgSenders);
  }

  function setAccountList(IAccountList accountList)
    public
    virtual
    override
    onlyOwner
  {
    super.setAccountList(accountList);
  }

  function setTreasury(address _treasury) public override onlyOwner {
    super.setTreasury(_treasury);
  }

  function setTokenSender(ITokenSender tokenSender) public override onlyOwner {
    super.setTokenSender(tokenSender);
  }
}
