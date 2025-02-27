import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedExternalContractsNames =
  | 'USDC'
  | 'UNISWAP_SWAP_ROUTER'
  | 'UNISWAP_QUOTER'
  | 'BALANCER_QUOTER'

export const USDC_ADDRESS: ExternalContract = {
  mainnet: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  ropsten: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
}

export const UNISWAP_SWAP_ROUTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  mainnet: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
}

export const UNISWAP_QUOTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  mainnet: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
}

export const BALANCER_QUOTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xE39B5e3B6D74016b2F6A9673D7d7493B6DF549d5',
}

export const supportedExternalTokenContracts: SupportedContracts = {
  USDC: USDC_ADDRESS,
  UNISWAP_SWAP_ROUTER: UNISWAP_SWAP_ROUTER_ADDRESS,
  UNISWAP_QUOTER: UNISWAP_QUOTER_ADDRESS,
  BALANCER_QUOTER: BALANCER_QUOTER_ADDRESS,
}
