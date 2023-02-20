import { DEPLOYMENT_NAMES, getPrePOAddressForNetwork, Network } from 'prepo-constants'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { sendTxAndWait, utils } from 'prepo-hardhat'
import { ProposalStep } from 'defender-admin-client/lib/models/proposal'
import { Base } from './base'
import { ERC20AttachFixture } from '../test/fixtures/ERC20Fixture'
import {
  ExtendedCollateral,
  ExtendedDepositRecord,
  ExtendedTokenSender,
  ExtendedMarket,
} from '../types'
import { ArbitrageBroker, DepositTradeHelper, ERC20, PrePOMarketFactory } from '../types/generated'
import { roleAssigners, roleGranters, roleProposalStepGetters } from '../helpers'

const { getAcceptOwnershipSteps } = utils

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

  public async grantRolesForProdStack(
    rootAdmin: SignerWithAddress,
    nomineeAddress: string
  ): Promise<void> {
    await roleGranters.grantCollateralRoles(rootAdmin, nomineeAddress, this.collateral)
    await roleGranters.grantDepositRecordRoles(rootAdmin, nomineeAddress, this.depositRecord)
    await roleGranters.grantDepositHookRoles(rootAdmin, nomineeAddress, this.collateral.depositHook)
    await roleGranters.grantWithdrawHookRoles(
      rootAdmin,
      nomineeAddress,
      this.collateral.withdrawHook
    )
    await roleGranters.grantManagerWithdrawHookRoles(
      rootAdmin,
      nomineeAddress,
      this.collateral.managerWithdrawHook
    )
    await roleGranters.grantTokenSenderRoles(rootAdmin, nomineeAddress, this.tokenSender)
    await roleGranters.grantPrePOMarketFactoryRoles(rootAdmin, nomineeAddress, this.marketFactory)
    await roleGranters.grantArbitrageBrokerRoles(rootAdmin, nomineeAddress, this.arbitrageBroker)
  }

  public getAcceptRoleStepsForProdStack(network: Network): ProposalStep[] {
    return roleProposalStepGetters
      .getCollateralAcceptRoleSteps(network, this.collateral)
      .concat(
        roleProposalStepGetters.getDepositRecordAcceptRoleSteps(network, this.depositRecord),
        roleProposalStepGetters.getDepositHookAcceptRoleSteps(network, this.collateral.depositHook),
        roleProposalStepGetters.getWithdrawHookAcceptRoleSteps(
          network,
          this.collateral.withdrawHook
        ),
        roleProposalStepGetters.getManagerWithdrawHookAcceptRoleSteps(
          network,
          this.collateral.managerWithdrawHook
        ),
        roleProposalStepGetters.getTokenSenderAcceptRoleSteps(network, this.tokenSender),
        roleProposalStepGetters.getPrePOMarketFactoryAcceptRoleSteps(network, this.marketFactory),
        roleProposalStepGetters.getArbitrageBrokerAcceptRoleSteps(network, this.arbitrageBroker)
      )
  }

  public async transferOwnershipForProdStack(
    owner: SignerWithAddress,
    nomineeAddress: string
  ): Promise<void> {
    await sendTxAndWait(
      await this.depositRecord.allowedMsgSenders.connect(owner).transferOwnership(nomineeAddress)
    )
    await sendTxAndWait(
      await this.depositRecord.bypasslist.connect(owner).transferOwnership(nomineeAddress)
    )
    await sendTxAndWait(
      await this.tokenSender.allowedMsgSenders.connect(owner).transferOwnership(nomineeAddress)
    )
    await sendTxAndWait(
      await this.tokenSender.fixedPrice.connect(owner).transferOwnership(nomineeAddress)
    )
    await sendTxAndWait(
      await this.depositTradeHelper.connect(owner).transferOwnership(nomineeAddress)
    )
  }

  public getAcceptOwnershipStepsForProdStack(network: Network): ProposalStep[] {
    return getAcceptOwnershipSteps(network, [
      this.depositRecord.allowedMsgSenders,
      this.depositRecord.bypasslist,
      this.tokenSender.allowedMsgSenders,
      this.tokenSender.fixedPrice,
      this.depositTradeHelper,
    ])
  }
}
