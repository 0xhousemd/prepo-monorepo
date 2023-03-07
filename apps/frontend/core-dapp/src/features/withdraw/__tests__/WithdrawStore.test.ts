/* eslint-disable @typescript-eslint/no-explicit-any */
import { configure } from 'mobx'
import { parseUnits } from 'ethers/lib/utils'
import { utils, BigNumber } from 'ethers'
import { ERC20_UNITS } from '../../../lib/constants'
import { DateTimeInMs, DurationInMs } from '../../../utils/date-types'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const amountToWithdraw = '1000.0'
const COLLATERAL_BALANCE = '2000'
const COLLATERAL_DECIMALS = 18

describe('WithdrawStore tests', () => {
  let spyCollateralBalance: jest.SpyInstance
  let spyCollateralBalanceOfSigner: jest.SpyInstance
  let spyCollateralDecimalsNumber: jest.SpyInstance
  let spyWithdrawalFeesAmountBN: jest.SpyInstance
  let spySuccessToast: jest.SpyInstance
  let spyGlobalAmountWithdrawnThisPeriod: jest.SpyInstance
  let spyGlobalPeriodLength: jest.SpyInstance
  let spyGlobalWithdrawLimitPerPeriod: jest.SpyInstance
  let spyLastGlobalPeriodReset: jest.SpyInstance
  beforeAll(() => {
    spySuccessToast = jest.spyOn(rootStore.toastStore, 'successToast').mockImplementation(jest.fn())

    spyCollateralBalance = jest
      .spyOn(rootStore.collateralStore, 'tokenBalanceFormat', 'get')
      .mockReturnValue(COLLATERAL_BALANCE)

    const COLLATERAL_BALANCE_BIGNUMBER = parseUnits(`${COLLATERAL_BALANCE}`, COLLATERAL_DECIMALS)

    spyCollateralBalanceOfSigner = jest
      .spyOn(rootStore.collateralStore, 'balanceOfSigner', 'get')
      .mockReturnValue(COLLATERAL_BALANCE_BIGNUMBER)

    spyCollateralDecimalsNumber = jest
      .spyOn(rootStore.collateralStore, 'decimalsNumber', 'get')
      .mockReturnValue(COLLATERAL_DECIMALS)

    spyWithdrawalFeesAmountBN = jest
      .spyOn(rootStore.withdrawStore, 'withdrawalFeesAmountBN', 'get')
      .mockReturnValue(BigNumber.from(0))

    spyGlobalAmountWithdrawnThisPeriod = jest
      .spyOn(rootStore.withdrawHookStore, 'globalAmountWithdrawnThisPeriod', 'get')
      .mockReturnValue(BigNumber.from(0))

    spyGlobalPeriodLength = jest
      .spyOn(rootStore.withdrawHookStore, 'globalPeriodLength', 'get')
      .mockReturnValue((24 * 60 * 60) as DurationInMs)

    spyGlobalWithdrawLimitPerPeriod = jest
      .spyOn(rootStore.withdrawHookStore, 'globalWithdrawLimitPerPeriod', 'get')
      .mockReturnValue(BigNumber.from(10).pow(18).mul(100))

    spyLastGlobalPeriodReset = jest
      .spyOn(rootStore.withdrawHookStore, 'lastGlobalPeriodReset', 'get')
      .mockReturnValue(0 as DateTimeInMs)
  })

  afterAll(() => {
    spyCollateralBalance.mockRestore()
    spyCollateralBalanceOfSigner.mockRestore()
    spyCollateralDecimalsNumber.mockRestore()
    spySuccessToast.mockRestore()
    spyWithdrawalFeesAmountBN.mockRestore()
    spyGlobalAmountWithdrawnThisPeriod.mockRestore()
    spyGlobalPeriodLength.mockRestore()
    spyGlobalWithdrawLimitPerPeriod.mockRestore()
    spyLastGlobalPeriodReset.mockRestore()
  })

  it('should set the amount', () => {
    rootStore.withdrawStore.setWithdrawalAmount(amountToWithdraw)
    expect(rootStore.withdrawStore.withdrawalAmountInEth).toBe(amountToWithdraw)
  })

  it('should disable button if amount is larger than balance', () => {
    rootStore.withdrawStore.setWithdrawalAmount('2000.5')
    expect(rootStore.withdrawStore.withdrawalDisabled).toBe(true)
  })

  describe('withdraw', () => {
    const mock: any = (): jest.Mock<void> => jest.fn()
    let spyWithdraw: jest.SpyInstance
    let spyAddress: jest.SpyInstance

    beforeEach(() => {
      spyWithdraw = jest.spyOn(rootStore.collateralStore, 'withdraw')
      spyAddress = jest
        .spyOn(rootStore.web3Store, 'address', 'get')
        .mockReturnValue('0xdummycontract')
      spyWithdraw.mockImplementation(mock)
      rootStore.withdrawStore.setWithdrawalAmount(amountToWithdraw)
      rootStore.withdrawStore.withdraw()
    })

    afterEach(() => {
      spyWithdraw.mockRestore()
      spyAddress.mockRestore()
    })

    it('should call withdraw method on the collateral contract when withdrawing', () => {
      expect(rootStore.collateralStore.withdraw).toHaveBeenCalledTimes(1)
    })

    it('should match same amount to withdraw to the one sent to the collateral contract', () => {
      const withdrawParameters = spyWithdraw.mock.calls[0][1]
      expect(utils.formatUnits(withdrawParameters, ERC20_UNITS)).toBe(amountToWithdraw)
    })
  })
})
