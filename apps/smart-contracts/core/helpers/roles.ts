import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as roleConstants from 'prepo-constants/src/roles'
import { utils } from 'prepo-hardhat'
import {
  ArbitrageBroker,
  Collateral,
  DepositHook,
  DepositRecord,
  ManagerWithdrawHook,
  PrePOMarket,
  PrePOMarketFactory,
  TokenSender,
  WithdrawHook,
} from '../types/generated'

const { batchGrantAndAcceptRoles } = utils

async function assignCollateralRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  collateral: Collateral | MockContract<Collateral>
): Promise<void> {
  await batchGrantAndAcceptRoles(collateral, rootAdmin, nominee, roleConstants.COLLATERAL_ROLES)
}

async function assignDepositRecordRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  await batchGrantAndAcceptRoles(
    depositRecord,
    rootAdmin,
    nominee,
    roleConstants.DEPOSIT_RECORD_ROLES
  )
}

async function assignDepositHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositHook: DepositHook | MockContract<DepositHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(depositHook, rootAdmin, nominee, roleConstants.DEPOSIT_HOOK_ROLES)
}

async function assignWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(
    withdrawHook,
    rootAdmin,
    nominee,
    roleConstants.WITHDRAW_HOOK_ROLES
  )
}

async function assignManagerWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  managerWithdrawHook: ManagerWithdrawHook | MockContract<ManagerWithdrawHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(
    managerWithdrawHook,
    rootAdmin,
    nominee,
    roleConstants.MANAGER_WITHDRAW_HOOK_ROLES
  )
}

async function assignTokenSenderRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  tokenSender: TokenSender | MockContract<TokenSender>
): Promise<void> {
  await batchGrantAndAcceptRoles(tokenSender, rootAdmin, nominee, roleConstants.TOKEN_SENDER_ROLES)
}

async function assignPrePOMarketFactoryRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  prePOMarketFactory: PrePOMarketFactory
): Promise<void> {
  await batchGrantAndAcceptRoles(
    prePOMarketFactory,
    rootAdmin,
    nominee,
    roleConstants.PREPO_MARKET_FACTORY_ROLES
  )
}

async function assignPrePOMarketRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  prePOMarket: PrePOMarket
): Promise<void> {
  await batchGrantAndAcceptRoles(prePOMarket, rootAdmin, nominee, roleConstants.PREPO_MARKET_ROLES)
}

async function assignArbitrageBrokerRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  arbitrageBroker: ArbitrageBroker
): Promise<void> {
  await batchGrantAndAcceptRoles(
    arbitrageBroker,
    rootAdmin,
    nominee,
    roleConstants.ARBITRAGE_BROKER_ROLES
  )
}

export const roleAssigners = {
  assignCollateralRoles,
  assignDepositRecordRoles,
  assignDepositHookRoles,
  assignWithdrawHookRoles,
  assignManagerWithdrawHookRoles,
  assignTokenSenderRoles,
  assignPrePOMarketFactoryRoles,
  assignPrePOMarketRoles,
  assignArbitrageBrokerRoles,
}
