import { BigNumber } from 'ethers'
import { makeAutoObservable, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class WithdrawStore {
  withdrawing = false
  withdrawalAmount = ''

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setWithdrawalAmount(amount: string): void {
    if (validateStringToBN(amount)) this.withdrawalAmount = amount
  }

  async withdraw(): Promise<void> {
    if (
      this.insufficientBalance ||
      this.withdrawalAmountBN === undefined ||
      this.withdrawalAmountBN.eq(0)
    )
      return

    this.withdrawing = true
    const { error } = await this.root.preCTTokenStore.withdraw(this.withdrawalAmountBN)

    if (error) {
      this.root.toastStore.errorToast('Withdrawal failed', error)
    } else {
      this.root.toastStore.successToast('Withdrawal successful 🎉')
    }

    runInAction(() => {
      this.withdrawing = false
      if (!error) this.withdrawalAmount = ''
    })
  }

  get insufficientBalance(): boolean | undefined {
    if (
      this.withdrawalAmountBN === undefined ||
      this.root.preCTTokenStore.balanceOfSigner === undefined
    )
      return undefined
    return this.withdrawalAmountBN.gt(this.root.preCTTokenStore.balanceOfSigner)
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    return this.root.preCTTokenStore.balanceOfSigner === undefined
  }

  get withdrawalAmountBN(): BigNumber | undefined {
    return this.root.preCTTokenStore.parseUnits(this.withdrawalAmount)
  }

  get withdrawalDisabled(): boolean {
    return (
      this.receivedAmountBN === undefined ||
      !this.withdrawalAmountBN ||
      this.withdrawalAmountBN.lte(0) ||
      this.insufficientBalance === undefined ||
      this.insufficientBalance ||
      this.withdrawUILoading
    )
  }

  // TODO: preCTTokenStore's abi is outdated. Update to use withdrawFee instead of redepmtionFee when we update collateral contract
  // returns withdrawalAmount * fee in Collateral token's decimals
  get withdrawalFeesAmountBN(): BigNumber | undefined {
    const { redemptionFee, feeDenominator } = this.root.preCTTokenStore
    if (
      this.withdrawalAmountBN === undefined ||
      feeDenominator === undefined ||
      redemptionFee === undefined
    )
      return undefined
    return this.withdrawalAmountBN.mul(redemptionFee).div(feeDenominator)
  }

  get withdrawalFeesAmount(): string | undefined {
    const { withdrawalFeesAmountBN } = this
    if (withdrawalFeesAmountBN === undefined) return undefined
    return this.root.preCTTokenStore.formatUnits(withdrawalFeesAmountBN)
  }

  get receivedAmount(): number | undefined {
    if (this.receivedAmountBN === undefined) return undefined
    const amountString = this.root.preCTTokenStore.formatUnits(this.receivedAmountBN)
    if (amountString === undefined) return undefined
    return +amountString
  }

  get receivedAmountBN(): BigNumber | undefined {
    if (this.withdrawalAmountBN === undefined || this.withdrawalFeesAmountBN === undefined)
      return undefined
    return this.withdrawalAmountBN.sub(this.withdrawalFeesAmountBN)
  }

  get withdrawUILoading(): boolean {
    return this.withdrawing || this.withdrawButtonInitialLoading
  }

  get withdrawalFee(): number | undefined {
    const { redemptionFee, feeDenominator } = this.root.preCTTokenStore
    if (redemptionFee === undefined || feeDenominator === undefined) return undefined
    return redemptionFee.toNumber() / feeDenominator.toNumber()
  }

  get withdrawButtonInitialLoading(): boolean {
    if (this.withdrawalAmount === '') return false
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
}
