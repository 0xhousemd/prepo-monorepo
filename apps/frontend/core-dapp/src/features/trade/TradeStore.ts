import { BigNumber } from 'ethers'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { Erc20Store } from '../../stores/entities/Erc20.entity'
import { MarketEntity } from '../../stores/entities/MarketEntity'
import { PositionEntity } from '../../stores/entities/Position.entity'
import { RootStore } from '../../stores/RootStore'
import { TradeType } from '../../stores/SwapStore'
import { ChartTimeframe } from '../../types/market.types'
import { makeQueryString } from '../../utils/makeQueryString'
import { calculateValuation } from '../../utils/market-utils'
import { WEI_DENOMINATOR } from '../../lib/constants'
import { Token } from '../../stores/TokensStore'

export type Direction = 'long' | 'short'
export type TradeAction = 'open' | 'close'
type SlideUpContent = 'OpenMarket' | 'OpenCurrency' | 'ClosePosition' | 'CloseCurrency'

const DEFAULT_DIRECTION = 'long'

export class TradeStore {
  action: TradeAction = 'open'
  approving = false
  approvingClosePositions = false
  private closePositionMarketAmountOutBN?: BigNumber = undefined
  closeTradeHash?: string
  direction: Direction = DEFAULT_DIRECTION
  private userClosePositionValue = ''
  closingPosition = false
  openTradeAmount = ''
  openTradeAmountOutBN?: BigNumber = undefined
  openTradeHash?: string
  openingTrade = false
  paymentTokenOverride?: Token = undefined
  selectedMarket?: MarketEntity
  slideUpContent?: SlideUpContent = undefined
  showChart = true
  selectedTimeframe: ChartTimeframe = ChartTimeframe.DAY
  showSettings = false

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribeOpenTradeAmountOut()
    this.subscribeClosePositionAmountOut()
  }

  subscribeClosePositionAmountOut(): void {
    reaction(
      () => ({
        selectedPosition: this.selectedPosition,
        closePositionAmountBN: this.closePositionAmountBN,
        marketValuation: this.selectedMarket?.estimatedValuation,
      }),
      async ({ closePositionAmountBN, selectedPosition }) => {
        this.closePositionMarketAmountOutBN = undefined

        const { address: collateralAddress } = this.root.collateralStore

        if (
          closePositionAmountBN === undefined ||
          !collateralAddress ||
          !selectedPosition?.token.address ||
          selectedPosition.pool.poolImmutables?.fee === undefined
        )
          return

        const { fee } = selectedPosition.pool.poolImmutables

        const output = await this.root.swapStore.quoteExactInput({
          amountBN: closePositionAmountBN,
          fromAddress: selectedPosition.token.address,
          toAddress: collateralAddress,
          fee,
        })

        runInAction(() => {
          const shouldNotUpdate =
            output === undefined ||
            this.closePositionAmountBN === undefined ||
            !output.cachedInAmount.eq(this.closePositionAmountBN)

          if (shouldNotUpdate) return
          this.closePositionMarketAmountOutBN = output.output
        })
      }
    )
  }

  subscribeOpenTradeAmountOut(): void {
    reaction(
      () => ({
        selectedPosition: this.selectedPosition,
        openTradeAmountBN: this.openTradeAmountBN,
        marketValuation: this.selectedMarket?.estimatedValuation,
      }),
      async ({ openTradeAmountBN, selectedPosition }) => {
        this.openTradeAmountOutBN = undefined // clean up while new amountOut gets loaded

        const { address: collateralAddress } = this.root.collateralStore

        if (
          openTradeAmountBN === undefined ||
          !collateralAddress ||
          !selectedPosition ||
          !selectedPosition.token.address ||
          selectedPosition.pool.poolImmutables?.fee === undefined
        )
          return

        const { fee } = selectedPosition.pool.poolImmutables

        const output = await this.root.swapStore.quoteExactInput({
          amountBN: openTradeAmountBN,
          fromAddress: collateralAddress,
          toAddress: selectedPosition.token.address,
          fee,
        })

        runInAction(() => {
          const shouldNotUpdate =
            output === undefined ||
            this.openTradeAmountBN === undefined ||
            !output.cachedInAmount.eq(this.openTradeAmountBN)

          if (shouldNotUpdate) return
          this.openTradeAmountOutBN = output.output
        })
      }
    )
  }

  get insufficientBalanceForOpenTrade(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    const { balanceOfSigner } = this.root.collateralStore
    if (balanceOfSigner === undefined || this.openTradeAmountBN === undefined) return undefined
    return this.openTradeAmountBN.gt(balanceOfSigner)
  }

  // initial loading states can only be true if user has interacted with input
  get openTradeButtonInitialLoading(): boolean {
    if (this.openTradeAmount === '') return false
    const loadingMarketExpiry =
      this.selectedMarket !== undefined && this.selectedMarket.resolved === undefined
    return (
      this.needApproval === undefined ||
      this.openTradeAmountBN === undefined ||
      this.insufficientBalanceForOpenTrade === undefined ||
      loadingMarketExpiry
    )
  }

  get openTradeButtonLoading(): boolean {
    // user triggered actions that forces button to show spinner
    if (this.approving || this.openingTrade) return true

    // Don't need to show spinner, even if data is being loaded in the background, when:
    // - allowance is required (button will show "Approve")
    // - no market is selected (button will show "Select a Market")
    // - insufficient balance
    if (
      this.needApproval ||
      this.selectedMarket === undefined ||
      this.insufficientBalanceForOpenTrade
    )
      return false

    // initial loading states, not affected by user's interaction
    return this.openTradeButtonInitialLoading
  }

  // payment token will default to preETH incase autoselect fails (e.g. has 0 balance in everything)
  get paymentToken(): Token {
    return (
      this.paymentTokenOverride ?? {
        iconName: 'cash',
        name: 'Cash Balance',
        type: 'erc20',
        shortName: 'USD',
        erc20: this.root.collateralStore,
      }
    )
  }

  setAction(action: TradeAction): string {
    this.action = action
    return this.tradeUrl
  }

  setClosePositionValue(value: string): void {
    if (validateStringToBN(value)) this.userClosePositionValue = value
  }

  setCloseTradeHash(hash?: string): void {
    this.closeTradeHash = hash
  }

  setPaymentTokenOverride(token: Token): void {
    this.paymentTokenOverride = token
  }

  setShowChart(showChart: boolean): void {
    if (!showChart) this.setSelectedTimeframe(ChartTimeframe.DAY)
    this.showChart = showChart
  }

  setSlideUpContent(slideUpContent?: SlideUpContent): void {
    this.slideUpContent = slideUpContent
  }

  setDirection(direction: Direction, selectedMarket?: MarketEntity): string {
    this.direction = direction
    selectedMarket?.setSelectedPool(direction)
    return this.tradeUrl
  }

  setSelectedMarket(marketUrlId?: string): string {
    if (!marketUrlId) {
      this.selectedMarket = undefined
      return this.tradeUrl
    }
    const market = this.root.marketStore.markets[marketUrlId]
    this.selectedMarket = market
    return this.tradeUrl
  }

  setSelectedTimeframe(timeframe: ChartTimeframe): void {
    this.selectedTimeframe = timeframe
  }

  setShowSettings(show: boolean): void {
    this.showSettings = show
  }

  setOpenTradeAmount(amount: string): void {
    if (validateStringToBN(amount)) this.openTradeAmount = amount
  }

  setOpenTradeHash(hash?: string): void {
    this.openTradeHash = hash
  }

  get closePositionAmountOut(): string | undefined {
    if (this.closePositionAmountOutBN === undefined || !this.selectedPosition) return undefined
    return this.selectedPosition.token.formatUnits(this.closePositionAmountOutBN)
  }

  get closePositionValueBN(): BigNumber | undefined {
    return this.selectedPosition?.token.parseUnits(this.closePositionValue)
  }

  get closePositionDisabled(): boolean {
    return Boolean(
      !this.selectedPosition ||
        this.closePositionValue === '' ||
        this.closePositionValueBN?.eq(0) ||
        this.closePositionButtonLoading ||
        this.insufficientBalanceForClosePosition
    )
  }

  get closePositionButtonInitialLoading(): boolean {
    if (this.closePositionValue === '') return false
    const loadingSelectedPosition =
      this.selectedPosition !== undefined && this.selectedPosition.hasPosition === undefined

    return (
      loadingSelectedPosition ||
      // these values should only be undefined once while token's decimals is undefined
      this.closePositionValueBN === undefined ||
      this.closePositionNeedApproval === undefined ||
      this.insufficientBalanceForClosePosition === undefined
    )
  }

  get closePositionButtonLoading(): boolean {
    return (
      this.closePositionButtonInitialLoading || this.approvingClosePositions || this.closingPosition
    )
  }

  get closePositionNeedApproval(): boolean | undefined {
    if (!this.selectedPosition || !this.root.web3Store.connected) return false
    if (this.closePositionAmount === undefined) return undefined
    if (this.selectedMarket?.resolved) return false

    return this.selectedPosition.token.needToAllowFor(
      this.closePositionAmount,
      'UNISWAP_SWAP_ROUTER'
    )
  }

  // amount of long short token to close in BigNumber
  get closePositionAmountBN(): BigNumber | undefined {
    if (
      !this.selectedPosition ||
      this.selectedPosition.totalValueBN === undefined ||
      this.selectedPosition.priceBN === undefined ||
      this.closePositionValueBN === undefined
    )
      return undefined

    // we converted price to priceBN with WEI_DENOMINATOR to hold decimals in the price for more precise calculation (18 decimals)
    // so when converting from value to long/short token amount, we need to multiply the denominator
    // because when we divide priceBN, the price has been multiplied by the same WEI_DENOMINATOR
    return this.closePositionValueBN.mul(WEI_DENOMINATOR).div(this.selectedPosition.priceBN)
  }

  // amount of long short token to close in string
  get closePositionAmount(): string | undefined {
    if (this.closePositionAmountBN === undefined || this.selectedPosition === undefined)
      return undefined

    return this.selectedPosition.token.formatUnits(this.closePositionAmountBN)
  }

  get closePositionPriceBN(): BigNumber | undefined {
    if (
      this.closePositionAmountOutBN === undefined ||
      this.closePositionAmountBN === undefined ||
      this.closePositionAmountBN.eq(0)
    )
      return undefined

    return this.closePositionAmountOutBN.mul(WEI_DENOMINATOR).div(this.closePositionAmountBN)
  }

  // this price can be number because it's only used for estimated calculation and never require precise calculation
  get closePositionPrice(): number | undefined {
    if (this.closePositionValue === '') return this.selectedPosition?.price
    if (this.closePositionPriceBN === undefined || this.selectedPosition === undefined)
      return undefined

    const price = this.selectedPosition.token.formatUnits(this.closePositionPriceBN)
    if (price === undefined) return undefined
    return +price
  }

  get closePositionValuation(): number | undefined {
    if (!this.selectedPosition || this.closePositionPrice === undefined) return undefined
    const { payoutRange, valuationRange } = this.selectedPosition.market
    if (payoutRange === undefined || valuationRange === undefined) return undefined

    const longTokenPrice =
      this.direction === 'long' ? this.closePositionPrice : 1 - this.closePositionPrice

    return calculateValuation({
      longTokenPrice,
      payoutRange,
      valuationRange,
    })
  }

  // pnl per token = currentPrice - costPerToken
  get closePositionPnlPerToken(): number | undefined {
    if (!this.selectedPosition) return 0
    if (this.closePositionPrice === undefined || this.selectedPosition.costBasis === undefined)
      return undefined

    return this.closePositionPrice - this.selectedPosition.costBasis
  }

  get closePositionPnlAmount(): number | undefined {
    if (
      this.closePositionValueByCostBasis === undefined ||
      this.closePositionAmountOut === undefined
    )
      return undefined
    // the closePositionAmountOut is the actual USD amount user will receive
    // hence, subtract the original spent amount on the closing portion, we get the pnl amount
    return +this.closePositionAmountOut - this.closePositionValueByCostBasis
  }

  // this is the USD amount user original spent on the closing portion
  get closePositionValueByCostBasis(): number | undefined {
    if (this.closePositionAmount === undefined || this.selectedPosition?.costBasis === undefined)
      return undefined
    return +this.closePositionAmount * this.selectedPosition.costBasis
  }

  get insufficientBalanceForClosePosition(): boolean | undefined {
    if (!this.selectedPosition || !this.root.web3Store.connected) return false
    if (this.closePositionValueBN === undefined || this.selectedPosition.totalValueBN === undefined)
      return undefined

    return this.closePositionValueBN.gt(this.selectedPosition.totalValueBN)
  }

  get needApproval(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    return this.root.collateralStore.needToAllowFor(this.openTradeAmount, 'UNISWAP_SWAP_ROUTER')
  }

  get openTradeAmountOut(): string | undefined {
    // amountOut will always be 0 if input is 0
    if (this.openTradeAmountBN?.eq(0)) return '0'
    if (!this.selectedMarket || this.openTradeAmountOutBN === undefined) return undefined
    const token = this.selectedMarket[`${this.direction}Token`]
    return token?.formatUnits(this.openTradeAmountOutBN)
  }

  get openTradeAmountBN(): BigNumber | undefined {
    return this.root.collateralStore.parseUnits(this.openTradeAmount)
  }

  get tradeUrl(): string {
    return makeQueryString({
      marketId: this.selectedMarket?.urlId,
      direction: this.direction,
      action: this.action,
    })
  }

  get tradingLongPriceAfterSlippage(): number | undefined {
    if (this.openTradeAmountOut === undefined) return undefined

    const { slippage } = this.root.advancedSettingsStore
    const amountOutAfterSlippage = +this.openTradeAmountOut * (1 - slippage)
    const priceAfterSlippage = +this.openTradeAmount / amountOutAfterSlippage

    const longTokenPriceAfterSlippage =
      this.direction === 'long' ? priceAfterSlippage : 1 - priceAfterSlippage
    return longTokenPriceAfterSlippage
  }

  get tradingValuation(): number | undefined {
    if (this.selectedMarket === undefined || this.tradingLongPriceAfterSlippage === undefined)
      return undefined
    const { payoutRange, valuationRange } = this.selectedMarket
    if (!valuationRange || !payoutRange) return undefined

    return calculateValuation({
      longTokenPrice: this.tradingLongPriceAfterSlippage,
      payoutRange,
      valuationRange,
    })
  }

  get withinBounds(): boolean | undefined {
    if (
      this.selectedMarket === undefined ||
      this.tradingLongPriceAfterSlippage === undefined ||
      this.openTradeAmountBN === undefined ||
      this.selectedMarket.payoutRange === undefined
    )
      return undefined

    const { payoutRange } = this.selectedMarket
    const [lowerBound, upperBound] = payoutRange

    const inRange =
      this.tradingLongPriceAfterSlippage > lowerBound &&
      this.tradingLongPriceAfterSlippage < upperBound

    return inRange || this.openTradeAmountBN.eq(0)
  }

  async approve(): Promise<void> {
    this.approving = true
    await this.root.collateralStore.unlockPermanently('UNISWAP_SWAP_ROUTER')
    runInAction(() => {
      this.approving = false
    })
  }

  // eslint-disable-next-line require-await
  async openTrade(): Promise<void> {
    if (!this.selectedMarket) return

    const selectedToken = this.selectedMarket[`${this.direction}Token`]
    const price = this.selectedMarket[`${this.direction}TokenPrice`]
    const fee = this.selectedMarket[`${this.direction}Pool`]?.poolImmutables?.fee
    const { swap } = this.root.swapStore
    const { uniswapToken } = this.root.collateralStore

    if (
      !selectedToken?.address ||
      price === undefined ||
      fee === undefined ||
      this.openTradeAmountBN === undefined ||
      this.openTradeAmountOutBN === undefined
    )
      return

    this.setOpenTradeHash(undefined)
    this.openingTrade = true
    const { error } = await swap({
      fee,
      fromAmount: this.openTradeAmountBN,
      fromTokenAddress: uniswapToken.address,
      toAmount: this.openTradeAmountOutBN,
      toTokenAddress: selectedToken.address,
      type: TradeType.EXACT_INPUT,
      onHash: (hash) => this.setOpenTradeHash(hash),
    })

    if (error) {
      this.root.toastStore.errorToast('Trade failed', error)
    } else {
      this.root.toastStore.successToast('Trade was successful 🎉')
    }

    runInAction(() => {
      this.openingTrade = false
      // reset input amount if trade was successful
      if (!error) this.openTradeAmount = ''
    })
  }

  async approveClosePositions(): Promise<void> {
    if (!this.selectedPosition || this.approvingClosePositions) return
    this.approvingClosePositions = true
    await this.selectedPosition.token.unlockPermanently('UNISWAP_SWAP_ROUTER')
    runInAction(() => {
      this.approvingClosePositions = false
    })
  }

  // TODO: delete this function when we remove ClosePositionSummary
  // eslint-disable-next-line require-await
  async closeTrade(
    token: Erc20Store,
    amount: BigNumber,
    tokensReceivable: BigNumber,
    selectedMarket: MarketEntity
  ): Promise<{ success: boolean; error?: string }> {
    this.setCloseTradeHash(undefined)

    const fee = selectedMarket[`${this.direction}Pool`]?.poolImmutables?.fee
    const { swap } = this.root.swapStore
    const { uniswapToken } = this.root.collateralStore
    if (!token.address || !uniswapToken.address || fee === undefined)
      return { success: false, error: 'Please try again later.' }

    return swap({
      fee,
      fromAmount: amount,
      fromTokenAddress: token.address,
      toTokenAddress: uniswapToken.address,
      toAmount: tokensReceivable,
      type: TradeType.EXACT_INPUT,
      onHash: (hash) => this.setCloseTradeHash(hash),
    })
  }

  closeOrRedeemPosition(): void {
    if (this.selectedMarket?.resolved) {
      this.redeemPosition()
    } else {
      this.closePosition()
    }
  }

  private async closePosition(): Promise<void> {
    const { address: collateralAddress } = this.root.collateralStore

    if (
      !this.selectedPosition ||
      this.selectedPosition.pool.poolImmutables?.fee === undefined ||
      this.selectedPosition.token.address === undefined ||
      this.closePositionAmountBN === undefined ||
      this.closePositionValueBN === undefined ||
      collateralAddress === undefined
    )
      return

    const { swap } = this.root.swapStore
    const { fee } = this.selectedPosition.pool.poolImmutables
    const { address } = this.selectedPosition.token

    this.closingPosition = true
    const { error } = await swap({
      fee,
      fromAmount: this.closePositionAmountBN,
      fromTokenAddress: address,
      toAmount: this.closePositionValueBN,
      toTokenAddress: collateralAddress,
      type: TradeType.EXACT_INPUT,
    })

    if (error) {
      this.root.toastStore.errorToast('Trade failed', error)
    } else {
      this.root.toastStore.successToast('Trade was successful 🎉')
    }

    runInAction(() => {
      this.closingPosition = false
      if (!error) this.userClosePositionValue = ''
    })
  }

  private async redeemPosition(): Promise<void> {
    const { selectedMarket, selectedPosition } = this
    if (selectedPosition === undefined) return
    const {
      token: { balanceOfSigner },
    } = selectedPosition

    if (balanceOfSigner === undefined || selectedMarket === undefined) return

    this.closingPosition = true
    const { error } = await selectedMarket.redeem(
      this.direction === 'long' ? balanceOfSigner : BigNumber.from(0),
      this.direction === 'short' ? balanceOfSigner : BigNumber.from(0)
      // TODO: add the third 'address' parameter when we migrate to new contracts
    )

    if (error) {
      this.root.toastStore.errorToast('Redeem failed', error)
    } else {
      this.root.toastStore.successToast('Redeem was successful 🎉')
    }

    runInAction(() => {
      this.closingPosition = false
    })
  }

  get tradeDisabled(): boolean {
    // only if input is greater than 0
    const loadingValuationPrice =
      Boolean(this.openTradeAmountBN?.gt(0)) && this.openTradeAmountOutBN === undefined

    return Boolean(
      !this.selectedMarket ||
        this.openTradeAmountBN === undefined ||
        this.openTradeAmountBN.eq(0) ||
        !this.withinBounds ||
        this.insufficientBalanceForOpenTrade ||
        this.selectedMarket.resolved ||
        loadingValuationPrice
    )
  }

  get selectedPosition(): PositionEntity | undefined {
    const { allPositions } = this.root.portfolioStore
    if (!this.direction || !this.selectedMarket) return undefined

    const position = allPositions.find(
      ({ direction, market }) =>
        direction === this.direction && this.selectedMarket?.urlId === market.urlId
    )

    return position
  }

  get openTradePrice(): number | undefined {
    if (this.openTradeAmount === '') return this.selectedPosition?.price

    if (this.openTradeAmountOut === undefined) return undefined

    const { slippage } = this.root.advancedSettingsStore
    const amountOutAfterSlippage = +this.openTradeAmountOut * (1 - slippage)

    return +this.openTradeAmount / amountOutAfterSlippage
  }

  get closePositionValue(): string {
    if (this.selectedMarket?.resolved) {
      return this.selectedPosition?.totalValue ?? ''
    }

    return this.userClosePositionValue
  }

  private get redeemPositionAmountOutBN(): BigNumber | undefined {
    const { selectedMarket, selectedPosition, direction } = this
    if (selectedMarket === undefined || selectedPosition === undefined) return undefined
    const { finalLongPrice, maxPrice } = selectedMarket
    const {
      token: { balanceOfSigner },
    } = selectedPosition

    if (finalLongPrice === undefined || maxPrice === undefined || balanceOfSigner === undefined) {
      return undefined
    }

    if (direction === 'long') {
      return balanceOfSigner.mul(finalLongPrice).div(maxPrice)
    }

    return balanceOfSigner.mul(maxPrice.sub(finalLongPrice)).div(maxPrice)
  }

  private get closePositionAmountOutBN(): BigNumber | undefined {
    return this.redeemPositionAmountOutBN ?? this.closePositionMarketAmountOutBN
  }
}
