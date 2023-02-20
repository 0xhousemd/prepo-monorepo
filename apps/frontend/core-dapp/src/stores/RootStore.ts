import notification from 'antd/lib/notification'
import { RootStore as PRootStore, LocalStorageStore } from 'prepo-stores'
import { ThemeModes } from 'prepo-ui'
import { UiStore } from './UiStore'
import { MarketStore } from './MarketStore'
import { Erc20Store } from './entities/Erc20.entity'
import { CollateralStore } from './CollateralStore'
import { CurrenciesStore } from './CurrenciesStore'
import { storeConfig } from './utils/stores-config'
import { UniswapRouterStore } from './UniswapRouterStore'
import { CoreGraphStore } from './graphs/CoreGraphStore'
import { TimerStore } from './TimerStore'
import { UniswapV3GraphStore } from './graphs/UniswapV3GraphStore'
import { SwapStore } from './SwapStore'
import { DepositRecordStore } from './DepositRecordStore'
import { TokenSenderStore } from './TokenSenderStore'
import { DelegateStore } from '../features/delegate/DelegateStore'
import { TradeStore } from '../features/trade/TradeStore'
import { AdvancedSettingsStore } from '../components/AdvancedSettingsModal/AdvancedSettingsStore'
import { DepositStore } from '../features/deposit/DepositStore'
import { FilterStore } from '../components/Filter/FilterStore'
import { PROJECT_NAME, USDC_SYMBOL } from '../lib/constants'
import { WithdrawStore } from '../features/withdraw/WithdrawStore'
import { SupportedContracts } from '../lib/contract.types'
import { PortfolioStore } from '../features/portfolio/PortfolioStore'
import { StakeStore } from '../features/ppo/stake/StakeStore'
import { UnstakeStore } from '../features/ppo/stake/UnstakeStore'
import { PpoHistoryStore } from '../features/ppo/history/PpoHistoryStore'
import { Language } from '../types/general.types'
import { PPOStakingStore } from '../features/ppo/stake/PPOStakingStore'

type LocalStorage = {
  isPortfolioVisible: boolean
  selectedTheme: ThemeModes | undefined
  selectedWallet: string | undefined
  language: Language
}

const initLocalStorage: LocalStorage = {
  isPortfolioVisible: true,
  selectedTheme: undefined,
  selectedWallet: undefined,
  language: 'en',
}

export class RootStore extends PRootStore<SupportedContracts> {
  uiStore: UiStore
  localStorageStore: LocalStorageStore<LocalStorage>
  tradeStore: TradeStore
  timerStore: TimerStore
  depositStore: DepositStore
  depositRecordStore: DepositRecordStore
  marketStore: MarketStore
  advancedSettingsStore: AdvancedSettingsStore
  baseTokenStore: Erc20Store
  portfolioStore: PortfolioStore
  preCTTokenStore: CollateralStore
  uniswapRouterStore: UniswapRouterStore
  filterStore: FilterStore
  coreGraphStore: CoreGraphStore
  uniswapV3GraphStore: UniswapV3GraphStore
  withdrawStore: WithdrawStore
  currenciesStore: CurrenciesStore
  delegateStore: DelegateStore
  stakeStore: StakeStore
  ppoStakingStore: PPOStakingStore
  swapStore: SwapStore
  ppoTokenStore: Erc20Store
  ppoHistoryStore: PpoHistoryStore
  tokenSenderStore: TokenSenderStore
  unstakeStore: UnstakeStore

  constructor() {
    super({
      toast: notification,
      storeConfig,
    })

    this.swapStore = new SwapStore(this)
    this.localStorageStore = new LocalStorageStore(this, `prepo.${PROJECT_NAME}`, initLocalStorage)
    this.timerStore = new TimerStore()
    this.uiStore = new UiStore(this)
    this.preCTTokenStore = new CollateralStore(this)
    this.marketStore = new MarketStore(this)
    this.portfolioStore = new PortfolioStore(this)
    this.depositStore = new DepositStore(this)
    this.depositRecordStore = new DepositRecordStore(this)
    this.withdrawStore = new WithdrawStore(this)
    this.tradeStore = new TradeStore(this)
    this.advancedSettingsStore = new AdvancedSettingsStore(this)
    this.baseTokenStore = new Erc20Store({
      root: this,
      tokenName: 'MBT',
      symbolOverride: USDC_SYMBOL,
    })
    this.uniswapRouterStore = new UniswapRouterStore(this)
    this.filterStore = new FilterStore(this)
    this.currenciesStore = new CurrenciesStore(this)
    this.coreGraphStore = new CoreGraphStore(this)
    this.uniswapV3GraphStore = new UniswapV3GraphStore(this)
    this.delegateStore = new DelegateStore(this)
    this.ppoTokenStore = new Erc20Store({ root: this, tokenName: 'PPO', symbolOverride: 'PPO' })
    this.ppoHistoryStore = new PpoHistoryStore(this)
    this.stakeStore = new StakeStore(this)
    this.ppoStakingStore = new PPOStakingStore(this)
    this.tokenSenderStore = new TokenSenderStore(this)
    this.unstakeStore = new UnstakeStore(this)
  }
}
