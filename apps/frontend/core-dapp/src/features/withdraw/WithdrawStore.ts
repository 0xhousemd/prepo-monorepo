import { BigNumber } from 'ethers'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { differenceInMilliseconds } from 'date-fns'
import debounce from 'lodash/debounce'
import { RootStore } from '../../stores/RootStore'
import { getBalanceLimitInfo } from '../../utils/balance-limits'
import { addDuration } from '../../utils/date-utils'
import { DurationInMs } from '../../utils/date-types'

export type WithdrawLimit =
  | {
      status: 'loading' | 'not-exceeded'
    }
  | {
      amountEth: string
      capEth: string
      remainingEth: string
      // If undefined, withdrawal period was reset already
      resetsIn: DurationInMs | undefined
      status: 'already-exceeded' | 'exceeded-after-transfer'
    }

export class WithdrawStore {
  withdrawing = false
  private userWithdrawalAmountInEth:
    | { type: 'user-input'; value: string }
    | { type: 'max-balance' } = {
    type: 'user-input',
    value: '',
  }
  private withdrawalMarketValueInEth:
    | { status: 'not-queried' }
    | { status: 'not-enough-liquidity' }
    | { status: 'trade-valid'; value: BigNumber }
    | { status: 'price-impact-too-high'; value: BigNumber } = {
    status: 'not-queried',
  }

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })

    reaction(
      () => this.withdrawalAmountAfterFeeInWstEthBN,
      debounce(this.updateWithdrawalMarketValue.bind(this), 300),
      {
        equals: (a, b) => {
          if (a === undefined && b === undefined) return true
          if (a === undefined || b === undefined) return false
          return a.eq(b)
        },
      }
    )
  }

  setWithdrawalAmount(amount: string): void {
    const { tokenBalanceFormatInEth } = this.root.collateralStore

    if (!validateStringToBN(amount)) {
      return
    }

    this.withdrawalMarketValueInEth = { status: 'not-queried' }
    if (amount === tokenBalanceFormatInEth) {
      // If the user clicks "MAX", all the wstETH balance (priced in ETH) will
      // be selected. However, since the wstETH price is updated in real time,
      // it is possible that it could grow before the user submits the tx.
      // Storing 'max-balance' here avoids leaving the user wiht dust.
      this.userWithdrawalAmountInEth = {
        type: 'max-balance',
      }
    } else {
      this.userWithdrawalAmountInEth = {
        type: 'user-input',
        value: amount,
      }
    }
  }

  async withdraw(): Promise<void> {
    const { address } = this.root.web3Store
    if (
      this.insufficientBalance ||
      this.withdrawalAmountInWstEthBN === undefined ||
      this.withdrawalAmountInWstEthBN.eq(0) ||
      this.withdrawalMarketValueInEth.status !== 'trade-valid' ||
      address === undefined
    )
      return

    this.withdrawing = true
    const { error } = await this.root.depositTradeHelperStore.withdrawAndUnwrap(
      address,
      this.withdrawalAmountInWstEthBN,
      this.withdrawalMarketValueInEth.value
    )

    if (error) {
      this.root.toastStore.errorToast('Withdrawal failed', error)
    } else {
      this.root.toastStore.successToast('Withdrawal successful 🎉')
    }

    runInAction(() => {
      this.withdrawing = false
      if (!error) this.userWithdrawalAmountInEth = { type: 'user-input', value: '' }
    })
  }

  get insufficientBalance(): boolean | undefined {
    if (
      this.withdrawalAmountInWstEthBN === undefined ||
      this.root.collateralStore.balanceOfSigner === undefined
    )
      return undefined
    return this.withdrawalAmountInWstEthBN.gt(this.root.collateralStore.balanceOfSigner)
  }

  get insufficientLiquidity(): boolean {
    return this.withdrawalMarketValueInEth.status === 'not-enough-liquidity'
  }

  get priceImpactTooHigh(): boolean {
    return this.withdrawalMarketValueInEth.status === 'price-impact-too-high'
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    return this.root.collateralStore.balanceOfSigner === undefined
  }

  get withdrawalAmountBN(): BigNumber | undefined {
    return this.root.collateralStore.parseUnits(this.withdrawalAmountInEth)
  }

  get withdrawalAmountInEth(): string {
    const { userWithdrawalAmountInEth } = this
    const { tokenBalanceFormatInEth } = this.root.collateralStore

    if (userWithdrawalAmountInEth.type === 'max-balance') {
      return tokenBalanceFormatInEth ?? ''
    }

    return userWithdrawalAmountInEth.value
  }

  get withdrawalDisabled(): boolean {
    return (
      this.withdrawalAmountInWstEthBN === undefined ||
      !this.withdrawalAmountInWstEthBN ||
      this.withdrawalAmountInWstEthBN.lte(0) ||
      this.withdrawalMarketValueInEth.status !== 'trade-valid' ||
      this.insufficientBalance === undefined ||
      this.insufficientBalance ||
      this.withdrawUILoading ||
      this.withdrawLimit.status === 'already-exceeded' ||
      this.withdrawLimit.status === 'exceeded-after-transfer'
    )
  }

  get withdrawalFeesAmountBN(): BigNumber | undefined {
    const { withdrawFee, percentDenominator } = this.root.collateralStore
    if (
      this.withdrawalAmountBN === undefined ||
      percentDenominator === undefined ||
      withdrawFee === undefined
    )
      return undefined
    return this.withdrawalAmountBN.mul(withdrawFee).div(percentDenominator)
  }

  get withdrawalFeesAmount(): string | undefined {
    const { withdrawalFeesAmountBN } = this
    if (withdrawalFeesAmountBN === undefined) return undefined
    return this.root.collateralStore.formatUnits(withdrawalFeesAmountBN)
  }

  get receivedAmountInEth(): number | undefined {
    if (this.receivedAmountInEthBN === undefined) return undefined
    const amountString = this.root.collateralStore.formatUnits(this.receivedAmountInEthBN)
    if (amountString === undefined) return undefined
    return +amountString
  }

  private get receivedAmountInEthBN(): BigNumber | undefined {
    const { withdrawalMarketValueInEth } = this
    if (
      withdrawalMarketValueInEth.status === 'not-queried' ||
      withdrawalMarketValueInEth.status === 'not-enough-liquidity'
    )
      return undefined
    return withdrawalMarketValueInEth.value
  }

  private get withdrawalAmountInWstEthBN(): BigNumber | undefined {
    if (this.withdrawalAmountBN === undefined) return undefined
    return this.root.balancerStore.getEthAmountInWstEth(this.withdrawalAmountBN)
  }

  private get withdrawalAmountAfterFeeInEthBN(): BigNumber | undefined {
    if (this.withdrawalAmountBN === undefined || this.withdrawalFeesAmountBN === undefined)
      return undefined
    return this.withdrawalAmountBN.sub(this.withdrawalFeesAmountBN)
  }

  private get withdrawalAmountAfterFeeInWstEthBN(): BigNumber | undefined {
    if (this.withdrawalAmountAfterFeeInEthBN === undefined) return undefined
    return this.root.balancerStore.getEthAmountInWstEth(this.withdrawalAmountAfterFeeInEthBN)
  }

  get withdrawUILoading(): boolean {
    const { signerNonces, name } = this.root.collateralStore
    const { needPermitForWithdrawAndUnwrap } = this.root.depositTradeHelperStore
    return (
      signerNonces === undefined ||
      !name ||
      needPermitForWithdrawAndUnwrap === undefined ||
      this.withdrawing ||
      this.withdrawButtonInitialLoading ||
      this.withdrawLimit.status === 'loading'
    )
  }

  get withdrawButtonInitialLoading(): boolean {
    if (
      this.userWithdrawalAmountInEth.type === 'user-input' &&
      this.userWithdrawalAmountInEth.value === ''
    )
      return false
    return Boolean(this.isLoadingBalance || this.insufficientBalance === undefined)
  }

  get ppoReward(): string | undefined {
    const { withdrawalFeesAmountBN } = this

    // If there's no fee, there's no PPO reimbursement
    if (withdrawalFeesAmountBN === undefined || withdrawalFeesAmountBN.eq(0)) return '0'

    const rewardBN = this.root.tokenSenderStore.calculateReward(withdrawalFeesAmountBN)

    if (rewardBN === undefined) return undefined

    return this.root.ppoTokenStore.formatUnits(rewardBN)
  }

  get withdrawLimit(): WithdrawLimit {
    const {
      globalAmountWithdrawnThisPeriodInEth,
      globalPeriodLength,
      globalWithdrawLimitPerPeriodInEth,
      lastGlobalPeriodReset,
    } = this.root.withdrawHookStore
    const { nowInMs } = this.root.timerStore

    if (globalPeriodLength === undefined || lastGlobalPeriodReset === undefined) {
      return {
        status: 'loading',
      }
    }

    const periodAlreadyReset =
      differenceInMilliseconds(nowInMs, lastGlobalPeriodReset) > globalPeriodLength

    const limitInfo = getBalanceLimitInfo({
      additionalAmount: this.withdrawalAmountBN,
      cap: globalWithdrawLimitPerPeriodInEth,
      // If the reset window has passed, disregard the value of globalAmountWithdrawnThisPeriod.
      // The amount withdrawn is effectively zero.
      // When someone withdraws, globalAmountWithdrawnThisPeriod will update and thus the withdraw limit will be recomputed
      currentAmount: periodAlreadyReset ? BigNumber.from(0) : globalAmountWithdrawnThisPeriodInEth,
    })

    if (limitInfo.status === 'already-exceeded' || limitInfo.status === 'exceeded-after-transfer') {
      const nextGlobalPeriodReset = addDuration(lastGlobalPeriodReset, globalPeriodLength)
      const timeToReset = differenceInMilliseconds(nextGlobalPeriodReset, nowInMs) as DurationInMs

      return {
        ...limitInfo,
        resetsIn: periodAlreadyReset ? undefined : timeToReset,
      }
    }

    return {
      status: limitInfo.status,
    }
  }

  private async updateWithdrawalMarketValue(value: BigNumber | undefined): Promise<void> {
    if (value === undefined) return

    try {
      const withdrawalAmountInEth = await this.root.balancerStore.quoteWstEthAmountInEth(value)

      runInAction(() => {
        if (
          withdrawalAmountInEth !== undefined &&
          this.withdrawalAmountAfterFeeInWstEthBN?.eq(value)
        ) {
          this.withdrawalMarketValueInEth = {
            status: this.root.advancedSettingsStore.isPriceImpactTooHigh(
              withdrawalAmountInEth.priceImpact
            )
              ? 'price-impact-too-high'
              : 'trade-valid',
            value: withdrawalAmountInEth.value,
          }
        }
      })
      // eslint-disable-next-line
    } catch (e: any) {
      if (
        e.code === 'CALL_EXCEPTION' &&
        Array.isArray(e.errorArgs) &&
        // ref: https://docs.balancer.fi/reference/contracts/error-codes.html
        (e.errorArgs[0] === 'BAL#001' || e.errorArgs[0] === 'BAL#526')
      ) {
        runInAction(() => {
          this.withdrawalMarketValueInEth = { status: 'not-enough-liquidity' }
        })
      } else {
        runInAction(() => {
          this.userWithdrawalAmountInEth = { type: 'user-input', value: '' }
        })

        this.root.toastStore.errorToast('Something went wrong, please try again later.', e)
      }
    }
  }

  // only for testing
  setWithdrawalMarketValueInEth(value: WithdrawStore['withdrawalMarketValueInEth']): void {
    if (process.env.NODE_ENV !== 'test') return
    this.withdrawalMarketValueInEth = value
  }
}
