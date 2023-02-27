import { makeAutoObservable } from 'mobx'
import { RootStore } from '../../stores/RootStore'

const ONE_POINT_FIVE_PERCENT = 0.015

export const SLIPPAGE_SETTINGS = {
  INITIAL_SLIPPAGE: ONE_POINT_FIVE_PERCENT,
}

export class AdvancedSettingsStore {
  root: RootStore
  savedSlippage = SLIPPAGE_SETTINGS.INITIAL_SLIPPAGE
  unsavedSlippage?: number

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get slippage(): number {
    return this.unsavedSlippage ?? this.savedSlippage
  }
}
