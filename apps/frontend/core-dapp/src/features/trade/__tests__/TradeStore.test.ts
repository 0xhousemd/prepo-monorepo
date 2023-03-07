/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { configure } from 'mobx'
import { fakestock } from '../../../lib/markets'
import { Erc20Store } from '../../../stores/entities/Erc20.entity'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
// eslint-disable-next-line jest/no-mocks-import
import { poolMock } from '../../../__mocks__/test-mocks/pool.mock'

// TODO: remove this mock when we have functional market contract on arbitrum
jest.mock('../../../stores/entities/MarketEntity')

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const selectedMarket = new MarketEntity(rootStore, fakestock)
const amountToTrade = '100'
const COLLATERAL_BALANCE = '2000'
const COLLATERAL_DECIMALS = 18

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('TradeStore tests', () => {
  let spyCollateralTokenBalance: jest.SpyInstance
  let spyCollateralDecimalsNumber: jest.SpyInstance
  let spyCollateralBalanceOfSigner: jest.SpyInstance
  beforeAll(() => {
    spyCollateralTokenBalance = jest
      .spyOn(rootStore.collateralStore, 'tokenBalanceFormat', 'get')
      .mockReturnValue(COLLATERAL_BALANCE)

    spyCollateralDecimalsNumber = jest
      .spyOn(rootStore.collateralStore, 'decimalsNumber', 'get')
      .mockReturnValue(COLLATERAL_DECIMALS)

    const COLLATERAL_BALANCE_BN = parseUnits(COLLATERAL_BALANCE, COLLATERAL_DECIMALS)

    spyCollateralBalanceOfSigner = jest
      .spyOn(rootStore.collateralStore, 'balanceOfSigner', 'get')
      .mockReturnValue(COLLATERAL_BALANCE_BN)
  })

  afterAll(() => {
    spyCollateralTokenBalance.mockRestore()
    spyCollateralBalanceOfSigner.mockRestore()
    spyCollateralDecimalsNumber.mockRestore()
  })

  it('should initialize trade with long direction as default', () => {
    expect(rootStore.tradeStore.direction).toBe('long')
  })

  it('should change selected pool to short pool when selecting a short direction', () => {
    rootStore.tradeStore.setDirection('short', selectedMarket)
    if (!selectedMarket.selectedPool) return
    expect(selectedMarket.selectedPool.address).toBe(selectedMarket.shortPool?.address)
  })

  it('should select the amount to be traded', () => {
    rootStore.tradeStore.setOpenTradeAmount(amountToTrade)
    expect(rootStore.tradeStore.openTradeAmount).toBe(amountToTrade)
  })

  it('should allow decimals input', () => {
    rootStore.tradeStore.setOpenTradeAmount('100.123')
    expect(rootStore.tradeStore.openTradeAmount).toBe('100.123')
  })

  it('should disable button if amount is larger than balance', () => {
    const tradeAmount = '3000.50'
    rootStore.tradeStore.setOpenTradeAmount(tradeAmount)
    expect(rootStore.tradeStore.openTradeAmount).toBe(tradeAmount)
    expect(rootStore.tradeStore.tradeDisabled).toBe(true)
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.tradeStore.setOpenTradeAmount('100')
    expect(rootStore.tradeStore.insufficientBalanceForOpenTrade).toBe(false)
  })

  describe('opening a trade', () => {
    if (!selectedMarket.selectedPool) return

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactInput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)
    const spyPool = jest.spyOn(selectedMarket.selectedPool, 'pool', 'get').mockReturnValue(poolMock)

    it('should have the right amount when opening a trade', () => {
      const openTradeParameters = spyExactInput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    it('should call UniswapRouter exactInput when opening a trade', () => {
      rootStore.tradeStore.openTrade()
      expect(rootStore.uniswapRouterStore.exactInput).toHaveBeenCalledTimes(1)
    })

    spyPool.mockRestore()
    spyExactInput.mockRestore()
  })

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('closing a trade', () => {
    if (!selectedMarket.selectedPool) return
    const mockToken = new Erc20Store({ root: rootStore, tokenName: 'PREFAKESTOCK_LONG_TOKEN' })

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactOutput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)

    it('should have the right amount to sell when closing a trade', () => {
      const openTradeParameters = spyExactOutput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    it('should call UniswapRouter exactOutput when closing a trade', () => {
      rootStore.tradeStore.closeTrade(
        mockToken,
        BigNumber.from(amountToTrade),
        BigNumber.from(200),
        selectedMarket
      )
      expect(rootStore.uniswapRouterStore.exactOutput).toHaveBeenCalledTimes(1)
    })

    spyExactOutput.mockRestore()
  })
})
