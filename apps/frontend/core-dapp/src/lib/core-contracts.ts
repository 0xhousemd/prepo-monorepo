import { DYNAMIC_CONTRACT_ADDRESS } from 'prepo-stores'
import { ExternalContract } from './contract.types'

export type CoreTokenContractNames =
  | 'WETH'
  | 'WSTETH'
  | 'COLLATERAL'
  | 'PPO'
  | 'PPO_STAKING'
  | 'DEPOSIT_HOOK'
  | 'DEPOSIT_RECORD'
  | 'DEPOSIT_TRADE_HELPER'
  | 'TOKEN_SENDER'
  | 'WITHDRAW_HOOK'
  | 'DYNAMIC'

export type CoreContracts = {
  [key in CoreTokenContractNames]: ExternalContract
}

// wstETH
export const BASE_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x5979D7b546E38E414F7E9822514be443A4800529',
}

// WETH
export const WETH_ADDRESS: ExternalContract = {
  arbitrumOne: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
}

// preWstETH
export const COLLATERAL_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x67a5246e2DbbD51250b41128EA277674C65e8dee',
}

export const PPO_ADDRESS: ExternalContract = {
  arbitrumOne: '0xB40DBBb7931Cfef8Be73AEEC6c67d3809bD4600B',
}

export const PPO_STAKING_ADDRESS: ExternalContract = {
  arbitrumOne: 'Not yet deployed',
}

// preWstETH-DepositHook
export const DEPOSIT_HOOK_ADDRESS: ExternalContract = {
  arbitrumOne: '0x1Da0a54D7130DA06b7C41154A1ccBd98eEe9007E',
}

// preWstETH-DepositRecord
export const DEPOSIT_RECORD_ADDRESS: ExternalContract = {
  arbitrumOne: '0x641F6b46b0E694Ebc4631284B3b0020Cb577daC7',
}

// PPOTokenSender-WstETH
export const TOKEN_SENDER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xF6019b125580a3A06dd4eB023d5b03E063326c8A',
}

// preWstETH-WithdrawHook
export const WITHDRAW_HOOK_ADDRESS: ExternalContract = {
  arbitrumOne: '0x185b4eFC6D2Bf181142f1292A328C962926787c2',
}

export const DEPOSIT_TRADE_HELPER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xE33175Df39F739db937E62198b67263F9d2Dd1C0',
}

export const DYNAMIC_ADDRESS: ExternalContract = {
  arbitrumOne: DYNAMIC_CONTRACT_ADDRESS,
}

export const coreContracts: CoreContracts = {
  WSTETH: BASE_TOKEN_ADDRESS,
  WETH: WETH_ADDRESS,
  COLLATERAL: COLLATERAL_TOKEN_ADDRESS,
  PPO: PPO_ADDRESS,
  PPO_STAKING: PPO_STAKING_ADDRESS,
  DEPOSIT_HOOK: DEPOSIT_HOOK_ADDRESS,
  DEPOSIT_RECORD: DEPOSIT_RECORD_ADDRESS,
  DEPOSIT_TRADE_HELPER: DEPOSIT_TRADE_HELPER_ADDRESS,
  TOKEN_SENDER: TOKEN_SENDER_ADDRESS,
  WITHDRAW_HOOK: WITHDRAW_HOOK_ADDRESS,
  DYNAMIC: DYNAMIC_ADDRESS,
}
