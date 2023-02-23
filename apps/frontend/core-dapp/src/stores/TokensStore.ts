import { makeAutoObservable } from 'mobx'
import { IconName } from 'prepo-ui'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { RootStore } from './RootStore'
import { Erc20Store } from './entities/Erc20.entity'

type EthToken = {
  type: 'native'
  iconName: 'eth'
  name: string
  shortName?: string
}

type Erc20Token = {
  type: 'erc20'
  iconName: IconName
  name: string
  shortName?: string
  erc20: Erc20Store
}

export type Token = EthToken | Erc20Token

// strategy for instantiating ERC20Store from any arbitrary address:
// - write a function that when given an address, check that the address has `balanceOf` and some important ERC20 values (e.g. decimals)
// - if valid, instantiate an ERC20Store with that address and push into a list of tokens
// - (could be depositTokens or tradeTokens, or even a list shared between deposit/trade tokens)
// - we could even save those validated addresses into localStorage so the next time user come back
// - their favourite token will show in the list by default
export class TokensStore {
  tradeTokens: Token[]
  depositTokens: Token[]
  constructor(private root: RootStore) {
    this.tradeTokens = [
      {
        type: 'erc20',
        iconName: 'cash',
        name: 'Cash Balance',
        shortName: 'USD',
        erc20: this.root.preCTTokenStore,
      },
      {
        type: 'erc20',
        iconName: 'usdc',
        name: 'USDC',
        erc20: this.root.baseTokenStore,
      },
    ]
    this.depositTokens = [
      {
        type: 'native',
        iconName: 'eth',
        name: 'ETH',
        shortName: 'ETH',
      },
      {
        type: 'erc20',
        iconName: 'weth',
        name: 'Wrapped ETH',
        shortName: 'WETH',
        erc20: this.root.baseTokenStore,
      },
    ]
    makeAutoObservable(this)
  }

  getTokenBalanceBN(token: Token): BigNumber | undefined {
    if (token.type === 'native') {
      if (this.root.web3Store.signerState.balance === undefined) return undefined
      return this.root.web3Store.signerState.balance
    }

    return token.erc20.balanceOfSigner
  }

  getTokenBalance(token: Token): string | undefined {
    if (token.type === 'native') {
      if (this.root.web3Store.signerState.balance === undefined) return undefined
      return formatEther(this.root.web3Store.signerState.balance)
    }

    return token.erc20.tokenBalanceFormat
  }

  get sortedTradeTokens(): Token[] {
    return this.tradeTokens.slice().sort((a, b) => {
      const aBalance = this.getTokenBalance(a)
      const bBalance = this.getTokenBalance(b)
      if (aBalance === undefined || bBalance === undefined) return 0
      return +bBalance - +aBalance
    })
  }

  get sortedDepositTokens(): Token[] {
    return this.depositTokens.slice().sort((a, b) => {
      const aBalance = this.getTokenBalance(a)
      const bBalance = this.getTokenBalance(b)
      if (aBalance === undefined || bBalance === undefined) return 0
      return +bBalance - +aBalance
    })
  }

  get defaultDepositToken(): Token | undefined {
    const loadingIndex = this.sortedDepositTokens.findIndex(
      (token) => this.getTokenBalance(token) === undefined
    )
    if (loadingIndex >= 0) return undefined
    return this.sortedDepositTokens[0]
  }
}
