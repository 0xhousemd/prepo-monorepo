import { formatEther, parseEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { makeAutoObservable, runInAction, reaction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import minBy from 'lodash/minBy'
import { RootStore } from '../../stores/RootStore'
import { isProduction } from '../../utils/isProduction'
import { BalanceLimitInfo, getBalanceLimitInfo } from '../../utils/balance-limits'
import { Token } from '../../stores/TokensStore'

export type DepositLimit =
  | {
      status: 'loading' | 'web3-not-ready' | 'not-exceeded'
    }
  | {
      amountUnits: string
      capUnits: string
      remainingUnits: string
      status: 'already-exceeded' | 'exceeded-after-transfer'
      type: 'user-limit' | 'global-limit'
    }

type ExceededAfterTransfer = BalanceLimitInfo & { status: 'exceeded-after-transfer' }

function isExceededAfterTransfer(
  limit: BalanceLimitInfo | { status: 'web3-not-ready' }
): limit is ExceededAfterTransfer {
  return limit.status === 'exceeded-after-transfer'
}

export class DepositStore {
  approving = false
  depositAmount = ''
  depositing = false
  depositTokenOverride?: Token = undefined
  showCurrencySlideUp = false

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribeDepositBalance()
  }

  subscribeDepositBalance(): void {
    reaction(
      () => this.root.tokensStore.getTokenBalance(this.depositToken),
      (balance) => {
        if (balance !== undefined) this.depositAmount = balance
      }
    )
  }

  setDepositAmount(amount: string): void {
    if (validateStringToBN(amount)) this.depositAmount = amount
  }

  setDepositTokenOverride(token: Token): void {
    this.depositTokenOverride = token
  }

  setShowCurrencySlideUp(show: boolean): void {
    this.showCurrencySlideUp = show
  }

  async approve(): Promise<void> {
    this.approving = true
    // native eth dont require approval
    if (this.depositToken.type === 'native') return
    await this.depositToken.erc20.unlockPermanently('COLLATERAL')
    runInAction(() => {
      this.approving = false
    })
  }

  // eslint-disable-next-line require-await
  async deposit(): Promise<void> {
    const { address } = this.root.web3Store
    if (this.depositAmountBN === undefined || address === undefined) return

    this.depositing = true

    const { error } =
      this.depositToken.type === 'native'
        ? await this.root.depositTradeHelperStore.wrapAndDeposit(address, this.depositAmountBN)
        : await this.root.collateralStore.deposit(address, this.depositAmountBN)

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
      this.depositing ||
      this.approving ||
      this.depositButtonInitialLoading ||
      this.isLoadingBalance ||
      this.depositLimit.status === 'loading'
    )
  }

  get depositDisabled(): boolean {
    return Boolean(
      this.depositAmount === '' ||
        this.depositAmountBN?.eq(0) ||
        this.depositButtonInitialLoading ||
        this.depositing ||
        this.insufficientBalance ||
        this.depositLimit.status === 'already-exceeded' ||
        this.depositLimit.status === 'exceeded-after-transfer'
    )
  }

  get depositAmountBN(): BigNumber | undefined {
    if (this.depositAmount === '') return BigNumber.from(0)
    if (this.depositToken.type === 'native') return parseEther(this.depositAmount)
    return this.depositToken.erc20.parseUnits(this.depositAmount)
  }

  private get depositFeesBN(): BigNumber | undefined {
    const { collateralStore } = this.root
    const { percentDenominator, depositFee } = collateralStore
    if (
      depositFee === undefined ||
      this.depositAmountBN === undefined ||
      percentDenominator === undefined
    )
      return undefined

    return this.depositAmountBN.mul(depositFee).div(percentDenominator)
  }

  get depositFees(): string | undefined {
    const { depositFeesBN } = this
    if (!depositFeesBN) return undefined
    if (this.depositToken.type === 'native') return formatEther(depositFeesBN)
    return this.depositToken.erc20.formatUnits(depositFeesBN)
  }

  get estimatedReceivedAmount(): number | undefined {
    if (this.depositFeesBN === undefined || this.depositAmountBN === undefined) return undefined
    return +(
      this.root.collateralStore.formatUnits(this.depositAmountBN.sub(this.depositFeesBN)) ?? 0
    )
  }

  get insufficientBalance(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    const balanceBN = this.root.tokensStore.getTokenBalanceBN(this.depositToken)

    if (balanceBN === undefined || this.depositAmountBN === undefined) return undefined

    return this.depositAmountBN.gt(balanceBN)
  }

  get isLoadingBalance(): boolean {
    if (!this.root.web3Store.connected) return false
    const balance = this.root.tokensStore.getTokenBalanceBN(this.depositToken)
    return balance === undefined
  }

  get needApproval(): boolean | undefined {
    if (!this.root.web3Store.connected) return false
    if (this.depositToken.type === 'native') return false
    return this.depositToken.erc20.needToAllowFor(this.depositAmount, 'COLLATERAL')
  }

  get depositToken(): Token {
    return (
      this.depositTokenOverride ?? {
        iconName: 'eth',
        name: 'ETH',
        type: 'native',
      }
    )
  }

  private get globalDepositLimitInfo(): BalanceLimitInfo {
    // TODO: remove this when contract is updated
    if (process.env.NODE_ENV === 'test' || isProduction())
      return {
        amountUnits: '0',
        capUnits: '0',
        remainingUnits: '0',
        status: 'not-exceeded',
      }

    return getBalanceLimitInfo({
      additionalAmount: this.depositAmountBN,
      cap: this.root.depositRecordStore.globalNetDepositCap,
      currentAmount: this.root.depositRecordStore.globalNetDepositAmount,
      formatUnits:
        this.depositToken.type === 'native'
          ? formatEther
          : this.depositToken.erc20.formatUnits.bind(this.depositToken.erc20),
    })
  }

  private get userDepositLimitInfo(): { status: 'web3-not-ready' } | BalanceLimitInfo {
    if (!this.root.web3Store.connected || !this.root.web3Store.isNetworkSupported) {
      return { status: 'web3-not-ready' }
    }

    // TODO: remove this when contract is updated
    if (process.env.NODE_ENV === 'test' || isProduction())
      return {
        amountUnits: '0',
        capUnits: '0',
        remainingUnits: '0',
        status: 'not-exceeded',
      }

    return getBalanceLimitInfo({
      additionalAmount: this.depositAmountBN,
      cap: this.root.depositRecordStore.userDepositCap,
      currentAmount: this.root.depositRecordStore.userDepositAmountOfSigner,
      formatUnits:
        this.depositToken.type === 'native'
          ? formatEther
          : this.depositToken.erc20.formatUnits.bind(this.depositToken.erc20),
    })
  }

  get depositLimit(): DepositLimit {
    const { globalDepositLimitInfo, userDepositLimitInfo } = this

    if (globalDepositLimitInfo.status === 'loading' || userDepositLimitInfo.status === 'loading') {
      return { status: 'loading' }
    }

    if (globalDepositLimitInfo.status === 'already-exceeded') {
      return {
        ...globalDepositLimitInfo,
        type: 'global-limit',
      }
    }

    if (userDepositLimitInfo.status === 'already-exceeded') {
      return {
        ...userDepositLimitInfo,
        type: 'global-limit',
      }
    }

    const lowestLimit = minBy(
      [globalDepositLimitInfo, userDepositLimitInfo].filter(isExceededAfterTransfer),
      (limit) => +limit.remainingUnits
    )

    if (lowestLimit) {
      return {
        ...lowestLimit,
        type: lowestLimit === globalDepositLimitInfo ? 'global-limit' : 'user-limit',
      }
    }

    if (userDepositLimitInfo.status === 'web3-not-ready') {
      return {
        status: 'web3-not-ready',
      }
    }

    return { status: 'not-exceeded' }
  }

  get ppoReward(): string | undefined {
    const { depositFeesBN } = this

    // If there's no fee, there's no PPO reimbursement
    if (depositFeesBN === undefined || depositFeesBN.eq(0)) return '0'

    const rewardBN = this.root.tokenSenderStore.calculateReward(depositFeesBN)

    if (rewardBN === undefined) return undefined

    return this.root.ppoTokenStore.formatUnits(rewardBN)
  }
}
