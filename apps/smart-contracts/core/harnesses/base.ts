import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { BigNumber } from 'ethers'
import { POOL_FEE_TIER } from 'prepo-constants'
import { Create2Address, utils } from 'prepo-hardhat'
import { mintCollateralFromBaseToken, mintLSFromCollateral, mintLSFromBaseToken } from '../helpers'
import { attachUniV3Pool, getNearestSqrtX96FromWei } from '../helpers/uniswap'
import {
  CollateralWithHooks,
  MockCollateralWithHooks,
  MarketWithHooks,
  MockMarketWithHooks,
} from '../types'
import {
  ERC20,
  DepositRecord,
  PrePOMarketFactory,
  TestERC20,
  TokenSender,
  UniswapV3Factory,
} from '../types/generated'

const { generateAddressLessThan } = utils

export abstract class Base {
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20 | MockContract<TestERC20>
  public rewardToken: ERC20 | MockContract<TestERC20>
  public collateral: CollateralWithHooks | MockCollateralWithHooks
  public depositRecord: DepositRecord | MockContract<DepositRecord>
  public tokenSender: TokenSender | MockContract<TokenSender>
  public marketFactory?: PrePOMarketFactory
  public markets?: {
    [suffix: string]: MarketWithHooks | MockMarketWithHooks
  }

  public mintCollateralFromBaseToken(
    funder: SignerWithAddress,
    recipient: string,
    collateralAmount: BigNumber
  ): Promise<BigNumber> {
    return mintCollateralFromBaseToken(
      this.ethers,
      funder,
      recipient,
      collateralAmount,
      this.collateral
    )
  }

  public async mintLSFromCollateral(
    funder: SignerWithAddress,
    lsAmount: BigNumber,
    marketSuffix: string
  ): Promise<void> {
    await mintLSFromCollateral(this.ethers, funder, lsAmount, this.markets[marketSuffix])
  }

  public mintLSFromBaseToken(
    funder: SignerWithAddress,
    recipient: SignerWithAddress,
    lsAmount: BigNumber,
    marketSuffix: string
  ): Promise<BigNumber> {
    return mintLSFromBaseToken(this.ethers, funder, recipient, lsAmount, this.markets[marketSuffix])
  }

  public async generateLongShortSalts(
    deployer: string,
    tokenNameSuffix: string,
    tokenSymbolSuffix: string
  ): Promise<Create2Address[]> {
    const longShortTokenFactory = await this.ethers.getContractFactory('LongShortToken')
    const longTokenDeployTx = longShortTokenFactory.getDeployTransaction(
      `LONG ${tokenNameSuffix}`,
      `L_${tokenSymbolSuffix}`
    )
    const longTokenSalt = generateAddressLessThan(
      deployer,
      longTokenDeployTx.data,
      this.collateral.address
    )
    const shortTokenDeployTx = longShortTokenFactory.getDeployTransaction(
      `SHORT ${tokenNameSuffix}`,
      `S_${tokenSymbolSuffix}`
    )
    const shortTokenSalt = generateAddressLessThan(
      deployer,
      shortTokenDeployTx.data,
      this.collateral.address
    )
    return [longTokenSalt, shortTokenSalt]
  }

  public async deployPoolsForMarket(
    tokenNameSuffix: string,
    univ3Factory: UniswapV3Factory,
    approxLongPoolWeiPrice: BigNumber,
    approxShortPoolWeiPrice: BigNumber
  ): Promise<void> {
    await univ3Factory.createPool(
      this.markets[tokenNameSuffix].longToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const longPoolAddress = await univ3Factory.getPool(
      this.markets[tokenNameSuffix].longToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const longPool = await attachUniV3Pool(this.ethers, longPoolAddress)
    await longPool.initialize(getNearestSqrtX96FromWei(approxLongPoolWeiPrice))
    await univ3Factory.createPool(
      this.markets[tokenNameSuffix].shortToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const shortPoolAddress = await univ3Factory.getPool(
      this.markets[tokenNameSuffix].shortToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const shortPool = await attachUniV3Pool(this.ethers, shortPoolAddress)
    await shortPool.initialize(getNearestSqrtX96FromWei(approxShortPoolWeiPrice))
  }
}
