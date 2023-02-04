/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { deployNonUpgradeableContract } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'

dotenv.config({
  path: '../.env',
})

const deployFunction: DeployFunction = async function deployTokenSender(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const ppoAddress = getPrePOAddressForNetwork('PPO', currentNetwork.name, process.env.PPO)
  await deployNonUpgradeableContract(
    'TokenSender',
    DEPLOYMENT_NAMES.tokenSender.name,
    [ppoAddress],
    hre
  )
}

export default deployFunction

deployFunction.tags = ['TokenSender']
