import { makeAutoObservable } from 'mobx'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { UniswapPoolEntity } from './UniswapPoolEntity'
import { Erc20Store } from './Erc20.entity'
import { MarketEntity } from './MarketEntity'
import { Direction } from '../../features/trade/TradeStore'
import { RootStore } from '../RootStore'
import { ERC20_UNITS, WEI_DENOMINATOR } from '../../lib/constants'

export class PositionEntity {
  constructor(private root: RootStore, public market: MarketEntity, public direction: Direction) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get id(): string {
    return `${this.market.urlId}_${this.direction}`
  }

  get costBasis(): number | undefined {
    const { signerCostBasis } = this.root.portfolioStore
    if (signerCostBasis === undefined) return undefined

    // find costBasis from subgraph tracked positions
    const position = signerCostBasis.find(
      ({ longShortToken }) => longShortToken.id === this.token.address?.toLowerCase()
    )

    return position?.costBasis ?? 0
  }

  get hasPosition(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    if (this.totalValueBN === undefined || this.totalValue === undefined) return undefined
    return this.totalValueBN.gt(0)
  }

  get pool(): UniswapPoolEntity {
    return this.market[`${this.direction}Pool`]
  }

  get price(): number | undefined {
    return this.market[`${this.direction}TokenPrice`]
  }

  get priceBN(): BigNumber | undefined {
    if (this.price === undefined) return undefined
    return parseUnits(`${this.price}`, ERC20_UNITS)
  }

  get token(): Erc20Store {
    return this.market[`${this.direction}Token`]
  }

  get totalValue(): string | undefined {
    if (this.totalValueBN === undefined) return undefined
    return this.token.formatUnits(this.totalValueBN)
  }

  get totalValueBN(): BigNumber | undefined {
    if (this.token.balanceOfSigner === undefined || this.priceBN === undefined) return undefined
    return this.token.balanceOfSigner.mul(this.priceBN).div(WEI_DENOMINATOR)
  }

  get totalPnl(): number | undefined {
    if (
      this.token.tokenBalanceFormat === undefined ||
      this.price === undefined ||
      this.costBasis === undefined
    )
      return undefined

    return +this.token.tokenBalanceFormat * (this.price - this.costBasis)
  }

  get positionGrowthPercentage(): number | undefined {
    if (this.totalValue === undefined || this.totalPnl === undefined) return undefined
    const capital = +this.totalValue - this.totalPnl
    if (capital === 0 || this.totalPnl === 0) return 0
    return this.totalPnl / capital
  }
}
