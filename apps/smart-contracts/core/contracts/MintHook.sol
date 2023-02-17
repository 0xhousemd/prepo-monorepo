// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IHook.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/AllowedMsgSenders.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "prepo-shared-contracts/contracts/interfaces/IAccountList.sol";

contract MintHook is IHook, AccountListCaller, AllowedMsgSenders, SafeOwnable {
  function hook(
    address funder,
    address,
    uint256,
    uint256
  ) external virtual override onlyAllowedMsgSenders {
    require(_accountList.isIncluded(funder), "Minter not allowed");
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
}
