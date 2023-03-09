import { makeAutoObservable } from 'mobx'
import { BigNumber } from 'ethers'
import { parseUnits } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class AdvancedSettingsStore {
  root: RootStore
  private readonly _priceImpactTolerance = 1 / 100
  private readonly _slippage = 0.05 / 100

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get slippage(): number {
    return this._slippage
  }

  isPriceImpactTooHigh(priceImpact: number): boolean {
    return priceImpact >= this._priceImpactTolerance
  }

  /*
   * Given an amount, returns the minimum amount to be received when accounting
   * for slippage. This is the amount that is sent to the blockchain. The user
   * may receive more than this amount, but if they receive less, the trade
   * reverts.
   */
  getAmountAfterSlippage(amount: BigNumber): BigNumber {
    const { slippage } = this

    const percent = parseUnits((1 - slippage).toString(), 18)
    if (percent === undefined) return amount

    return amount.mul(percent).div(BigNumber.from(10).pow(18))
  }
}
