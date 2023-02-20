import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { BigNumber, BigNumberish } from 'ethers'
import { POOL_FEE_TIER } from 'prepo-constants'
import { Create2Address, sendTxAndWait, utils } from 'prepo-hardhat'
import {
  mintCollateralFromBaseToken,
  mintLSFromCollateral,
  mintLSFromBaseToken,
  roleAssigners,
} from '../helpers'
import { attachUniV3Pool, getNearestSqrtX96FromWei } from '../helpers/uniswap'
import {
  ExtendedCollateral,
  MockExtendedCollateral,
  ExtendedDepositRecord,
  MockExtendedDepositRecord,
  ExtendedMarket,
  MockExtendedMarket,
  ExtendedTokenSender,
  MockExtendedTokenSender,
} from '../types'
import {
  ArbitrageBroker,
  ERC20,
  DepositTradeHelper,
  TestERC20,
  UniswapV3Factory,
} from '../types/generated'

const { generateAddressLessThan, setContractIfNotAlreadySet } = utils

export abstract class Base {
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20 | MockContract<TestERC20>
  public rewardToken: ERC20 | MockContract<TestERC20>
  public collateral: ExtendedCollateral | MockExtendedCollateral
  public depositRecord: ExtendedDepositRecord | MockExtendedDepositRecord
  public tokenSender: ExtendedTokenSender | MockExtendedTokenSender
  public arbitrageBroker?: ArbitrageBroker | MockContract<ArbitrageBroker>
  public depositTradeHelper?: DepositTradeHelper | MockContract<DepositTradeHelper>
  public markets?: {
    [suffix: string]: ExtendedMarket | MockExtendedMarket
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

  public async assignRolesForBaseStack(
    rootAdmin: SignerWithAddress,
    nominee: SignerWithAddress
  ): Promise<void> {
    await roleAssigners.assignCollateralRoles(rootAdmin, nominee, this.collateral)
    await roleAssigners.assignDepositRecordRoles(rootAdmin, nominee, this.depositRecord)
    await roleAssigners.assignDepositHookRoles(rootAdmin, nominee, this.collateral.depositHook)
    await roleAssigners.assignWithdrawHookRoles(rootAdmin, nominee, this.collateral.withdrawHook)
    await roleAssigners.assignManagerWithdrawHookRoles(
      rootAdmin,
      nominee,
      this.collateral.managerWithdrawHook
    )
    await roleAssigners.assignTokenSenderRoles(rootAdmin, nominee, this.tokenSender)
  }

  public async configureCollateralViaSigner(
    signer: SignerWithAddress,
    manager?: string,
    depositFee?: BigNumberish,
    withdrawFee?: BigNumberish
  ): Promise<void> {
    await setContractIfNotAlreadySet(
      signer,
      this.collateral,
      this.collateral.depositHook.address,
      'getDepositHook',
      'setDepositHook'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral,
      this.collateral.withdrawHook.address,
      'getWithdrawHook',
      'setWithdrawHook'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral,
      this.collateral.managerWithdrawHook.address,
      'getManagerWithdrawHook',
      'setManagerWithdrawHook'
    )
    if (manager) await sendTxAndWait(await this.collateral.connect(signer).setManager(manager))
    if (depositFee !== undefined)
      await sendTxAndWait(await this.collateral.connect(signer).setDepositFee(depositFee))
    if (withdrawFee !== undefined)
      await sendTxAndWait(await this.collateral.connect(signer).setWithdrawFee(withdrawFee))
  }

  public async configureDepositHookViaSigner(
    signer: SignerWithAddress,
    depositsAllowed?: boolean,
    treasury?: string
  ): Promise<void> {
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.collateral.address,
      'getCollateral',
      'setCollateral'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.depositRecord.address,
      'getDepositRecord',
      'setDepositRecord'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.tokenSender.address,
      'getTokenSender',
      'setTokenSender'
    )
    if (depositsAllowed !== undefined)
      await sendTxAndWait(
        await this.collateral.depositHook.connect(signer).setDepositsAllowed(depositsAllowed)
      )
    if (treasury)
      await sendTxAndWait(await this.collateral.depositHook.connect(signer).setTreasury(treasury))
  }

  public async configureWithdrawHookViaSigner(
    signer: SignerWithAddress,
    withdrawalsAllowed?: boolean,
    globalPeriodLength?: BigNumberish,
    userPeriodLength?: BigNumberish,
    globalWithdrawLimitPerPeriod?: BigNumberish,
    userWithdrawLimitPerPeriod?: BigNumberish
  ): Promise<void> {
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.withdrawHook,
      this.collateral.address,
      'getCollateral',
      'setCollateral'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.withdrawHook,
      this.depositRecord.address,
      'getDepositRecord',
      'setDepositRecord'
    )
    if (withdrawalsAllowed !== undefined)
      await sendTxAndWait(await this.collateral.withdrawHook.setWithdrawalsAllowed(true))
    if (globalPeriodLength !== undefined)
      await sendTxAndWait(
        await this.collateral.withdrawHook.connect(signer).setGlobalPeriodLength(globalPeriodLength)
      )
    if (userPeriodLength !== undefined)
      await sendTxAndWait(
        await this.collateral.withdrawHook.connect(signer).setUserPeriodLength(userPeriodLength)
      )
    if (globalWithdrawLimitPerPeriod !== undefined)
      await sendTxAndWait(
        await this.collateral.withdrawHook
          .connect(signer)
          .setGlobalWithdrawLimitPerPeriod(globalWithdrawLimitPerPeriod)
      )
    if (userWithdrawLimitPerPeriod !== undefined)
      await sendTxAndWait(
        await this.collateral.withdrawHook
          .connect(signer)
          .setUserWithdrawLimitPerPeriod(userWithdrawLimitPerPeriod)
      )
  }

  public async configureManagerWithdrawHookViaSigner(
    signer: SignerWithAddress,
    minReservePercentage?: BigNumberish
  ): Promise<void> {
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.managerWithdrawHook,
      this.collateral.address,
      'getCollateral',
      'setCollateral'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.collateral.managerWithdrawHook,
      this.depositRecord.address,
      'getDepositRecord',
      'setDepositRecord'
    )
    if (minReservePercentage !== undefined) {
      await sendTxAndWait(
        await this.collateral.managerWithdrawHook
          .connect(signer)
          .setMinReservePercentage(minReservePercentage)
      )
    }
  }

  public async configureDepositRecordViaSigner(
    signer: SignerWithAddress,
    globalNetDepositCap?: BigNumberish,
    userDepositCap?: BigNumberish,
    allowedMsgSenders?: string[],
    bypasslist?: string[]
  ): Promise<void> {
    if (globalNetDepositCap !== undefined)
      await sendTxAndWait(
        await this.depositRecord.connect(signer).setGlobalNetDepositCap(globalNetDepositCap)
      )
    if (userDepositCap !== undefined)
      await sendTxAndWait(
        await this.depositRecord.connect(signer).setUserDepositCap(userDepositCap)
      )
    if (allowedMsgSenders !== undefined && allowedMsgSenders.length > 0) {
      await sendTxAndWait(
        await this.depositRecord.allowedMsgSenders
          .connect(signer)
          .set(allowedMsgSenders, new Array(allowedMsgSenders.length).fill(true))
      )
    }
    if (bypasslist !== undefined && bypasslist.length > 0) {
      await sendTxAndWait(
        await this.depositRecord.bypasslist
          .connect(signer)
          .set(bypasslist, new Array(bypasslist.length).fill(true))
      )
    }
  }

  public async configureTokenSenderViaSigner(
    signer: SignerWithAddress,
    fixedPrice?: BigNumberish,
    priceMultiplier?: BigNumberish,
    scaledPriceLowerBound?: BigNumberish,
    allowedMsgSenders?: string[]
  ): Promise<void> {
    await setContractIfNotAlreadySet(
      signer,
      this.tokenSender,
      this.tokenSender.fixedPrice.address,
      'getPrice',
      'setPrice'
    )
    await setContractIfNotAlreadySet(
      signer,
      this.tokenSender,
      this.tokenSender.allowedMsgSenders.address,
      'getAllowedMsgSenders',
      'setAllowedMsgSenders'
    )
    if (fixedPrice !== undefined)
      await sendTxAndWait(await this.tokenSender.fixedPrice.connect(signer).set(fixedPrice))
    if (priceMultiplier !== undefined)
      await sendTxAndWait(
        await this.tokenSender.connect(signer).setPriceMultiplier(priceMultiplier)
      )
    if (scaledPriceLowerBound !== undefined)
      await sendTxAndWait(
        await this.tokenSender.connect(signer).setScaledPriceLowerBound(scaledPriceLowerBound)
      )
    if (allowedMsgSenders !== undefined && allowedMsgSenders.length > 0) {
      await sendTxAndWait(
        await this.tokenSender.allowedMsgSenders
          .connect(signer)
          .set(allowedMsgSenders, new Array(allowedMsgSenders.length).fill(true))
      )
    }
  }
}
