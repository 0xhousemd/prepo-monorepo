import { getPrePOAddressForNetwork, Network } from 'prepo-constants'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Base } from './base'
import { ERC20AttachFixture } from '../test/fixtures/ERC20Fixture'
import { CollateralWithHooks, MarketWithHooks } from '../types'
import { DepositRecord, ERC20, PrePOMarketFactory, TokenSender } from '../types/generated'

export class ProdCore extends Base {
  private static _instance: ProdCore
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20
  public rewardToken: ERC20
  public collateral: CollateralWithHooks
  public depositRecord: DepositRecord
  public tokenSender: TokenSender
  public marketFactory?: PrePOMarketFactory
  public markets?: {
    [suffix: string]: MarketWithHooks
  }

  public static get Instance(): ProdCore {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(ethers: HardhatEthersHelpers, currentNetwork: Network): Promise<ProdCore> {
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    const usdcAddress = getPrePOAddressForNetwork('USDC', currentNetwork.name, process.env.USDC)
    this.baseToken = await ERC20AttachFixture(ethers, usdcAddress)
    this.rewardToken = await ethers.getContract('PPO')
    this.collateral = await ethers.getContract('preUSDC')
    this.collateral.depositHook = await ethers.getContract('preUSDC-DepositHook')
    this.collateral.depositHook.allowlist = await ethers.getContract(
      'preUSDC-DepositHook-Allowlist'
    )
    this.collateral.withdrawHook = await ethers.getContract('preUSDC-WithdrawHook')
    this.collateral.managerWithdrawHook = await ethers.getContract('preUSDC-ManagerWithdrawHook')
    this.depositRecord = await ethers.getContract('preUSDC-DepositRecord')
    this.tokenSender = await ethers.getContract('TokenSender')
    this.markets = {}
    return this
  }
}
