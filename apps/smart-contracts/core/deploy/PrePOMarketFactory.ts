/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { FormatTypes, getContractAddress } from 'ethers/lib/utils'
import { fromChainId } from 'defender-base-client'
import { TransactionResponse } from '@ethersproject/providers'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, getDefenderAdminClient } = utils

const deployFunction: DeployFunction = async function deployPrePOMarketFactory({
  deployments,
  getChainId,
  ethers,
  upgrades,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { save, getOrNull, getArtifact } = deployments
  const deployer = (await ethers.getSigners())[0]
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  console.log(
    `Running PrePOMarketFactory deployment script against ${currentNetwork.name} with ${deployer.address} as the deployer`
  )
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)
  const prePOMarketFactoryFactory = await ethers.getContractFactory('PrePOMarketFactory')
  const deploymentName = DEPLOYMENT_NAMES.prePOMarketFactory.name
  const existingDeployment = await getOrNull(deploymentName)
  if (!existingDeployment) {
    console.log('Existing deployment not detected, deploying new contract')
    const newDeployment = await upgrades.deployProxy(prePOMarketFactoryFactory, [])
    console.log('Deployed', deploymentName, 'at', newDeployment.address)
    const deploymentReceipt = await newDeployment.deployTransaction.wait()
    const prePOMarketFactoryArtifact = await getArtifact('PrePOMarketFactory')
    await save(deploymentName, {
      abi: prePOMarketFactoryArtifact.abi,
      address: newDeployment.address,
      receipt: deploymentReceipt,
    })
  } else {
    console.log('Existing deployment detected, upgrading contract')
    const upgradeResponse = (await upgrades.prepareUpgrade(
      existingDeployment.address,
      prePOMarketFactoryFactory,
      {
        getTxResponse: true,
      }
    )) as TransactionResponse
    const newImplAddress = getContractAddress(upgradeResponse)
    const upgradeReceipt = await upgradeResponse.wait()
    const defenderClient = getDefenderAdminClient(currentChain)
    const upgradeProposal = await defenderClient.proposeUpgrade(
      {
        title: `${deploymentName} Upgrade`,
        description: `${deploymentName} Upgrade Proposal`,
        proxyAdmin: (await upgrades.admin.getInstance()).address,
        newImplementation: newImplAddress,
      },
      {
        address: existingDeployment.address,
        network: fromChainId(currentChain),
        abi: prePOMarketFactoryFactory.interface.format(FormatTypes.json) as string,
      }
    )
    console.log(`${deploymentName} Upgrade Receipt:`, upgradeResponse)
    const prePOMarketFactoryArtifact = await getArtifact('PrePOMarketFactory')
    await save(deploymentName, {
      abi: prePOMarketFactoryArtifact.abi,
      address: upgradeProposal.contract.address,
      receipt: upgradeReceipt,
    })
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['PrePOMarketFactory']
