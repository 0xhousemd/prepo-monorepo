import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from './RootStore'
import { TokenSenderAbi, TokenSenderAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'

type GetScaledPrice = TokenSenderAbi['functions']['getScaledPrice']
type GetScaledPriceLowerBound = TokenSenderAbi['functions']['getScaledPriceLowerBound']
export class TokenSenderStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(rootStore: RootStore) {
    super(rootStore, 'TOKEN_SENDER', TokenSenderAbi__factory as unknown as Factory)
  }

  private getScaledPrice(...params: Parameters<GetScaledPrice>): ContractReturn<GetScaledPrice> {
    return this.call<GetScaledPrice>('getScaledPrice', params)
  }

  private getScaledPriceLowerBound(
    ...params: Parameters<GetScaledPriceLowerBound>
  ): ContractReturn<GetScaledPriceLowerBound> {
    return this.call<GetScaledPriceLowerBound>('getScaledPriceLowerBound', params)
  }

  private get scaledPrice(): BigNumber | undefined {
    const scaledPrice = this.getScaledPrice()?.[0]
    const scaledPriceLowerBound = this.getScaledPriceLowerBound()?.[0]

    if (scaledPrice === undefined || scaledPriceLowerBound === undefined) return undefined

    return scaledPrice.lte(scaledPriceLowerBound) ? BigNumber.from(0) : scaledPrice
  }

  calculateReward(feeInEth: BigNumber): BigNumber | undefined {
    const { scaledPrice } = this
    const { decimalsNumber: ppoDecimals } = this.root.ppoTokenStore

    if (ppoDecimals === undefined || scaledPrice === undefined) return undefined
    if (scaledPrice.eq(0)) return scaledPrice

    return feeInEth.mul(BigNumber.from(10).pow(ppoDecimals)).div(scaledPrice)
  }
}
