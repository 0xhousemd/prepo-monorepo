/* eslint-disable @typescript-eslint/no-explicit-any */
import { utils } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { configure } from 'mobx'
import { ERC20_UNITS } from '../../../lib/constants'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const amountToDeposit = '1000.0'
const ETH_BALANCE = 2000

describe('DepositStore tests', () => {
  let spyGetTokenBalance: jest.SpyInstance
  let spyNeedApproval: jest.SpyInstance
  let spySuccessToast: jest.SpyInstance
  let spyDepositsAllowed: jest.SpyInstance

  beforeAll(() => {
    spySuccessToast = jest.spyOn(rootStore.toastStore, 'successToast').mockImplementation(jest.fn())

    spyNeedApproval = jest
      .spyOn(rootStore.depositStore, 'needApproval', 'get')
      .mockReturnValue(false)

    const ethBalanceBN = parseEther(`${ETH_BALANCE}`)

    spyGetTokenBalance = jest
      .spyOn(rootStore.tokensStore, 'getTokenBalanceBN')
      .mockImplementation(() => ethBalanceBN)

    spyDepositsAllowed = jest
      .spyOn(rootStore.depositHookStore, 'depositsAllowed', 'get')
      .mockReturnValue(true)
  })

  afterAll(() => {
    spyGetTokenBalance.mockRestore()
    spyNeedApproval.mockRestore()
    spySuccessToast.mockRestore()
    spyDepositsAllowed.mockRestore()
  })

  it('should set the amount', () => {
    rootStore.depositStore.setDepositAmount(amountToDeposit)
    expect(rootStore.depositStore.depositAmount).toBe(amountToDeposit)
  })

  it('should disable button if amount is larger than balance', () => {
    rootStore.depositStore.setDepositAmount('10000')
    expect(rootStore.depositStore.depositDisabled).toBe(true)
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.depositStore.setDepositAmount('100')
    expect(rootStore.depositStore.depositDisabled).toBe(false)
  })

  describe('deposit', () => {
    const mock: any = (): jest.Mock<void> => jest.fn()
    let spyDeposit: jest.SpyInstance
    let spyDepositAndWrap: jest.SpyInstance
    let spyAddress: jest.SpyInstance

    beforeEach(() => {
      rootStore.depositStore.setDepositAmount(amountToDeposit)
      spyDeposit = jest.spyOn(rootStore.collateralStore, 'deposit')
      spyDepositAndWrap = jest.spyOn(rootStore.depositTradeHelperStore, 'wrapAndDeposit')
      spyAddress = jest
        .spyOn(rootStore.web3Store, 'address', 'get')
        .mockReturnValue('0xdummyAddress')

      spyDepositAndWrap.mockImplementation(mock)
      spyDeposit.mockImplementation(mock)
      rootStore.depositStore.deposit()
    })

    afterEach(() => {
      spyDeposit.mockRestore()
      spyAddress.mockRestore()
      spyDepositAndWrap.mockRestore()
    })

    it('should call deposit method on the collateral contract when depositing', () => {
      expect(rootStore.depositTradeHelperStore.wrapAndDeposit).toHaveBeenCalledTimes(1)
    })

    it('should match same amount to deposit to the one sent to the collateral contract', () => {
      const depositParameters = spyDepositAndWrap.mock.calls[0][1]
      expect(utils.formatUnits(depositParameters, ERC20_UNITS)).toBe(amountToDeposit)
    })
  })
})
