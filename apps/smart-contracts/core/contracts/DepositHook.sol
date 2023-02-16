// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IDepositHook.sol";
import "./AllowedCollateralCaller.sol";
import "./DepositRecordCaller.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/NFTScoreRequirement.sol";
import "prepo-shared-contracts/contracts/TokenSenderCaller.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DepositHook is
  IDepositHook,
  AccountListCaller,
  AllowedCollateralCaller,
  DepositRecordCaller,
  NFTScoreRequirement,
  TokenSenderCaller,
  SafeAccessControlEnumerable
{
  bool private _depositsAllowed;

  bytes32 public constant SET_COLLATERAL_ROLE = keccak256("setCollateral");
  bytes32 public constant SET_DEPOSIT_RECORD_ROLE =
    keccak256("setDepositRecord");
  bytes32 public constant SET_DEPOSITS_ALLOWED_ROLE =
    keccak256("setDepositsAllowed");
  bytes32 public constant SET_ACCOUNT_LIST_ROLE = keccak256("setAccountList");
  bytes32 public constant SET_REQUIRED_SCORE_ROLE =
    keccak256("setRequiredScore");
  bytes32 public constant SET_COLLECTION_SCORES_ROLE =
    keccak256("setCollectionScores");
  bytes32 public constant REMOVE_COLLECTIONS_ROLE =
    keccak256("removeCollections");
  bytes32 public constant SET_TREASURY_ROLE = keccak256("setTreasury");
  bytes32 public constant SET_TOKEN_SENDER_ROLE = keccak256("setTokenSender");

  function hook(
    address funder,
    address recipient,
    uint256 amountBeforeFee,
    uint256 amountAfterFee
  ) external override onlyCollateral {
    require(_depositsAllowed, "Deposits not allowed");
    if (!_accountList.isIncluded(recipient)) {
      require(_satisfiesScoreRequirement(recipient), "Depositor not allowed");
    }
    _depositRecord.recordDeposit(recipient, amountAfterFee);
    uint256 fee = amountBeforeFee - amountAfterFee;
    if (fee > 0) {
      _collateral.getBaseToken().transferFrom(
        address(_collateral),
        _treasury,
        fee
      );
      _tokenSender.send(recipient, fee);
    }
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

  function setDepositsAllowed(bool depositsAllowed)
    external
    override
    onlyRole(SET_DEPOSITS_ALLOWED_ROLE)
  {
    _depositsAllowed = depositsAllowed;
    emit DepositsAllowedChange(depositsAllowed);
  }

  function setAccountList(IAccountList accountList)
    public
    override
    onlyRole(SET_ACCOUNT_LIST_ROLE)
  {
    super.setAccountList(accountList);
  }

  function setRequiredScore(uint256 requiredScore)
    public
    override
    onlyRole(SET_REQUIRED_SCORE_ROLE)
  {
    super.setRequiredScore(requiredScore);
  }

  function setCollectionScores(
    IERC721[] memory collections,
    uint256[] memory scores
  ) public override onlyRole(SET_COLLECTION_SCORES_ROLE) {
    super.setCollectionScores(collections, scores);
  }

  function removeCollections(IERC721[] memory collections)
    public
    override
    onlyRole(REMOVE_COLLECTIONS_ROLE)
  {
    super.removeCollections(collections);
  }

  function setTreasury(address treasury)
    public
    override
    onlyRole(SET_TREASURY_ROLE)
  {
    super.setTreasury(treasury);
  }

  function setTokenSender(ITokenSender tokenSender)
    public
    override
    onlyRole(SET_TOKEN_SENDER_ROLE)
  {
    super.setTokenSender(tokenSender);
  }

  function depositsAllowed() external view override returns (bool) {
    return _depositsAllowed;
  }
}
