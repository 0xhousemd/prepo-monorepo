import { BigNumber, utils } from 'ethers'
import { SupportedNetworks } from 'prepo-constants'
import { getContractAddress } from 'prepo-utils'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import addSeconds from 'date-fns/fp/addSeconds'
import isBefore from 'date-fns/isBefore'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { BalancerQueriesAbi__factory } from '../../generated/typechain'
import { supportedContracts } from '../lib/supported-contracts'
import { DateTimeInMs } from '../utils/date-types'

const wethAddressByNetwork: Partial<Record<SupportedNetworks, string>> = {
  arbitrumOne: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
}

const WETH_DECIMALS = 18

const wstEthWethBalancerPoolIdByNetwork: Partial<Record<SupportedNetworks, string>> = {
  arbitrumOne: '0x36bf227d6bac96e2ab1ebb5492ecec69c691943f000200000000000000000316',
}

const getNextCallMinimumTime = addSeconds(3)

export class BalancerStore {
  private readonly balancerQueriesInterface = BalancerQueriesAbi__factory.createInterface()
  private wstEthPriceInEthBN: BigNumber | undefined = undefined
  private lastCalled: DateTimeInMs = 0 as DateTimeInMs

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this)

    reaction(
      () => root.web3Store.blockNumber,
      async () => {
        const { wstEthPriceInEthBN } = this

        if (
          wstEthPriceInEthBN !== undefined &&
          isBefore(Date.now(), getNextCallMinimumTime(this.lastCalled))
        )
          return

        this.lastCalled = Date.now() as DateTimeInMs

        try {
          const price = await this.getWstEthPrice()
          if (price !== undefined) {
            runInAction(() => {
              this.wstEthPriceInEthBN = price
            })
          }
        } catch (e: unknown) {
          console.error('Failed to fetch wstETH price', e)
        }
      }
    )
  }

  get wstEthPriceInEth(): string | undefined {
    const { wstEthPriceInEthBN } = this
    if (wstEthPriceInEthBN === undefined) return undefined
    return utils.formatUnits(wstEthPriceInEthBN, WETH_DECIMALS)
  }

  private get balancerQueriesAddress(): string | undefined {
    return getContractAddress<SupportedContracts>(
      'BALANCER_QUOTER',
      this.root.web3Store.network.name,
      supportedContracts
    )
  }

  private get wstEthAddress(): string | undefined {
    const { address } = this.root.baseTokenStore
    return address
  }

  private get wethAddress(): string | undefined {
    const { network } = this.root.web3Store
    return wethAddressByNetwork[network.name]
  }

  private get wstEthWethBalancerPoolId(): string | undefined {
    const { network } = this.root.web3Store
    return wstEthWethBalancerPoolIdByNetwork[network.name]
  }

  private async getWstEthPrice(): Promise<BigNumber | undefined> {
    const {
      balancerQueriesInterface,
      balancerQueriesAddress,
      wethAddress,
      wstEthAddress,
      wstEthWethBalancerPoolId,
    } = this
    const { coreProvider } = this.root.web3Store

    if (
      balancerQueriesAddress === undefined ||
      wethAddress === undefined ||
      wstEthAddress === undefined ||
      wstEthWethBalancerPoolId === undefined
    )
      return undefined

    const data = balancerQueriesInterface.encodeFunctionData('querySwap', [
      {
        amount: BigNumber.from(10).pow(18),
        assetIn: wstEthAddress,
        assetOut: wethAddress,
        kind: 1, // Given in
        poolId: wstEthWethBalancerPoolId,
        userData: [],
      },
      {
        sender: '0x0000000000000000000000000000000000000000',
        recipient: '0x0000000000000000000000000000000000000000',
        toInternalBalance: false,
        fromInternalBalance: false,
      },
    ])

    const encodedResponse = await coreProvider.call({
      to: balancerQueriesAddress,
      data,
    })

    const [decodedResponse] = this.balancerQueriesInterface.decodeFunctionResult(
      'querySwap',
      encodedResponse
    )

    return decodedResponse
  }
}
