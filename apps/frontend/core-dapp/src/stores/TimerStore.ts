import { makeAutoObservable, runInAction } from 'mobx'
import { SEC_IN_MS } from 'prepo-constants'

export class TimerStore {
  now = new Date()
  constructor() {
    makeAutoObservable(this)

    // Don't run on tests because leaving an open interval would prevent tests from exiting.
    if (process.env.NODE_ENV !== 'test') {
      this.syncNowEverySec()
    }
  }

  get nowInMs(): number {
    return this.now.getTime()
  }

  get nowInSec(): number {
    return parseInt(`${this.nowInMs / SEC_IN_MS}`, 10)
  }

  private syncNowEverySec(): void {
    setInterval(() => {
      runInAction(() => {
        this.now = new Date()
      })
    }, SEC_IN_MS)
  }
}
