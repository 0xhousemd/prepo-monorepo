import { makeAutoObservable } from 'mobx'

export class DebugStore {
  overrideFinalLongPayout: number | undefined = undefined
  constructor() {
    makeAutoObservable(this)
  }
}
