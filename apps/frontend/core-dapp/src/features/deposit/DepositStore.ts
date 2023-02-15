import { BigNumber } from 'ethers'
import { makeAutoObservable, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class DepositStore {
  approving = false
  depositAmount = ''
  depositing = false

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDepositAmount(amount: string): void {
    if (validateStringToBN(amount)) this.depositAmount = amount
  }

  async approve(): Promise<void> {
    this.approving = true
    await this.root.baseTokenStore.unlockPermanently('preCT')
    runInAction(() => {
      this.approving = false
    })
  }

  // eslint-disable-next-line require-await
  async deposit(): Promise<void> {
    this.depositing = true
    if (this.depositAmountBN === undefined) return
    const { error } = await this.root.preCTTokenStore.deposit(this.depositAmountBN)

    if (error) {
      this.root.toastStore.errorToast('Deposit failed', error)
    } else {
      this.root.toastStore.successToast('Deposit was successful 🎉')
    }

    runInAction(() => {
      this.depositing = false
    })
  }

  get depositButtonInitialLoading(): boolean {
    return this.depositAmountBN === undefined || this.needApproval === undefined
  }

  get depositButtonLoading(): boolean {
    return (
      this.depositing || this.approving || this.depositButtonInitialLoading || this.isLoadingBalance
    )
  }

  get depositDisabled(): boolean {
    return Boolean(
      this.depositAmount === '' ||
        this.depositAmountBN?.eq(0) ||
        this.depositButtonInitialLoading ||
        this.depositing ||
        this.insufficientBalance
    )
  }

  get depositAmountBN(): BigNumber | undefined {
    if (this.depositAmount === '') return BigNumber.from(0)
    return this.root.baseTokenStore.parseUnits(this.depositAmount)
  }

  get depositFees(): string | undefined {
    const { preCTTokenStore } = this.root
    const { feeDenominator, mintingFee } = preCTTokenStore
    if (
      mintingFee === undefined ||
      this.depositAmountBN === undefined ||
      feeDenominator === undefined
    )
      return undefined
    return this.root.baseTokenStore.formatUnits(
      this.depositAmountBN.mul(mintingFee).div(feeDenominator).add(1)
    )
  }

  // perfect accuracy not required since this is estimation
  get estimatedReceivedAmount(): number | undefined {
    const { sharesForAmount } = this.root.preCTTokenStore
    if (sharesForAmount === undefined || this.depositAmountBN === undefined) return undefined
    return +(this.root.preCTTokenStore.formatUnits(sharesForAmount) ?? 0) * +this.depositAmount
  }

  get insufficientBalance(): boolean | undefined {
    if (!this.root.web3Store.connected) return false

    const { balanceOfSigner } = this.root.baseTokenStore
    if (balanceOfSigner === undefined || this.depositAmountBN === undefined) return undefined

    return this.depositAmountBN.gt(balanceOfSigner)
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    return this.root.baseTokenStore.balanceOfSigner === undefined
  }

  get needApproval(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    return this.root.baseTokenStore.needToAllowFor(this.depositAmount, 'preCT')
  }

  get globalNetDepositAmountInUsd(): string | undefined {
    const depositAmount = this.root.depositRecordStore.globalNetDepositAmount
    if (!depositAmount) return undefined

    return this.root.baseTokenStore.formatUnits(depositAmount)
  }

  get globalNetDepositCapInUsd(): string | undefined {
    const depositAmount = this.root.depositRecordStore.globalNetDepositCap
    if (!depositAmount) return undefined

    return this.root.baseTokenStore.formatUnits(depositAmount)
  }
}
