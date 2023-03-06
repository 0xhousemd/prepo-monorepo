import { ZERO_ADDRESS } from 'prepo-constants'
import { ExternalContract } from './contract.types'

export type CoreTokenContractNames =
  | 'WSTETH'
  | 'preCT'
  | 'PPO'
  | 'PPO_STAKING'
  | 'DEPOSIT_RECORD'
  | 'DEPOSIT_TRADE_HELPER'
  | 'TOKEN_SENDER'
  | 'WITHDRAW_HOOK'

export type CoreContracts = {
  [key in CoreTokenContractNames]: ExternalContract
}

// wstETH
export const BASE_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x5979D7b546E38E414F7E9822514be443A4800529',
}

export const COLLATERAL_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0xF7a34B67c01862fBf0FB72944a3473AAB8552cDE',
}

export const PPO_ADDRESS: ExternalContract = {
  arbitrumOne: '0xB40DBBb7931Cfef8Be73AEEC6c67d3809bD4600B',
}

export const PPO_STAKING_ADDRESS: ExternalContract = {
  arbitrumOne: 'Not yet deployed',
}

export const DEPOSIT_RECORD_ADDRESS: ExternalContract = {
  arbitrumOne: '0xEe9e151C51758531FA2A9C550eFEB4c77845988d',
}

export const TOKEN_SENDER_ADDRESS: ExternalContract = {
  arbitrumOne: '0x239EDBe7be361955b6fd20d36F036623594C9365',
}

export const WITHDRAW_HOOK_ADDRESS: ExternalContract = {
  arbitrumOne: '0x829E6c99445C012A536A95E2993Eb7A055D1269d',
}

export const DEPOSIT_TRADE_HELPER_ADDRESS: ExternalContract = {
  // TODO: update to actual contract address, not ready on arbitrum yet
  arbitrumOne: ZERO_ADDRESS,
}

export const coreContracts: CoreContracts = {
  WSTETH: BASE_TOKEN_ADDRESS,
  preCT: COLLATERAL_TOKEN_ADDRESS,
  PPO: PPO_ADDRESS,
  PPO_STAKING: PPO_STAKING_ADDRESS,
  DEPOSIT_RECORD: DEPOSIT_RECORD_ADDRESS,
  DEPOSIT_TRADE_HELPER: DEPOSIT_TRADE_HELPER_ADDRESS,
  TOKEN_SENDER: TOKEN_SENDER_ADDRESS,
  WITHDRAW_HOOK: WITHDRAW_HOOK_ADDRESS,
}
