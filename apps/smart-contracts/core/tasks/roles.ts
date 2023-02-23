/* eslint-disable no-console */
import { task } from 'hardhat/config'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import { ProdCore } from '../harnesses/prod'

const { getDefenderAdminClient } = utils

task(
  'transfer-roles-to-governance',
  'Submits proposals for governance to accept granted roles and ownership nominations'
).setAction(async (args, hre) => {
  const { ethers, getChainId, upgrades } = hre
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  const core = await ProdCore.Instance.init(ethers, currentNetwork)
  const signer = (await ethers.getSigners())[0]
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  console.log('Granting roles to governance...')
  await core.grantRolesForProdStack(signer, governanceAddress)
  console.log('Transferring ownership to governance...')
  await core.transferOwnershipForProdStack(signer, governanceAddress)
  console.log('Transferring ProxyAdmin ownership to governance...')
  await upgrades.admin.transferProxyAdminOwnership(governanceAddress)
  const defenderClient = await getDefenderAdminClient(currentChain)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const defenderNetworkName = currentNetwork.defenderName as any
  const acceptRoleSteps = core.getAcceptRoleStepsForProdStack(currentNetwork)
  const acceptOwnershipSteps = core.getAcceptOwnershipStepsForProdStack(currentNetwork)
  console.log(
    `Submitting proposal for governance to accept ${acceptRoleSteps.length} granted roles and ${acceptOwnershipSteps.length} ownership nominations...`
  )
  // TODO add steps for DepositRecord bypass list and allowedMsgSenders
  await defenderClient.createProposal({
    contract: [
      {
        address: core.collateral.address,
        name: DEPLOYMENT_NAMES.preUSDC.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('Collateral').abi.toString(),
      },
      {
        address: core.depositRecord.address,
        name: DEPLOYMENT_NAMES.preUSDC.depositRecord.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('DepositRecord').abi.toString(),
      },
      {
        address: core.depositRecord.allowedMsgSenders.address,
        name: DEPLOYMENT_NAMES.preUSDC.depositRecord.allowedMsgSenders.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('AccountList').abi.toString(),
      },
      {
        address: core.depositRecord.bypasslist.address,
        name: DEPLOYMENT_NAMES.preUSDC.depositRecord.bypasslist.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('AccountList').abi.toString(),
      },
      {
        address: core.collateral.depositHook.address,
        name: DEPLOYMENT_NAMES.preUSDC.depositHook.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('DepositHook').abi.toString(),
      },
      {
        address: core.collateral.withdrawHook.address,
        name: DEPLOYMENT_NAMES.preUSDC.withdrawHook.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('WithdrawHook').abi.toString(),
      },
      {
        address: core.collateral.managerWithdrawHook.address,
        name: DEPLOYMENT_NAMES.preUSDC.managerWithdrawHook.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('ManagerWithdrawHook').abi.toString(),
      },
      {
        address: core.tokenSender.address,
        name: DEPLOYMENT_NAMES.tokenSender.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('TokenSender').abi.toString(),
      },
      {
        address: core.tokenSender.allowedMsgSenders.address,
        name: DEPLOYMENT_NAMES.tokenSender.allowedMsgSenders.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('AccountList').abi.toString(),
      },
      {
        address: core.tokenSender.fixedPrice.address,
        name: DEPLOYMENT_NAMES.tokenSender.fixedPrice.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('FixedUintValue').abi.toString(),
      },
      {
        address: core.marketFactory.address,
        name: DEPLOYMENT_NAMES.prePOMarketFactory.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('PrePOMarketFactory').abi.toString(),
      },
      {
        address: core.arbitrageBroker.address,
        name: DEPLOYMENT_NAMES.arbitrageBroker.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('ArbitrageBroker').abi.toString(),
      },
      {
        address: core.depositTradeHelper.address,
        name: DEPLOYMENT_NAMES.depositTradeHelper.name,
        network: defenderNetworkName,
        abi: hre.artifacts.readArtifactSync('DepositTradeHelper').abi.toString(),
      },
    ],
    title: `Accept Core Granted Roles & Ownership Nominations as Governance`,
    description: `
        Governance will accept ${acceptRoleSteps.length} roles and ${acceptOwnershipSteps.length} ownership nominations.
      `,
    type: 'batch',
    via: governanceAddress,
    viaType: 'Gnosis Safe',
    // metadata is a required field, but can be blank
    metadata: {},
    steps: acceptRoleSteps.concat(acceptOwnershipSteps),
  })
})

task('revoke-roles-from-deployer', 'Revokes all roles from the deployer').setAction(
  async (args, hre) => {
    const { ethers, getChainId } = hre
    const currentChain = Number(await getChainId()) as ChainId
    const currentNetwork = getNetworkByChainId(currentChain)
    const core = await ProdCore.Instance.init(ethers, currentNetwork)
    const signer = (await ethers.getSigners())[0]
    const governanceAddress = getPrePOAddressForNetwork(
      'GOVERNANCE',
      currentNetwork.name,
      process.env.GOVERNANCE
    )
    console.log(signer.address)
    const contractsGovernanceIsNotDefaultAdminFor =
      await core.getProdStackContractsAccountIsNotDefaultAdminFor(governanceAddress)
    if (contractsGovernanceIsNotDefaultAdminFor.length > 0) {
      const contractAddresses: string[] = []
      contractsGovernanceIsNotDefaultAdminFor.forEach((contract) => {
        contractAddresses.push(contract.address)
      })
      throw new Error(
        `Governance is not the default admin for the following contracts: ${contractAddresses}`
      )
    }
    const defenderClient = await getDefenderAdminClient(currentChain)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const defenderNetworkName = currentNetwork.defenderName as any
    const revokeRoleSteps = core.getRevokeRoleStepsForProdStack(currentNetwork, signer.address)
    console.log(
      `Submitting proposal for governance to revoke ${revokeRoleSteps.length} roles from ${signer.address}`
    )
    await defenderClient.createProposal({
      contract: [
        {
          address: core.collateral.address,
          name: DEPLOYMENT_NAMES.preUSDC.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('Collateral').abi.toString(),
        },
        {
          address: core.depositRecord.address,
          name: DEPLOYMENT_NAMES.preUSDC.depositRecord.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('DepositRecord').abi.toString(),
        },
        {
          address: core.collateral.depositHook.address,
          name: DEPLOYMENT_NAMES.preUSDC.depositHook.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('DepositHook').abi.toString(),
        },
        {
          address: core.collateral.withdrawHook.address,
          name: DEPLOYMENT_NAMES.preUSDC.withdrawHook.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('WithdrawHook').abi.toString(),
        },
        {
          address: core.collateral.managerWithdrawHook.address,
          name: DEPLOYMENT_NAMES.preUSDC.managerWithdrawHook.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('ManagerWithdrawHook').abi.toString(),
        },
        {
          address: core.tokenSender.address,
          name: DEPLOYMENT_NAMES.tokenSender.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('TokenSender').abi.toString(),
        },
        {
          address: core.marketFactory.address,
          name: DEPLOYMENT_NAMES.prePOMarketFactory.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('PrePOMarketFactory').abi.toString(),
        },
        {
          address: core.arbitrageBroker.address,
          name: DEPLOYMENT_NAMES.arbitrageBroker.name,
          network: defenderNetworkName,
          abi: hre.artifacts.readArtifactSync('ArbitrageBroker').abi.toString(),
        },
      ],
      title: `Revoke Roles From Deployer`,
      description: `
          Governance will revoke ${revokeRoleSteps.length} roles from the deployer.
        `,
      type: 'batch',
      via: governanceAddress,
      viaType: 'Gnosis Safe',
      // metadata is a required field, but can be blank
      metadata: {},
      steps: revokeRoleSteps,
    })
  }
)
