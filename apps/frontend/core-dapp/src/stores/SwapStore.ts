import { makeError } from 'prepo-utils'
import { BigNumber, ethers } from 'ethers'
import { makeAutoObservable } from 'mobx'
import { RootStore } from './RootStore'
import { SLIPPAGE_MULTIPLIER } from '../lib/constants'
import { debounce } from '../utils/debounce'
import { UNISWAP_QUOTER_ADDRESS } from '../lib/external-contracts'
import QuoterABI from '../../abi/uniswapV3Quoter.abi.json'

export enum TradeType {
  EXACT_INPUT = 0,
  EXACT_OUTPUT = 1,
}

export type SwapExactInputParameters = {
  type: TradeType.EXACT_INPUT
  fromAmount: BigNumber
  toAmount: BigNumber
}

export type SwapExactOutputParameters = {
  type: TradeType.EXACT_OUTPUT
  fromAmount: BigNumber
  toAmount: BigNumber
}

export type SwapParameters = {
  fee: number
  type?: TradeType
  fromTokenAddress: string
  toTokenAddress: string
  onHash?: (hash: string) => unknown
} & (SwapExactInputParameters | SwapExactOutputParameters)

export type QuoteExactInputProps = {
  fromAddress: string
  toAddress: string
  amountBN: BigNumber
  fee: number
}

export type SwapResult = { success: boolean; error?: string }

const encodePath = (path: string[], fees: number[]): string => {
  const FEE_SIZE = 3
  if (path.length !== fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  let encoded = '0x'
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2)
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  return encoded.toLowerCase()
}

const getSlippage = (slippagePercentage: number): number => {
  const maxSlippage = 1 - slippagePercentage
  return maxSlippage * SLIPPAGE_MULTIPLIER
}

export class SwapStore {
  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async swap({
    fee,
    fromAmount,
    fromTokenAddress,
    onHash,
    toAmount,
    toTokenAddress,
    type = TradeType.EXACT_INPUT,
  }: SwapParameters): Promise<SwapResult> {
    const { advancedSettingsStore, web3Store } = this.root
    const { slippage } = advancedSettingsStore
    const { address } = web3Store
    if (address === undefined) throw new Error('Invalid request.')
    try {
      const slippageMultiplied = getSlippage(slippage)
      const tokens = [fromTokenAddress, toTokenAddress]
      const path = encodePath(tokens, new Array(tokens.length - 1).fill(fee))

      if (type === TradeType.EXACT_INPUT) {
        const amountOutMinimum = toAmount.mul(slippageMultiplied).div(SLIPPAGE_MULTIPLIER)

        const params = {
          path,
          recipient: address,
          amountIn: fromAmount,
          amountOutMinimum,
        }

        await this.root.uniswapRouterStore.exactInput([params], { onHash })
        return {
          success: true,
        }
      }

      // exactOutput
      const amountInMaximum = fromAmount.mul(SLIPPAGE_MULTIPLIER).div(slippageMultiplied)

      const params = {
        path,
        recipient: address,
        amountOut: toAmount,
        amountInMaximum,
      }

      await this.root.uniswapRouterStore.exactOutput([params], {
        onHash,
      })
      return { success: true }
    } catch (error) {
      return { error: makeError(error).message, success: false }
    }
  }

  quoteExactInput = debounce(
    async ({
      amountBN,
      fromAddress,
      toAddress,
      fee,
    }: QuoteExactInputProps): Promise<
      { cachedInAmount: BigNumber; output: BigNumber } | undefined
    > => {
      if (amountBN.eq(0)) return { cachedInAmount: amountBN, output: BigNumber.from(0) }

      const quoterContract = new ethers.Contract(
        UNISWAP_QUOTER_ADDRESS.mainnet ?? '', // all uniswap contracts has same address on all chains
        QuoterABI,
        this.root.web3Store.coreProvider
      )

      const cachedInAmount = amountBN // cache amount at time when check is fired
      const sqrtPriceLimitX96 = 0 // The price limit of the pool that cannot be exceeded by the swap
      try {
        const output = await quoterContract.callStatic.quoteExactInputSingle(
          fromAddress,
          toAddress,
          fee,
          amountBN,
          sqrtPriceLimitX96
        )

        return { cachedInAmount, output }
      } catch (e) {
        return undefined
      }
    },
    400
  )
}
