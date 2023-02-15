import { id } from 'ethers/lib/utils'

export const COLLATERAL_ROLES = [
  id('managerWithdraw'),
  id('setManager'),
  id('setDepositFee'),
  id('setWithdrawFee'),
  id('setDepositHook'),
  id('setWithdrawHook'),
  id('setManagerWithdrawHook'),
]

export const DEPOSIT_RECORD_ROLES = [
  id('setUserDepositCap'),
  id('setGlobalNetDepositCap'),
  id('setAllowedMsgSenders'),
  id('setAccountList')
]

export const DEPOSIT_HOOK_ROLES = [
  id('setCollateral'),
  id('setDepositRecord'),
  id('setDepositsAllowed'),
  id('setAccountList'),
  id('setRequiredScore'),
  id('setCollectionScores'),
  id('removeCollections'),
  id('setTreasury'),
  id('setTokenSender'),
]

export const WITHDRAW_HOOK_ROLES = [
  id('setCollateral'),
  id('setDepositRecord'),
  id('setWithdrawalsAllowed'),
  id('setGlobalPeriodLength'),
  id('setUserPeriodLength'),
  id('setGlobalWithdrawLimitPerPeriod'),
  id('setUserWithdrawLimitPerPeriod'),
  id('setTreasury'),
  id('setTokenSender')
]

export const MANAGER_WITHDRAW_HOOK_ROLES = [
  id('setCollateral'),
  id('setDepositRecord'),
  id('setMinReservePercentage'),
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
