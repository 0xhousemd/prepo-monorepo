import { BigNumber } from 'ethers'
import { configure } from 'mobx'
import { ThemeModes } from 'prepo-ui/src/themes/themes.types'
import { initializeStore } from './src/context/initializeStore'

jest.mock('antd/lib/notification')
jest.mock('./src/stores/MarketStore')
jest.mock('./src/stores/MediaQueryStore', () => ({
  MediaQueryStore: class {
    // eslint-disable-next-line class-methods-use-this
    get systemThemeMode(): ThemeModes {
      return ThemeModes.Light
    }
  },
}))

// This is needed to be able to mock mobx @computed properties on a class
configure({ safeDescriptors: false })

const rootStore = initializeStore()

const signerAddressMock = '0x1234000000000000000000000000000000000000'
const signerBalance = BigNumber.from(10)

jest.spyOn(rootStore.web3Store, 'signerState', 'get').mockReturnValue({
  address: signerAddressMock,
  balance: signerBalance,
})

jest.spyOn(rootStore.preCTTokenStore, 'decimals').mockReturnValue([18])
jest.spyOn(rootStore.baseTokenStore, 'decimals').mockReturnValue([18])

global.rootStore = rootStore
