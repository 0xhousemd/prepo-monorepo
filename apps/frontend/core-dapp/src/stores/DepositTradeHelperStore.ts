import { BigNumber, ethers } from 'ethers'
import { ContractStore } from 'prepo-stores'
import { makeError } from 'prepo-utils'
import addDays from 'date-fns/fp/addDays'
import { formatEther } from 'ethers/lib/utils'
import { RootStore } from './RootStore'
import { BalancerStore } from './BalancerStore'
import { SupportedContracts } from '../lib/contract.types'
import { DepositTradeHelperAbi, DepositTradeHelperAbi__factory } from '../../generated/typechain'

type WrapAndDeposit = DepositTradeHelperAbi['functions']['wrapAndDeposit']
type WithdrawAndUnwrap = DepositTradeHelperAbi['functions']['withdrawAndUnwrap']

const getPermitDeadlineFromDate = addDays(1)
const getPermitDeadline = (): number =>
  Math.floor(getPermitDeadlineFromDate(Date.now()).getTime() / 1000)

export class DepositTradeHelperStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'DEPOSIT_TRADE_HELPER', DepositTradeHelperAbi__factory)
  }

  async wrapAndDeposit(
    recipient: string,
    amountInEth: BigNumber,
    fee: BigNumber
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const amountInWstEth = await this.root.balancerStore.quoteEthAmountInWstEth(
        amountInEth.sub(fee)
      )

      if (amountInWstEth === undefined) {
        return {
          success: false,
          error: 'Failed to fetch the wstETH price.',
        }
      }

      if (this.root.advancedSettingsStore.isPriceImpactTooHigh(amountInWstEth.priceImpact)) {
        return {
          success: false,
          error: "Can't swap to wstETH: price impact too high. Try a smaller amount.",
        }
      }

      const wstEthAfterSlippage = this.root.advancedSettingsStore.getAmountAfterSlippage(
        amountInWstEth.value
      )

      const tx = await this.sendTransaction<WrapAndDeposit>(
        'wrapAndDeposit',
        [
          recipient,
          {
            amountOutMinimum: wstEthAfterSlippage,
            deadline: BalancerStore.getTradeDeadline(),
          },
        ],
        {
          value: amountInEth,
        }
      )
      await tx.wait()
      return { success: true }
    } catch (e) {
      return { success: false, error: makeError(e).message }
    }
  }

  async withdrawAndUnwrap(
    recipient: string,
    amountIn: BigNumber,
    amountOut: BigNumber
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const amountOutMinimum = this.root.advancedSettingsStore.getAmountAfterSlippage(amountOut)
      const { address: wstETHAddress } = this.root.baseTokenStore

      // impossible unless we forgot to set addresses
      if (!wstETHAddress || !recipient || !this.address || !this.contract)
        return { success: false, error: 'Something went wrong' }

      // button should be disabled
      if (!this.root.web3Store.signer?.provider)
        return { success: false, error: 'Wallet not connected.' }

      let permit = {
        deadline: 0,
        v: 0,
        r: ethers.constants.HashZero,
        s: ethers.constants.HashZero,
      }

      if (this.needPermitForWithdrawAndUnwrap) {
        const deadline = getPermitDeadline()
        const signature = await this.root.collateralStore.getPermitSignature(
          this.address,
          ethers.constants.MaxUint256,
          deadline
        )

        if (typeof signature === 'string') return { success: false, error: signature }

        permit = {
          deadline,
          v: signature.v,
          s: signature.s,
          r: signature.r,
        }
      }

      const tx = await this.sendTransaction<WithdrawAndUnwrap>('withdrawAndUnwrap', [
        recipient,
        amountIn,
        permit,
        {
          amountOutMinimum,
          deadline: BalancerStore.getTradeDeadline(),
        },
      ])
      await tx.wait()
      return { success: true }
    } catch (e) {
      return { success: false, error: makeError(e).message }
    }
  }

  get needPermitForWithdrawAndUnwrap(): boolean | undefined {
    return this.root.collateralStore.needToAllowFor(
      formatEther(ethers.constants.MaxUint256),
      'DEPOSIT_TRADE_HELPER'
    )
  }
}
