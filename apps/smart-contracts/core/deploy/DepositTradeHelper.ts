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

const deployFunction: DeployFunction = async function deployDepositTradeHelper(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { getChainId } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const existingCollateral = await hre.ethers.getContract(DEPLOYMENT_NAMES.preUSDC.name)
  const swapRouterAddress = getPrePOAddressForNetwork(
    'UNIV3_SWAP_ROUTER',
    currentNetwork.name,
    process.env.UNIV3_SWAP_ROUTER
  )
  await deployNonUpgradeableContract(
    'DepositTradeHelper',
    DEPLOYMENT_NAMES.depositTradeHelper.name,
    [existingCollateral.address, swapRouterAddress],
    hre
  )
}

export default deployFunction

deployFunction.dependencies = ['Collateral']

deployFunction.tags = ['DepositTradeHelper']
