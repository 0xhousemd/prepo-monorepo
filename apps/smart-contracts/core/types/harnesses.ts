import { MockContract } from '@defi-wonderland/smock'
import {
  AccountList,
  Collateral,
  DepositHook,
  DepositRecord,
  ERC20,
  FixedUintValue,
  LongShortToken,
  MintHook,
  PrePOMarket,
  RedeemHook,
  TokenSender,
  WithdrawHook,
} from './generated'

export type ExtendedCollateral = Collateral & {
  depositHook?: DepositHook
  withdrawHook?: WithdrawHook
}

export type MockExtendedCollateral = MockContract<Collateral> & {
  depositHook?: MockContract<DepositHook>
  withdrawHook?: MockContract<WithdrawHook>
}

export type ExtendedMarket = PrePOMarket & {
  longToken?: ERC20
  shortToken?: ERC20
  hash?: string
  mintHook?: MintHook
  redeemHook?: RedeemHook
}

// No hash because smock PrePOMarkets are not created using factories
export type MockExtendedMarket = MockContract<PrePOMarket> & {
  longToken?: LongShortToken
  shortToken?: LongShortToken
  mintHook?: MockContract<MintHook>
  redeemHook?: MockContract<RedeemHook>
}

export type ExtendedDepositRecord = DepositRecord & {
  allowedMsgSenders?: AccountList
  bypasslist?: AccountList
}

export type MockExtendedDepositRecord = MockContract<DepositRecord> & {
  allowedMsgSenders?: MockContract<AccountList>
  bypasslist?: MockContract<AccountList>
}

export type ExtendedTokenSender = TokenSender & {
  allowedMsgSenders?: AccountList
  fixedPrice?: FixedUintValue
}

export type MockExtendedTokenSender = MockContract<TokenSender> & {
  allowedMsgSenders?: MockContract<AccountList>
  fixedPrice?: MockContract<FixedUintValue>
}
