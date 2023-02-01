import { BigNumber } from 'ethers'
import { makeAutoObservable } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class WithdrawStore {
  withdrawalAmount = ''

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setWithdrawalAmount(amount: string): void {
    if (validateStringToBN(amount)) this.withdrawalAmount = amount
  }

  // eslint-disable-next-line require-await
  async withdraw(): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    const { preCTTokenStore } = this.root
    return this.withdrawalAmountBN !== undefined && this.withdrawalAmountBN.gt(0)
      ? preCTTokenStore.withdraw(this.withdrawalAmountBN)
      : { success: false }
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    return this.root.preCTTokenStore.balanceOfSigner === undefined
  }

  get withdrawalAmountBN(): BigNumber | undefined {
    return this.root.preCTTokenStore.parseUnits(this.withdrawalAmount)
  }

  get withdrawalDisabled(): boolean {
    const { tokenBalanceRaw } = this.root.preCTTokenStore
    return (
      tokenBalanceRaw === undefined ||
      !this.withdrawalAmountBN ||
      this.withdrawalAmountBN.lte(0) ||
      this.withdrawalAmountBN.gt(tokenBalanceRaw)
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
    const { withdrawing } = this.root.preCTTokenStore
    return (
      withdrawing ||
      this.receivedAmountBN === undefined ||
      this.withdrawalAmountBN === undefined ||
      this.isLoadingBalance
    )
  }

  get withdrawalFee(): number | undefined {
    const { redemptionFee, feeDenominator } = this.root.preCTTokenStore
    if (redemptionFee === undefined || feeDenominator === undefined) return undefined
    return redemptionFee.toNumber() / feeDenominator.toNumber()
  }
}
