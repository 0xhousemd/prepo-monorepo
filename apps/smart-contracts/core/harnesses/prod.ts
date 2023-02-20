import { DEPLOYMENT_NAMES, getPrePOAddressForNetwork, Network } from 'prepo-constants'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { sendTxAndWait } from 'prepo-hardhat'
import { Base } from './base'
import { ERC20AttachFixture } from '../test/fixtures/ERC20Fixture'
import {
  ExtendedCollateral,
  ExtendedDepositRecord,
  ExtendedTokenSender,
  ExtendedMarket,
} from '../types'
import { ArbitrageBroker, DepositTradeHelper, ERC20, PrePOMarketFactory } from '../types/generated'
import { roleAssigners } from '../helpers'

export class ProdCore extends Base {
  private static _instance: ProdCore
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20
  public rewardToken: ERC20
  public collateral: ExtendedCollateral
  public depositRecord: ExtendedDepositRecord
  public tokenSender: ExtendedTokenSender
  public marketFactory: PrePOMarketFactory
  public arbitrageBroker?: ArbitrageBroker
  public depositTradeHelper?: DepositTradeHelper
  public markets?: {
    [suffix: string]: ExtendedMarket
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
    const ppoAddress = getPrePOAddressForNetwork('PPO', currentNetwork.name, process.env.PPO)
    this.rewardToken = await ERC20AttachFixture(ethers, ppoAddress)
    this.collateral = await ethers.getContract(DEPLOYMENT_NAMES.preUSDC.name)
    this.collateral.depositHook = await ethers.getContract(
      DEPLOYMENT_NAMES.preUSDC.depositHook.name
    )
    this.collateral.withdrawHook = await ethers.getContract(
      DEPLOYMENT_NAMES.preUSDC.withdrawHook.name
    )
    this.collateral.managerWithdrawHook = await ethers.getContract(
      DEPLOYMENT_NAMES.preUSDC.managerWithdrawHook.name
    )
    this.depositRecord = await ethers.getContract(DEPLOYMENT_NAMES.preUSDC.depositRecord.name)
    this.depositRecord.allowedMsgSenders = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preUSDC.depositRecord.allowedMsgSenders.name
    )
    this.depositRecord.bypasslist = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preUSDC.depositRecord.bypasslist.name
    )
    this.tokenSender = await ethers.getContract(DEPLOYMENT_NAMES.tokenSender.name)
    this.tokenSender.allowedMsgSenders = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.tokenSender.allowedMsgSenders.name
    )
    this.tokenSender.fixedPrice = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.tokenSender.fixedPrice.name
    )
    this.marketFactory = await ethers.getContract(DEPLOYMENT_NAMES.prePOMarketFactory.name)
    this.arbitrageBroker = await ethers.getContractOrNull(DEPLOYMENT_NAMES.arbitrageBroker.name)
    this.depositTradeHelper = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.depositTradeHelper.name
    )
    this.markets = {}
    return this
  }

  public async assignRolesForProdStack(
    rootAdmin: SignerWithAddress,
    nominee: SignerWithAddress
  ): Promise<void> {
    await this.assignRolesForBaseStack(rootAdmin, nominee)
    await roleAssigners.assignPrePOMarketFactoryRoles(rootAdmin, nominee, this.marketFactory)
    await roleAssigners.assignArbitrageBrokerRoles(rootAdmin, nominee, this.arbitrageBroker)
  }

  public async configurePrePOMarketFactoryViaSigner(signer: SignerWithAddress): Promise<void> {
    await sendTxAndWait(
      await this.marketFactory.connect(signer).setCollateralValidity(this.collateral.address, true)
    )
  }
}
