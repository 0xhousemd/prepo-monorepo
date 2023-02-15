import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from './RootStore'
import { DepositRecordAbi, DepositRecordAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'

type GetGlobalNetDepositAmount = DepositRecordAbi['functions']['getGlobalNetDepositAmount']
type GetGlobalNetDepositCap = DepositRecordAbi['functions']['getGlobalNetDepositCap']

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

  get globalNetDepositAmount(): BigNumber | undefined {
    return this.getGlobalNetDepositAmount()?.[0]
  }

  get globalNetDepositCap(): BigNumber | undefined {
    return this.getGlobalNetDepositCap()?.[0]
  }
}
