import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { utils } from 'prepo-hardhat'
import {
  Collateral,
  DepositHook,
  DepositRecord,
  ManagerWithdrawHook,
  TokenSender,
  WithdrawHook,
} from '../types/generated'

const { batchGrantAndAcceptRoles } = utils

export async function assignCollateralRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  collateral: Collateral | MockContract<Collateral>
): Promise<void> {
  await batchGrantAndAcceptRoles(collateral, rootAdmin, nominee, [
    collateral.MANAGER_WITHDRAW_ROLE(),
    collateral.SET_MANAGER_ROLE(),
    collateral.SET_DEPOSIT_FEE_ROLE(),
    collateral.SET_WITHDRAW_FEE_ROLE(),
    collateral.SET_DEPOSIT_HOOK_ROLE(),
    collateral.SET_WITHDRAW_HOOK_ROLE(),
    collateral.SET_MANAGER_WITHDRAW_HOOK_ROLE(),
  ])
}

export async function assignDepositRecordRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  await batchGrantAndAcceptRoles(this.depositRecord, rootAdmin, nominee, [
    depositRecord.SET_ALLOWED_HOOK_ROLE(),
    depositRecord.SET_USER_DEPOSIT_CAP_ROLE(),
    depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE(),
  ])
}

export async function assignDepositHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositHook: DepositHook | MockContract<DepositHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(this.collateral.depositHook, rootAdmin, nominee, [
    depositHook.SET_COLLATERAL_ROLE(),
    depositHook.SET_DEPOSIT_RECORD_ROLE(),
    depositHook.SET_DEPOSITS_ALLOWED_ROLE(),
    depositHook.SET_ACCOUNT_LIST_ROLE(),
    depositHook.SET_REQUIRED_SCORE_ROLE(),
    depositHook.SET_COLLECTION_SCORES_ROLE(),
    depositHook.REMOVE_COLLECTIONS_ROLE(),
    depositHook.SET_TREASURY_ROLE(),
    depositHook.SET_TOKEN_SENDER_ROLE(),
  ])
}

export async function assignWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(this.collateral.withdrawHook, rootAdmin, nominee, [
    withdrawHook.SET_COLLATERAL_ROLE(),
    withdrawHook.SET_DEPOSIT_RECORD_ROLE(),
    withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE(),
    withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE(),
    withdrawHook.SET_USER_PERIOD_LENGTH_ROLE(),
    withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
    withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
    withdrawHook.SET_TREASURY_ROLE(),
    withdrawHook.SET_TOKEN_SENDER_ROLE(),
  ])
}

export async function assignManagerWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  managerWithdrawHook: ManagerWithdrawHook | MockContract<ManagerWithdrawHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(this.collateral.managerWithdrawHook, rootAdmin, nominee, [
    managerWithdrawHook.SET_COLLATERAL_ROLE(),
    managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE(),
    managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE(),
  ])
}

export async function assignTokenSenderRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  tokenSender: TokenSender | MockContract<TokenSender>
): Promise<void> {
  await batchGrantAndAcceptRoles(this.tokenSender, rootAdmin, nominee, [
    tokenSender.SET_PRICE_ROLE(),
    tokenSender.SET_PRICE_MULTIPLIER_ROLE(),
    tokenSender.SET_SCALED_PRICE_LOWER_BOUND_ROLE(),
    tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE(),
    tokenSender.WITHDRAW_ERC20_ROLE(),
  ])
}
