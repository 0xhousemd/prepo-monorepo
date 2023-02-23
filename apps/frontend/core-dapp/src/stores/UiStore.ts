import { message } from 'antd'
import { makeAutoObservable } from 'mobx'
import { ThemeModes } from 'prepo-ui'
import { RootStore } from './RootStore'
import { Language } from '../types/general.types'

export class UiStore {
  root: RootStore
  showLanguageList = false
  accountModalOpen = false
  message: typeof message
  modalHeight: number | undefined
  maxScreenHeight = 0
  disableMocks = true // TODO: REMOVE
  historyComingSoon = true

  constructor(root: RootStore) {
    this.root = root
    this.message = message
    makeAutoObservable(this)
  }

  get selectedTheme(): ThemeModes {
    return (
      this.root.localStorageStore.storage.forcedTheme ?? this.root.mediaQueryStore.systemThemeMode
    )
  }

  get selectedLanguage(): Language | undefined {
    return this.root.localStorageStore.storage.language
  }

  setShowLanguageList(show: boolean): void {
    this.showLanguageList = show
  }

  setTheme = (selectedTheme: ThemeModes): void => {
    if (selectedTheme === this.root.mediaQueryStore.systemThemeMode) {
      this.root.localStorageStore.storage.forcedTheme = undefined
    } else {
      this.root.localStorageStore.storage.forcedTheme = selectedTheme
    }
  }

  setLanguage = (lang: Language): void => {
    this.root.localStorageStore.storage.language = lang
  }

  setAccountModalOpen(value: boolean): void {
    this.accountModalOpen = value
  }

  setMaxScreenHeight(height: number): void {
    this.maxScreenHeight = height
  }

  setModalHeight(height: number): void {
    const modalTitleHeightPixelsPlusPaddings = 100
    const modalHeight = height + modalTitleHeightPixelsPlusPaddings
    const seventyPercentOfMaxScreenHeight = this.maxScreenHeight * 0.7

    this.modalHeight =
      modalHeight > seventyPercentOfMaxScreenHeight ? seventyPercentOfMaxScreenHeight : modalHeight
  }
}
