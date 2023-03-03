import { BigNumber } from 'ethers'
import { ContractStore } from 'prepo-stores'
import { makeError } from 'prepo-utils'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { DepositTradeHelperAbi, DepositTradeHelperAbi__factory } from '../../generated/typechain'

type WrapAndDeposit = DepositTradeHelperAbi['functions']['wrapAndDeposit']

export class DepositTradeHelperStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'DEPOSIT_TRADE_HELPER', DepositTradeHelperAbi__factory)
  }

  async wrapAndDeposit(
    recipient: string,
    value: BigNumber
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tx = await this.sendTransaction<WrapAndDeposit>('wrapAndDeposit', [recipient], {
        value,
      })
      await tx.wait()
      return { success: true }
    } catch (e) {
      return { success: false, error: makeError(e).message }
    }
  }
}
