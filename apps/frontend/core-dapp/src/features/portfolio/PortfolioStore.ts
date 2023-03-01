import { action, makeAutoObservable } from 'mobx'
import { supportedMarkets } from '../../lib/markets-contracts'
import { HistoricalEventsFilter } from '../../stores/graphs/CoreGraphStore'
import { RootStore } from '../../stores/RootStore'
import { Position as PositionFromGraph } from '../../types/user.types'
import {
  formatHistoricalEvent,
  KNOWN_HISTORY_EVENTS,
  KNOWN_HISTORY_EVENTS_MAP,
} from '../history/history-utils'
import { HistoryTransaction } from '../history/history.types'
import { PositionEntity } from '../../stores/entities/Position.entity'

export class PortfolioStore {
  selectedPosition?: Required<PositionEntity>

  constructor(public root: RootStore) {
    makeAutoObservable(this, {
      setSelectedPosition: action.bound,
    })
  }

  setSelectedPosition(position?: Required<PositionEntity>): void {
    this.selectedPosition = position
  }

  get historicalEvents(): HistoryTransaction[] | undefined {
    const { address, network } = this.root.web3Store
    if (!address) return []

    return formatHistoricalEvent(
      this.root.coreGraphStore.historicalEvents(this.historyFilter)?.historicalEvents,
      network.name
    )
  }

  get historyFilter(): HistoricalEventsFilter {
    const { address, network } = this.root.web3Store
    const {
      currentFilter: {
        selectedFilterTypes,
        selectedMarket,
        confirmedDateRange: { end, start },
      },
    } = this.root.filterStore

    // only query subgraph is all selected types are valid event
    const validatedTypes =
      selectedFilterTypes?.filter((key) => KNOWN_HISTORY_EVENTS_MAP[key] !== undefined) ?? []

    const types =
      !selectedFilterTypes || validatedTypes.length === 0
        ? Object.keys(KNOWN_HISTORY_EVENTS)
        : validatedTypes.map((key) => KNOWN_HISTORY_EVENTS_MAP[key])
    const marketAddressName =
      typeof selectedMarket === 'object' ? selectedMarket.address : undefined
    const marketMap = marketAddressName ? supportedMarkets[marketAddressName] : undefined
    const market = marketMap ? marketMap[network.name]?.toLocaleLowerCase() : undefined
    return {
      ownerAddress: address?.toLowerCase(),
      event_in: types,
      longShortToken_: market ? { market } : undefined,
      createdAtTimestamp_gte: start ? Math.floor(start.getTime() / 1000) : undefined,
      createdAtTimestamp_lte: end ? Math.floor(end.getTime() / 1000) : undefined,
    }
  }

  // all possible positions including those that user has 0 balance
  get allPositions(): PositionEntity[] {
    const { marketStore } = this.root
    const { markets } = marketStore

    const positions: PositionEntity[] = []
    Object.values(markets ?? {}).forEach((market) => {
      positions.push(new PositionEntity(this.root, market, 'long'))
      positions.push(new PositionEntity(this.root, market, 'short'))
    })

    return positions
  }

  // only positions where user has more than 0 balance
  get userPositions(): PositionEntity[] | undefined {
    let loading = false
    const positions = this.allPositions.filter((position) => {
      if (position.hasPosition === undefined) loading = true
      return position.hasPosition
    })

    return loading ? undefined : positions
  }

  get portfolioValue(): string | undefined {
    const { preCTTokenStore } = this.root
    if (
      this.tradingPositionsValue === undefined ||
      preCTTokenStore.tokenBalanceFormat === undefined
    )
      return undefined

    const tokenBalance = Number(preCTTokenStore.tokenBalanceFormat)
    const tradingPositionsAndBalance = Number(this.tradingPositionsValue) + tokenBalance

    if (Number.isNaN(tradingPositionsAndBalance)) return undefined

    return `${tradingPositionsAndBalance}`
  }

  get signerCostBasis(): PositionFromGraph[] | undefined {
    const { address } = this.root.web3Store
    if (!address) return []
    const output = this.root.coreGraphStore.positionsCostBasis(address)

    return output?.positions
  }

  get tradingPositionsValue(): number | undefined {
    if (this.userPositions === undefined) return undefined
    let valueSum = 0
    this.userPositions.forEach(({ totalValue }) => {
      valueSum += Number(totalValue ?? 0)
    })
    return valueSum
  }
}
