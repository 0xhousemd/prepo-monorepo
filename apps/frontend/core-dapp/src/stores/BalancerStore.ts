import { BigNumber } from 'ethers'
import { SupportedNetworks } from 'prepo-constants'
import { getContractAddress } from 'prepo-utils'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import addDays from 'date-fns/fp/addDays'
import addSeconds from 'date-fns/fp/addSeconds'
import isBefore from 'date-fns/isBefore'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { BalancerQueriesAbi__factory } from '../../generated/typechain'
import { supportedContracts } from '../lib/supported-contracts'
import { DateTimeInMs } from '../utils/date-types'

const wstEthWethBalancerPoolIdByNetwork: Partial<Record<SupportedNetworks, string>> = {
  arbitrumOne: '0x36bf227d6bac96e2ab1ebb5492ecec69c691943f000200000000000000000316',
}

const getNextCallMinimumTime = addSeconds(3)
const getTradeDeadlineFromDate = addDays(1)

export class BalancerStore {
  private readonly balancerQueriesInterface = BalancerQueriesAbi__factory.createInterface()
  private wstEthPriceInEthBN: BigNumber | undefined = undefined
  private lastCalled: DateTimeInMs = 0 as DateTimeInMs

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this)

    reaction(
      () => root.web3Store.blockNumber,
      async () => {
        const { wstEthDecimals, wstEthPriceInEthBN } = this

        if (wstEthDecimals === undefined) return

        if (
          wstEthPriceInEthBN !== undefined &&
          isBefore(Date.now(), getNextCallMinimumTime(this.lastCalled))
        )
          return

        this.lastCalled = Date.now() as DateTimeInMs

        try {
          const oneWstEth = BigNumber.from(10).pow(wstEthDecimals)
          const wstEthPriceInEth = await this.quoteWstEthAmountInEth(oneWstEth)
          if (wstEthPriceInEth !== undefined) {
            runInAction(() => {
              this.wstEthPriceInEthBN = wstEthPriceInEth
            })
          }
        } catch (e: unknown) {
          console.error('Failed to fetch wstETH price', e)
        }
      }
    )
  }

  /**
   * Converts a wstETH amount to ETH using the base rate from Balancer, which
   * is updated periodically. This function is useful for displaying the user
   * balance in ETH.
   *
   * Unlike {@link quoteWstEthAmountInEth}, this function doesn't account for
   * price impact. For example, the value of 1,000 wstETH may be 1,200 ETH.
   * However, if there's not enough liquidity in balancer, the actual swap will
   * net less than 1,200 ETH. If we want to show an accurate estimate of how
   * much tokens will the user receive when withdrawing, we should use
   * {@link quoteWstEthAmountInEth} instead.
   */
  getWstEthAmountInEth(wstEthAmount: BigNumber): BigNumber | undefined {
    const { wstEthDecimals, wstEthPriceInEthBN } = this
    if (wstEthDecimals === undefined) return undefined
    return wstEthPriceInEthBN?.mul(wstEthAmount).div(BigNumber.from(10).pow(wstEthDecimals))
  }

  /**
   * Converts a ETH amount to wstETH using the base rate from Balancer, which
   * is updated periodically. This function is useful for processing a user
   * input, which is entered in ETH, and operating with it.
   *
   * Unlike {@link quoteEthAmountInWstEth}, this function doesn't account for
   * price impact. For example, the value of 1,000 ETH may be 800 wstETH.
   * However, if there's not enough liquidity in balancer, the actual swap will
   * net less than 800 wstETH. If we want to show an accurate estimate of how
   * much tokens will the user receive when depositing, we should use
   * {@link quoteEthAmountInWstEth} instead.
   */
  getEthAmountInWstEth(ethAmount: BigNumber): BigNumber | undefined {
    const { wstEthDecimals, wstEthPriceInEthBN } = this
    if (wstEthDecimals === undefined || wstEthPriceInEthBN === undefined) return undefined
    return ethAmount.mul(BigNumber.from(10).pow(wstEthDecimals)).div(wstEthPriceInEthBN)
  }

  /**
   * Makes a call to the wstETH/ETH Balancer pool to determine how much ETH will
   * be received for the given wstETH.
   *
   * Since this function makes an asynchronous call, it is not practical to use
   * it to show every balance. To estimate the value of a wstETH balance without
   * accounting for price impact, use {@link getWstEthAmountInEth}.
   */
  quoteWstEthAmountInEth(wstEthAmount: BigNumber): Promise<BigNumber | undefined> {
    const { wethAddress, wstEthAddress } = this

    if (wethAddress === undefined || wstEthAddress === undefined) return Promise.resolve(undefined)

    return this.quote({
      amount: wstEthAmount,
      assetIn: wstEthAddress,
      assetOut: wethAddress,
    })
  }

  /**
   * Makes a call to the wstETH/ETH Balancer pool to determine how much wstETH
   * will be received for the given ETH.
   *
   * Since this function makes an asynchronous call, it is not practical to use
   * it to parse user inputs. To estimate the value of a ETH balance without
   * accounting for price impact, use {@link getEthAmountInWstEth}.
   */
  quoteEthAmountInWstEth(ethAmount: BigNumber): Promise<BigNumber | undefined> {
    const { wethAddress, wstEthAddress } = this

    if (wethAddress === undefined || wstEthAddress === undefined) return Promise.resolve(undefined)

    return this.quote({
      amount: ethAmount,
      assetIn: wethAddress,
      assetOut: wstEthAddress,
    })
  }

  private async quote({
    amount,
    assetIn,
    assetOut,
  }: {
    amount: BigNumber
    assetIn: string
    assetOut: string
  }): Promise<BigNumber | undefined> {
    if (amount.eq(0)) {
      return Promise.resolve(BigNumber.from(0))
    }

    const { balancerQueriesInterface, balancerQueriesAddress, wstEthWethBalancerPoolId } = this
    const { coreProvider } = this.root.web3Store

    if (wstEthWethBalancerPoolId === undefined) return undefined

    const data = balancerQueriesInterface.encodeFunctionData('querySwap', [
      {
        amount,
        assetIn,
        assetOut,
        kind: 0, // Given in (amount = assetIn)
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

  private get wstEthDecimals(): number | undefined {
    const { decimalsNumber } = this.root.baseTokenStore
    return decimalsNumber
  }

  private get wethAddress(): string | undefined {
    const { address } = this.root.wethStore
    return address
  }

  private get wstEthWethBalancerPoolId(): string | undefined {
    const { network } = this.root.web3Store
    return wstEthWethBalancerPoolIdByNetwork[network.name]
  }

  /*
   * Generates a timestamp to mark the deadline of a trade. This timestamp is
   * submitted to the blockchain, and if the transaction confirms after it, the
   * trade reverts.
   */
  static getTradeDeadline(): BigNumber {
    return BigNumber.from(getTradeDeadlineFromDate(Date.now()).getTime()).div(1000)
  }
}
