import { action, makeObservable, observable, runInAction } from 'mobx'
import { BigNumber } from 'ethers'
import { ContractReturn, Factory } from 'prepo-stores'
import { ChainId, Token } from '@uniswap/sdk'
import { getContractAddress } from 'prepo-utils'
import { RootStore } from './RootStore'
import { Erc20Store } from './entities/Erc20.entity'
import { getContractCall } from './utils/web3-store-utils'
import { CollateralAbi, CollateralAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'
import { supportedContracts } from '../lib/supported-contracts'

type Deposit = CollateralAbi['functions']['deposit']
type GetPercentDenominator = CollateralAbi['functions']['PERCENT_DENOMINATOR']
type GetDepositFee = CollateralAbi['functions']['getDepositFee']
type GetWithdrawFee = CollateralAbi['functions']['getWithdrawFee']
type Withdraw = CollateralAbi['functions']['withdraw']

const TOKEN_SYMBOL = 'preCT'
const TOKEN_DECIMALS = 18

export class CollateralStore extends Erc20Store {
  depositHash?: string
  depositing = false
  withdrawHash?: string
  uniswapToken: Token

  constructor(root: RootStore) {
    super({ root, tokenName: TOKEN_SYMBOL, factory: CollateralAbi__factory as unknown as Factory })
    const chainId = this.root.web3Store.network.chainId as unknown as ChainId
    const network = this.root.web3Store.network.name
    this.symbolOverride = TOKEN_SYMBOL
    this.uniswapToken = new Token(
      chainId,
      getContractAddress<SupportedContracts>(TOKEN_SYMBOL, network, supportedContracts) ?? '',
      TOKEN_DECIMALS,
      TOKEN_SYMBOL,
      TOKEN_SYMBOL
    )

    makeObservable(this, {
      deposit: action.bound,
      depositHash: observable,
      depositing: observable,
      getDepositFee: observable,
      getWithdrawFee: observable,
      setDepositHash: action.bound,
      setTransferHash: action.bound,
      setWithdrawHash: action.bound,
      withdraw: action.bound,
      withdrawHash: observable,
    })
  }

  getPercentDenominator(
    ...params: Parameters<GetPercentDenominator>
  ): ContractReturn<GetPercentDenominator> {
    return this.call<GetPercentDenominator>('PERCENT_DENOMINATOR', params)
  }

  getDepositFee(...params: Parameters<GetDepositFee>): ContractReturn<GetDepositFee> {
    return this.call<GetDepositFee>('getDepositFee', params)
  }

  getWithdrawFee(...params: Parameters<GetWithdrawFee>): ContractReturn<GetWithdrawFee> {
    return this.call<GetWithdrawFee>('getWithdrawFee', params)
  }

  async deposit(...params: Parameters<Deposit>): Promise<{ success: boolean; error?: string }> {
    try {
      this.depositing = true
      this.depositHash = undefined
      const { hash, wait } = await this.sendTransaction<Deposit>('deposit', params)
      runInAction(() => {
        this.depositHash = hash
      })
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      runInAction(() => {
        this.depositing = false
      })
    }
  }

  async withdraw(...params: Parameters<Withdraw>): Promise<{ success: boolean; error?: string }> {
    try {
      this.withdrawHash = undefined
      const { hash, wait } = await this.sendTransaction<Withdraw>('withdraw', params)
      runInAction(() => {
        this.withdrawHash = hash
      })
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  get percentDenominator(): BigNumber | undefined {
    const percentDenominatorRaw = this.getPercentDenominator()
    if (percentDenominatorRaw === undefined) return undefined
    return percentDenominatorRaw[0]
  }

  get depositFee(): BigNumber | undefined {
    return getContractCall(this.getDepositFee())
  }

  get withdrawFee(): BigNumber | undefined {
    return getContractCall(this.getWithdrawFee())
  }

  // setters

  setDepositHash(hash?: string): void {
    this.depositHash = hash
  }

  setTransferHash(hash?: string): void {
    this.transferHash = hash
  }

  setWithdrawHash(hash?: string): void {
    this.withdrawHash = hash
  }
}
