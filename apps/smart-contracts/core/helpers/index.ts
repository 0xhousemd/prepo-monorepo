import { BigNumber, BigNumberish } from 'ethers'
import {
  BytesLike,
  formatBytes32String,
  getCreate2Address,
  keccak256,
  solidityKeccak256,
} from 'ethers/lib/utils'
import { FEE_DENOMINATOR, USDC_DENOMINATOR, ZERO_ADDRESS } from 'prepo-constants'
import { MockContract } from '@defi-wonderland/smock'
import { formatEther, parseEther } from '@ethersproject/units'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { Create2Address, utils } from 'prepo-hardhat'
import { findMarketAddedEvent, findTransferEvent } from './events'
import { CreateMarketParams, CreateMarketResult } from '../types'
import { Collateral, DepositHook, DepositRecord, ERC20, PrePOMarket } from '../types/generated'

export * from './events'
export * from './roles'
export * from './uniswap'

export async function createMarket(marketParams: CreateMarketParams): Promise<CreateMarketResult> {
  const tx = await marketParams.factory
    .connect(marketParams.caller)
    .createMarket(
      marketParams.tokenNameSuffix,
      marketParams.tokenSymbolSuffix,
      marketParams.longTokenSalt,
      marketParams.shortTokenSalt,
      marketParams.governance,
      marketParams.collateral,
      marketParams.floorLongPayout,
      marketParams.ceilingLongPayout,
      marketParams.floorValuation,
      marketParams.ceilingValuation,
      marketParams.expiryTime
    )
  const events = await findMarketAddedEvent(marketParams.factory)
  return {
    tx,
    market: events[0].args.market,
    hash: events[0].args.longShortHash,
  }
}

export function getBaseTokenAmountAfterFee(
  collateralAmount: BigNumber,
  baseTokenDenominator: BigNumberish
): BigNumber {
  return collateralAmount.mul(baseTokenDenominator).div(parseEther('1'))
}

export async function getBaseTokenAmount(
  collateral: Collateral | MockContract<Collateral>,
  collateralAmount: BigNumber
): Promise<BigNumber> {
  const amountAfterFee = getBaseTokenAmountAfterFee(collateralAmount, USDC_DENOMINATOR)
  const afterFeeFactor = BigNumber.from(FEE_DENOMINATOR).sub(await collateral.getDepositFee())
  return amountAfterFee.mul(FEE_DENOMINATOR).div(afterFeeFactor)
}

export async function getCollateralAmount(
  collateral: Collateral | MockContract<Collateral>,
  baseTokenAmount: BigNumber
): Promise<BigNumber> {
  const fee = baseTokenAmount.mul(await collateral.getDepositFee()).div(FEE_DENOMINATOR)
  const amountAfterFee = baseTokenAmount.sub(fee)
  return amountAfterFee.mul(parseEther('1')).div(USDC_DENOMINATOR)
}

export async function depositRecordExists(
  ethers: HardhatEthersHelpers,
  collateral: Collateral | MockContract<Collateral>
): Promise<boolean> {
  const depositHookAddress = await collateral.getDepositHook()
  if (depositHookAddress !== ZERO_ADDRESS) {
    const depositHook = (await ethers.getContractAt(
      'DepositHook',
      await collateral.getDepositHook()
    )) as DepositHook
    const depositRecordAddress = await depositHook.getDepositRecord()
    if (depositRecordAddress !== ZERO_ADDRESS) return true
  }
  return false
}

export async function checkUserDepositCap(
  recipient: string,
  baseTokenAmountAfterFee: BigNumber,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  const currentUserTotal = await depositRecord.getUserDepositAmount(recipient)
  const newUserTotal = currentUserTotal.add(baseTokenAmountAfterFee)
  const userDepositCap = await depositRecord.getUserDepositCap()
  if (newUserTotal.gt(userDepositCap)) {
    throw new Error(
      `${recipient} new user deposit total of ${formatEther(
        newUserTotal
      )} exceeds the user cap ${formatEther(userDepositCap)}`
    )
  }
}

export async function checkGlobalNetDepositCap(
  recipient: string,
  baseTokenAmountAfterFee: BigNumber,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  const currentGlobalTotal = await depositRecord.getGlobalNetDepositAmount()
  const newGlobalTotal = currentGlobalTotal.add(baseTokenAmountAfterFee)
  const globalNetDepositCap = await depositRecord.getGlobalNetDepositCap()
  if (newGlobalTotal.gt(globalNetDepositCap)) {
    throw new Error(
      `${recipient} new global deposit total of ${formatEther(
        newGlobalTotal
      )} exceeds the global cap ${formatEther(globalNetDepositCap)}`
    )
  }
}

export async function checkDepositCap(
  ethers: HardhatEthersHelpers,
  recipient: string,
  baseTokenAmountAfterFee: BigNumber,
  collateral: Collateral | MockContract<Collateral>
): Promise<void> {
  if (await depositRecordExists(ethers, collateral)) {
    const depositHook = (await ethers.getContractAt(
      'DepositHook',
      await collateral.getDepositHook()
    )) as DepositHook
    const depositRecord = (await ethers.getContractAt(
      'DepositRecord',
      await depositHook.getDepositRecord()
    )) as DepositRecord
    await checkUserDepositCap(recipient, baseTokenAmountAfterFee, depositRecord)
    await checkGlobalNetDepositCap(recipient, baseTokenAmountAfterFee, depositRecord)
  }
}

/// @dev Assumes account has sufficient Base Token to fund Collateral deposit
export async function mintCollateralFromBaseToken(
  ethers: HardhatEthersHelpers,
  funder: SignerWithAddress,
  recipient: string,
  collateralAmount: BigNumber,
  collateral: Collateral | MockContract<Collateral>
): Promise<BigNumber> {
  const baseTokenAmountAfterFee = getBaseTokenAmountAfterFee(collateralAmount, USDC_DENOMINATOR)
  await checkDepositCap(ethers, recipient, baseTokenAmountAfterFee, collateral)
  const baseToken = (await ethers.getContractAt('ERC20', await collateral.getBaseToken())) as ERC20
  const baseTokenAmount = await getBaseTokenAmount(collateral, collateralAmount)
  await baseToken.connect(funder).approve(collateral.address, baseTokenAmount)
  await collateral.connect(funder).deposit(recipient, baseTokenAmount)
  const mintEvents = await findTransferEvent(collateral, ZERO_ADDRESS, recipient)
  return mintEvents[0].args.value
}

/**
 * @dev Amount of LongShort to mint is equal to the Collateral needed
 * since there is no market minting fee.
 */
export async function mintLSFromCollateral(
  ethers: HardhatEthersHelpers,
  funder: SignerWithAddress,
  lsAmount: BigNumber,
  market: PrePOMarket | MockContract<PrePOMarket>
): Promise<void> {
  const collateral = (await ethers.getContractAt(
    'Collateral',
    await market.getCollateral()
  )) as Collateral
  await collateral.connect(funder).approve(market.address, lsAmount)
  await market.connect(funder).mint(lsAmount)
}

export async function mintLSFromBaseToken(
  ethers: HardhatEthersHelpers,
  funder: SignerWithAddress,
  recipient: SignerWithAddress,
  lsAmount: BigNumber,
  market: PrePOMarket | MockContract<PrePOMarket>
): Promise<BigNumber> {
  const collateral = (await ethers.getContractAt(
    'Collateral',
    await market.getCollateral()
  )) as Collateral
  const collateralMinted = await mintCollateralFromBaseToken(
    ethers,
    funder,
    recipient.address,
    lsAmount,
    collateral
  )
  await mintLSFromCollateral(ethers, recipient, collateralMinted, market)
  return collateralMinted
}

export async function getDeterministicMarketAddress(
  ethers: HardhatEthersHelpers,
  prePOMarketFactoryAddress: string,
  longTokenAddress: string,
  shortTokenAddress: string,
  treasury: string,
  collateralAddress: string,
  floorPayout: BigNumber,
  ceilingPayout: BigNumber,
  floorValuation: number,
  ceilingValuation: number,
  expiry: number
): Promise<string> {
  solidityKeccak256
  const marketSalt = solidityKeccak256(
    ['address', 'address'],
    [longTokenAddress, shortTokenAddress]
  )
  const prePOMarketContractFactory = await ethers.getContractFactory('PrePOMarket')
  const marketDeployTx = prePOMarketContractFactory.getDeployTransaction(
    treasury,
    collateralAddress,
    longTokenAddress,
    shortTokenAddress,
    floorPayout,
    ceilingPayout,
    floorValuation,
    ceilingValuation,
    expiry
  )
  const hashedInitCode = keccak256(marketDeployTx.data)
  const deterministicAddress = getCreate2Address(
    prePOMarketFactoryAddress,
    marketSalt,
    hashedInitCode
  )
  return deterministicAddress
}

export async function generateLongShortSalts(
  deployer: string,
  collateral: string,
  tokenNameSuffix: string,
  tokenSymbolSuffix: string,
  generateAddress: (
    deployer: string,
    initCode: BytesLike,
    lowerBoundAddress: string
  ) => Create2Address
): Promise<{
  longTokenSalt: Create2Address
  shortTokenSalt: Create2Address
}> {
  const longShortTokenFactory = await ethers.getContractFactory('LongShortToken')
  const longTokenDeployTx = longShortTokenFactory.getDeployTransaction(
    `LONG ${tokenNameSuffix}`,
    `L_${tokenSymbolSuffix}`
  )
  const longTokenSalt = generateAddress(deployer, longTokenDeployTx.data, collateral)
  const shortTokenDeployTx = longShortTokenFactory.getDeployTransaction(
    `SHORT ${tokenNameSuffix}`,
    `S_${tokenSymbolSuffix}`
  )
  const shortTokenSalt = generateAddress(deployer, shortTokenDeployTx.data, collateral)
  return { longTokenSalt, shortTokenSalt }
}
