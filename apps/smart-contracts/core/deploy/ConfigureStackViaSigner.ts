/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, PERCENT_DENOMINATOR } from 'prepo-constants'
import { deployNonUpgradeableContract } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { ProdCore } from '../harnesses/prod'

dotenv.config({
  path: '../.env',
})

const deployFunction: DeployFunction = async function configureStackViaSigner(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { ethers, getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const core = await ProdCore.Instance.init(ethers, currentNetwork)
  const signer = (await ethers.getSigners())[0]
  await core.assignRolesForProdStack(signer, signer)
  /**
   * Deployment of account lists must be kept out of the shared
   * configuration helper code since deployment code must run
   * within a hardhat-deploy deployment script.
   */
  if (core.depositRecord.allowedMsgSenders == null) {
    await deployNonUpgradeableContract(
      'AccountList',
      DEPLOYMENT_NAMES.preUSDC.depositRecord.allowedMsgSenders.name,
      [],
      hre
    )
    core.depositRecord.allowedMsgSenders = await ethers.getContract(
      DEPLOYMENT_NAMES.preUSDC.depositRecord.allowedMsgSenders.name
    )
  }
  if (core.depositRecord.bypasslist == null) {
    await deployNonUpgradeableContract(
      'AccountList',
      DEPLOYMENT_NAMES.preUSDC.depositRecord.bypasslist.name,
      [],
      hre
    )
    core.depositRecord.bypasslist = await ethers.getContract(
      DEPLOYMENT_NAMES.preUSDC.depositRecord.bypasslist.name
    )
  }
  if (core.tokenSender.allowedMsgSenders == null) {
    await deployNonUpgradeableContract(
      'AccountList',
      DEPLOYMENT_NAMES.tokenSender.allowedMsgSenders.name,
      [],
      hre
    )
    core.tokenSender.allowedMsgSenders = await ethers.getContract(
      DEPLOYMENT_NAMES.tokenSender.allowedMsgSenders.name
    )
  }
  /**
   * Modify this object to configure the stack. Defining parameters for
   * the stack as a modifiable literal makes it easier for the deployer
   * to understand what they are configuring and what needs configuring.
   *
   * Values not provided will be ignored.
   */
  const deploymentParameters = {
    collateral: {
      manager: signer.address,
      depositFee: 0,
      withdrawFee: 0,
      collateralizationFactor: PERCENT_DENOMINATOR,
    },
    depositHook: {
      depositsAllowed: true,
      treasury: signer.address,
    },
    withdrawHook: {
      withdrawalsAllowed: true,
      globalPeriodLength: 0,
      userPeriodLength: 0,
      globalWithdrawLimitPerPeriod: 0,
      userWithdrawLimitPerPeriod: 0,
    },
    managerWithdrawHook: {
      minReservePercentage: 0,
    },
    depositRecord: {
      globalNetDepositCap: 0,
      userDepositCap: 0,
      allowedMsgSenders: [
        core.collateral.depositHook.address,
        core.collateral.withdrawHook.address,
      ],
      bypasslist: [],
    },
    tokenSender: {
      fixedPrice: 0,
      priceMultiplier: 0,
      scaledPriceLowerBound: 0,
      allowedMsgSenders: [
        core.collateral.depositHook.address,
        core.collateral.withdrawHook.address,
      ],
    },
  }
  console.log('Configuring Collateral via Signer...')
  await core.configureCollateralViaSigner(
    signer,
    deploymentParameters.collateral.manager,
    deploymentParameters.collateral.depositFee,
    deploymentParameters.collateral.withdrawFee,
    deploymentParameters.collateral.collateralizationFactor
  )
  console.log('Configuring DepositHook via Signer...')
  await core.configureDepositHookViaSigner(
    signer,
    deploymentParameters.depositHook.depositsAllowed,
    deploymentParameters.depositHook.treasury
  )
  console.log('Configuring WithdrawHook via Signer...')
  await core.configureWithdrawHookViaSigner(
    signer,
    deploymentParameters.withdrawHook.withdrawalsAllowed,
    deploymentParameters.withdrawHook.globalPeriodLength,
    deploymentParameters.withdrawHook.userPeriodLength,
    deploymentParameters.withdrawHook.globalWithdrawLimitPerPeriod,
    deploymentParameters.withdrawHook.userWithdrawLimitPerPeriod
  )
  console.log('Configuring ManagerWithdrawHook via Signer...')
  await core.configureManagerWithdrawHookViaSigner(
    signer,
    deploymentParameters.managerWithdrawHook.minReservePercentage
  )
  console.log('Configuring DepositRecord via Signer...')
  await core.configureDepositRecordViaSigner(
    // TODO update this to add allowedMsgSenders and bypass allowlist
    signer,
    deploymentParameters.depositRecord.globalNetDepositCap,
    deploymentParameters.depositRecord.userDepositCap,
    deploymentParameters.depositRecord.allowedMsgSenders,
    deploymentParameters.depositRecord.bypasslist
  )
  console.log('Configuring TokenSender via Signer...')
  await core.configureTokenSenderViaSigner(
    signer,
    deploymentParameters.tokenSender.fixedPrice,
    deploymentParameters.tokenSender.priceMultiplier,
    deploymentParameters.tokenSender.scaledPriceLowerBound,
    deploymentParameters.tokenSender.allowedMsgSenders
  )
  console.log('Configuring PrePOMarketFactory via Signer...')
  await core.configurePrePOMarketFactoryViaSigner(signer)
}

export default deployFunction

deployFunction.dependencies = [
  'Collateral',
  'DepositHook',
  'DepositRecord',
  'FixedUintValue',
  'ManagerWithdrawHook',
  'PrePOMarketFactory',
  'TokenSender',
  'WithdrawHook',
]

deployFunction.tags = ['ConfigureStackViaSigner']
