import { BigNumber } from 'ethers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { MockContract } from '@defi-wonderland/smock'
import { Base } from './base'
import { MockCollateralWithHooks, MockMarketWithHooks, PrePOMarketParams } from '../types'
import { Create2Deployer, DepositRecord, TestERC20, TokenSender } from '../types/generated'
import { smockCollateralFixture } from '../test/fixtures/CollateralFixture'
import {
  smockAccountListFixture,
  smockDepositHookFixture,
  smockManagerWithdrawHookFixture,
  smockWithdrawHookFixture,
} from '../test/fixtures/HookFixture'
import { smockTestERC20Fixture } from '../test/fixtures/TestERC20Fixture'
import { smockDepositRecordFixture } from '../test/fixtures/DepositRecordFixture'
import { smockTokenSenderFixture } from '../test/fixtures/TokenSenderFixture'
import { create2LongShortTokenFixture } from '../test/fixtures/LongShortTokenFixture'
import { smockPrePOMarketFixture } from '../test/fixtures/PrePOMarketFixture'

export class MockCore extends Base {
  private static _instance: MockCore
  public baseToken: MockContract<TestERC20>
  public rewardToken: MockContract<TestERC20>
  public collateral: MockCollateralWithHooks
  public depositRecord: MockContract<DepositRecord>
  public tokenSender: MockContract<TokenSender>
  public markets?: {
    [suffix: string]: MockMarketWithHooks
  }

  public static get Instance(): MockCore {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(ethers: HardhatEthersHelpers): Promise<MockCore> {
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    this.baseToken = await smockTestERC20Fixture('Test USDC', 'TUSDC', 6)
    this.rewardToken = await smockTestERC20Fixture('Test PPO', 'TPPO', 18)
    this.collateral = await smockCollateralFixture(
      'prePO USDC Collateral',
      'preUSDC',
      this.baseToken.address,
      6
    )
    this.collateral.depositHook = await smockDepositHookFixture()
    this.collateral.depositHook.allowlist = await smockAccountListFixture()
    this.collateral.withdrawHook = await smockWithdrawHookFixture()
    this.collateral.managerWithdrawHook = await smockManagerWithdrawHookFixture()
    this.depositRecord = await smockDepositRecordFixture()
    this.tokenSender = await smockTokenSenderFixture(this.rewardToken.address)
    this.markets = {}
    return this
  }

  public async createAndAddMockMarket(
    tokenNameSuffix: string,
    tokenSymbolSuffix: string,
    marketParams: PrePOMarketParams,
    deployerFactory: Create2Deployer
  ): Promise<void> {
    const tokenSalts = await this.generateLongShortSalts(
      deployerFactory.address,
      tokenNameSuffix,
      tokenSymbolSuffix
    )
    const longToken = await create2LongShortTokenFixture(
      `LONG ${tokenNameSuffix}`,
      `L_${tokenSymbolSuffix}`,
      deployerFactory,
      tokenSalts[0]
    )
    const shortToken = await create2LongShortTokenFixture(
      `SHORT ${tokenNameSuffix}`,
      `S_${tokenSymbolSuffix}`,
      deployerFactory,
      tokenSalts[1]
    )
    const market = await smockPrePOMarketFixture(
      marketParams,
      longToken.address,
      shortToken.address
    )
    await deployerFactory.transferOwnership(longToken.address, market.address)
    await deployerFactory.transferOwnership(shortToken.address, market.address)
    this.markets[tokenNameSuffix] = market
    this.markets[tokenNameSuffix].longToken = longToken
    this.markets[tokenNameSuffix].shortToken = shortToken
  }
}
