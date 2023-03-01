import { id } from 'ethers/lib/utils'

export const COLLATERAL_ROLES = [
  id('setDepositFee'),
  id('setWithdrawFee'),
  id('setDepositHook'),
  id('setWithdrawHook'),
]

export const DEPOSIT_RECORD_ROLES = [
  id('setUserDepositCap'),
  id('setGlobalNetDepositCap'),
  id('setAllowedMsgSenders'),
  id('setAccountList'),
]

export const DEPOSIT_HOOK_ROLES = [
  id('setCollateral'),
  id('setDepositRecord'),
  id('setDepositsAllowed'),
  id('setTreasury'),
  id('setTokenSender'),
]

export const WITHDRAW_HOOK_ROLES = [
  id('setCollateral'),
  id('setDepositRecord'),
  id('setGlobalPeriodLength'),
  id('setUserPeriodLength'),
  id('setGlobalWithdrawLimitPerPeriod'),
  id('setUserWithdrawLimitPerPeriod'),
  id('setTreasury'),
  id('setTokenSender'),
]

export const TOKEN_SENDER_ROLES = [
  id('setPrice'),
  id('setPriceMultiplier'),
  id('setScaledPriceLowerBound'),
  id('setAllowedMsgSenders'),
  id('withdrawERC20'),
]

export const PREPO_MARKET_FACTORY_ROLES = [id('createMarket'), id('setCollateralValidity')]

export const PREPO_MARKET_ROLES = [
  id('setMintHook'),
  id('setRedeemHook'),
  id('setFinalLongPayout'),
  id('setRedemptionFee'),
]

export const ARBITRAGE_BROKER_ROLES = [
  id('buyAndRedeem'),
  id('mintAndSell'),
  id('setMarketValidity'),
]
