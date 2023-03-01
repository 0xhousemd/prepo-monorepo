import { Market, SupportedMarketID } from '../types/market.types'

export const fakestock: Market = {
  address: 'PREFAKESTOCK_MARKET_ADDRESS',
  iconName: 'prefakestock',
  name: 'Fake Stock',
  type: 'preIPO',
  companyName: 'Fake Stock',
  urlId: 'fakestock',
  long: {
    tokenAddress: 'PREFAKESTOCK_LONG_TOKEN',
    poolAddress: 'PREFAKESTOCK_LONG_POOL',
  },
  short: {
    tokenAddress: 'PREFAKESTOCK_SHORT_TOKEN',
    poolAddress: 'PREFAKESTOCK_SHORT_POOL',
  },
  static: {
    valuationRange: [15000000000, 45000000000],
  },
}

export const markets: Market[] = []
export const marketsMap: { [key in SupportedMarketID]: Market } = {
  fakestock,
}
