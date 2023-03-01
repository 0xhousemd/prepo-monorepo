import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarkets = 'PREFAKESTOCK_MARKET_ADDRESS'

export const PREFAKESTOCK_MARKET_ADDRESS: ExternalContract = {
  arbitrumOne: '0x4F290AbCeC143F15d3dBbb3f9065e3715d6B9193',
}

export const supportedMarkets: SupportedContracts = {
  PREFAKESTOCK_MARKET_ADDRESS,
}
