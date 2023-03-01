import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarketPools = 'PREFAKESTOCK_LONG_POOL' | 'PREFAKESTOCK_SHORT_POOL'

export const PREFAKESTOCK_LONG_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x7785e7dadf530e6d1a62c98c3ca9be911bba679e',
}

export const PREFAKESTOCK_SHORT_POOL_ADDRESS: ExternalContract = {
  arbitrumOne: '0x378b98617107f0d702e76678f396bc6f1da00832',
}

export const supportedMarketPools: SupportedContracts = {
  PREFAKESTOCK_LONG_POOL: PREFAKESTOCK_LONG_POOL_ADDRESS,
  PREFAKESTOCK_SHORT_POOL: PREFAKESTOCK_SHORT_POOL_ADDRESS,
}
