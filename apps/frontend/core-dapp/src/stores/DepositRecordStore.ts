import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from './RootStore'
import { DepositRecordAbi, DepositRecordAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'

type GetGlobalNetDepositAmount = DepositRecordAbi['functions']['getGlobalNetDepositAmount']
type GetGlobalNetDepositCap = DepositRecordAbi['functions']['getGlobalNetDepositCap']
type GetUserDepositAmount = DepositRecordAbi['functions']['getUserDepositAmount']
type GetUserDepositCap = DepositRecordAbi['functions']['getUserDepositCap']

export class DepositRecordStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(rootStore: RootStore) {
    super(rootStore, 'DEPOSIT_RECORD', DepositRecordAbi__factory as unknown as Factory)
  }

  private getGlobalNetDepositAmount(
    ...params: Parameters<GetGlobalNetDepositAmount>
  ): ContractReturn<GetGlobalNetDepositAmount> {
    return this.call<GetGlobalNetDepositAmount>('getGlobalNetDepositAmount', params)
  }

  private getGlobalNetDepositCap(
    ...params: Parameters<GetGlobalNetDepositCap>
  ): ContractReturn<GetGlobalNetDepositCap> {
    return this.call<GetGlobalNetDepositCap>('getGlobalNetDepositCap', params)
  }

  private getUserDepositAmount(
    ...params: Parameters<GetUserDepositAmount>
  ): ContractReturn<GetUserDepositAmount> {
    return this.call<GetUserDepositAmount>('getUserDepositAmount', params)
  }

  private getUserDepositCap(
    ...params: Parameters<GetUserDepositCap>
  ): ContractReturn<GetUserDepositCap> {
    return this.call<GetUserDepositCap>('getUserDepositCap', params)
  }

  get globalNetDepositAmount(): BigNumber | undefined {
    return this.getGlobalNetDepositAmount()?.[0]
  }

  get globalNetDepositCap(): BigNumber | undefined {
    return this.getGlobalNetDepositCap()?.[0]
  }

  get userDepositAmountOfSigner(): BigNumber | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    return this.getUserDepositAmount(address)?.[0]
  }

  get userDepositCap(): BigNumber | undefined {
    return this.getUserDepositCap()?.[0]
  }
}
