import { ExternalContract } from './contract.types'

export type SupportedMarketTokens = 'PREFAKESTOCK_LONG_TOKEN' | 'PREFAKESTOCK_SHORT_TOKEN'

export const PREFAKESTOCK_LONG_TOKEN: ExternalContract = {
  arbitrumOne: '0xc463E78ecE6ED599cF4443098902ee33817AbE8D',
}

export const PREFAKESTOCK_SHORT_TOKEN: ExternalContract = {
  arbitrumOne: '0xEd8690E944C4D405F92C1a38117C31440510210c',
}

type SupportedMarketTokensContract = {
  [key in SupportedMarketTokens]: ExternalContract
}

export const supportedMarketTokens: SupportedMarketTokensContract = {
  PREFAKESTOCK_LONG_TOKEN,
  PREFAKESTOCK_SHORT_TOKEN,
}
