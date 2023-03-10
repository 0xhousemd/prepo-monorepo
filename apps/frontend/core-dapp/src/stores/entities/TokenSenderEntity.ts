import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from '../RootStore'
import { TokenSenderAbi, TokenSenderAbi__factory } from '../../../generated/typechain'
import { SupportedContracts } from '../../lib/contract.types'

type GetPriceMultiplier = TokenSenderAbi['functions']['getPriceMultiplier']
type GetMultiplierDenominator = TokenSenderAbi['functions']['MULTIPLIER_DENOMINATOR']
type GetScaledPrice = TokenSenderAbi['functions']['getScaledPrice']
type GetScaledPriceLowerBound = TokenSenderAbi['functions']['getScaledPriceLowerBound']

export class TokenSenderEntity extends ContractStore<RootStore, SupportedContracts> {
  constructor(rootStore: RootStore, address: string) {
    super(rootStore, 'DYNAMIC', TokenSenderAbi__factory as unknown as Factory)
    this.updateAddress(address)
  }

  private getScaledPrice(...params: Parameters<GetScaledPrice>): ContractReturn<GetScaledPrice> {
    return this.call<GetScaledPrice>('getScaledPrice', params)
  }

  private getScaledPriceLowerBound(
    ...params: Parameters<GetScaledPriceLowerBound>
  ): ContractReturn<GetScaledPriceLowerBound> {
    return this.call<GetScaledPriceLowerBound>('getScaledPriceLowerBound', params)
  }

  private getPriceMultiplier(): ContractReturn<GetPriceMultiplier> {
    return this.call<GetPriceMultiplier>('getPriceMultiplier', [])
  }

  private getMultiplierDenominator(): ContractReturn<GetMultiplierDenominator> {
    return this.call<GetMultiplierDenominator>('MULTIPLIER_DENOMINATOR', [])
  }

  private get multiplierDenominator(): BigNumber | undefined {
    return this.getMultiplierDenominator()?.[0]
  }

  private get scaledPrice(): BigNumber | undefined {
    const scaledPrice = this.getScaledPrice()?.[0]
    const scaledPriceLowerBound = this.getScaledPriceLowerBound()?.[0]

    if (scaledPrice === undefined || scaledPriceLowerBound === undefined) return undefined

    return scaledPrice.lte(scaledPriceLowerBound) ? BigNumber.from(0) : scaledPrice
  }

  get priceBN(): BigNumber | undefined {
    if (
      this.priceMultiplier === undefined ||
      this.scaledPrice === undefined ||
      this.multiplierDenominator === undefined
    )
      return undefined
    return this.scaledPrice.mul(this.multiplierDenominator).div(this.priceMultiplier)
  }

  get priceMultiplier(): BigNumber | undefined {
    return this.getPriceMultiplier()?.[0]
  }

  calculateReward(feeInEth: BigNumber): BigNumber | undefined {
    const { ppoBalance, scaledPrice } = this
    const { decimalsNumber: ppoDecimals } = this.root.ppoTokenStore

    if (ppoDecimals === undefined || scaledPrice === undefined || ppoBalance === undefined)
      return undefined
    if (scaledPrice.eq(0)) return scaledPrice

    const reward = feeInEth.mul(BigNumber.from(10).pow(ppoDecimals)).div(scaledPrice)

    if (reward.gt(ppoBalance)) {
      return BigNumber.from(0)
    }

    return reward
  }

  calculateRewardValue(ppo?: string): number | undefined {
    if (this.priceBN === undefined || ppo === undefined) return undefined
    const price = this.root.ppoTokenStore.formatUnits(this.priceBN)
    if (price === undefined) return undefined
    return +ppo * +price
  }

  private get ppoBalance(): BigNumber | undefined {
    const { address } = this
    if (address === undefined) return undefined
    return this.root.ppoTokenStore.balanceOf(address)?.[0]
  }
}
