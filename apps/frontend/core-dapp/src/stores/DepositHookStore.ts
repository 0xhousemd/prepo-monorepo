import { ContractStore } from 'prepo-stores'
import { makeObservable, computed } from 'mobx'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { DepositHookAbi__factory } from '../../generated/typechain/factories/DepositHookAbi__factory'
import { DepositHookAbi } from '../../generated/typechain/DepositHookAbi'

type DepositsAllowed = DepositHookAbi['functions']['depositsAllowed']
type GetTokenSender = DepositHookAbi['functions']['getTokenSender']

export class DepositHookStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(public root: RootStore) {
    super(root, 'DEPOSIT_HOOK', DepositHookAbi__factory)
    makeObservable(this, { depositsAllowed: computed })
  }

  get tokenSender(): string | undefined {
    return this.call<GetTokenSender>('getTokenSender', [])?.[0]
  }

  get depositsAllowed(): boolean | undefined {
    return this.call<DepositsAllowed>('depositsAllowed', [])?.[0]
  }
}
