import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import {
  DEFAULT_ADMIN_ROLE,
  FEE_DENOMINATOR,
  MARKET_FEE_LIMIT,
  MAX_PAYOUT,
  ZERO_ADDRESS,
} from 'prepo-constants'
import { utils, snapshots } from 'prepo-hardhat'
import { testERC20Fixture } from '../fixtures/TestERC20Fixture'
import { LongShortTokenAttachFixture } from '../fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from '../fixtures/PrePOMarketFixture'
import { prePOMarketFactoryFixture } from '../fixtures/PrePOMarketFactoryFixture'
import {
  fakeAccountListFixture,
  fakeMintHookFixture,
  fakeRedeemHookFixture,
} from '../fixtures/HookFixture'
import { calculateFee, getLastTimestamp, revertsIfNotRoleHolder, testRoleConstants } from '../utils'
import { createMarket, generateLongShortSalts, roleAssigners } from '../../helpers'
import { CreateMarketParams } from '../../types'
import {
  PrePOMarketFactory,
  PrePOMarket,
  LongShortToken,
  TestERC20,
  MintHook,
  RedeemHook,
} from '../../types/generated'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'

chai.use(smock.matchers)

const { nowPlusMonths } = utils
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> prePOMarket', () => {
  let collateralToken: TestERC20
  let prePOMarket: PrePOMarket
  let prePOMarketFactory: PrePOMarketFactory
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let treasury: SignerWithAddress
  let defaultParams: CreateMarketParams
  const TEST_NAME_SUFFIX = 'preSTRIPE 100-200 30-September-2021'
  const TEST_SYMBOL_SUFFIX = 'preSTRIPE_100-200_30SEP21'
  const TEST_FLOOR_VAL = ethers.utils.parseEther('100')
  const TEST_CEILING_VAL = ethers.utils.parseEther('200')
  const TEST_REDEMPTION_FEE = 20
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_FLOOR_PAYOUT = ethers.utils.parseEther('0.2')
  const TEST_CEILING_PAYOUT = ethers.utils.parseEther('0.8')
  const TEST_MINT_AMOUNT = ethers.utils.parseEther('1000')
  const TEST_FINAL_LONG_PAYOUT = TEST_FLOOR_PAYOUT.add(TEST_CEILING_PAYOUT).div(2)
  const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')
  snapshotter.setupSnapshotContext('prePOMarket')
  before(async () => {
    ;[deployer, user, treasury, recipient] = await ethers.getSigners()
    collateralToken = await testERC20Fixture('prePO USDC Collateral', 'preUSD', 18)
    await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
    prePOMarketFactory = await prePOMarketFactoryFixture()
    await roleAssigners.assignPrePOMarketFactoryRoles(deployer, deployer, prePOMarketFactory)
    await prePOMarketFactory.setCollateralValidity(collateralToken.address, true)
    const { longTokenSalt, shortTokenSalt } = await generateLongShortSalts(
      prePOMarketFactory.address,
      collateralToken.address,
      TEST_NAME_SUFFIX,
      TEST_SYMBOL_SUFFIX,
      utils.generateLowerAddress
    )
    defaultParams = {
      caller: deployer,
      factory: prePOMarketFactory,
      tokenNameSuffix: TEST_NAME_SUFFIX,
      tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
      longTokenSalt: longTokenSalt.salt,
      shortTokenSalt: shortTokenSalt.salt,
      governance: treasury.address,
      collateral: collateralToken.address,
      floorLongPayout: TEST_FLOOR_PAYOUT,
      ceilingLongPayout: TEST_CEILING_PAYOUT,
      floorValuation: TEST_FLOOR_VAL,
      ceilingValuation: TEST_CEILING_VAL,
      expiryTime: TEST_EXPIRY,
    }
    await snapshotter.saveSnapshot()
  })

  describe('# initialize', () => {
    it('should be initialized with correct values', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await prePOMarket.getCollateral()).to.eq(collateralToken.address)
      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await prePOMarket.getFloorLongPayout()).to.eq(TEST_FLOOR_PAYOUT)
      expect(await prePOMarket.getCeilingLongPayout()).to.eq(TEST_CEILING_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.eq(MAX_PAYOUT.add(1))
      expect(await prePOMarket.getFloorValuation()).to.eq(TEST_FLOOR_VAL)
      expect(await prePOMarket.getCeilingValuation()).to.eq(TEST_CEILING_VAL)
      expect(await prePOMarket.getRedemptionFee()).to.eq(0)
      expect(await prePOMarket.getExpiryTime()).to.eq(TEST_EXPIRY)
      expect(await prePOMarket.MAX_PAYOUT()).to.eq(MAX_PAYOUT)
      expect(await prePOMarket.FEE_DENOMINATOR()).to.eq(FEE_DENOMINATOR)
      expect(await prePOMarket.FEE_LIMIT()).to.eq(MARKET_FEE_LIMIT)
    })

    it('sets role constants to correct hash', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await testRoleConstants([
        prePOMarket.SET_MINT_HOOK_ROLE(),
        'setMintHook',
        prePOMarket.SET_REDEEM_HOOK_ROLE(),
        'setRedeemHook',
        prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE(),
        'setFinalLongPayout',
        prePOMarket.SET_REDEMPTION_FEE_ROLE(),
        'setRedemptionFee',
      ])
    })

    it('sets governance as role admin', async () => {
      const createMarketResult = await createMarket(defaultParams)
      prePOMarket = await prePOMarketAttachFixture(createMarketResult)

      expect(await prePOMarket.hasRole(DEFAULT_ADMIN_ROLE, treasury.address)).eq(true)
    })

    it('revokes admin role from deployer', async () => {
      const createMarketResult = await createMarket(defaultParams)
      prePOMarket = await prePOMarketAttachFixture(createMarketResult)

      expect(await prePOMarket.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).eq(false)
    })

    it('should not allow floor = ceiling', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          ceilingLongPayout: TEST_FLOOR_PAYOUT,
        })
      ).revertedWith('Ceiling must exceed floor')
    })

    it('should not allow floor > ceiling', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          floorLongPayout: TEST_CEILING_PAYOUT,
          ceilingLongPayout: TEST_FLOOR_PAYOUT,
        })
      ).revertedWith('Ceiling must exceed floor')
    })

    it('should not allow ceiling >  1', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          ceilingLongPayout: MAX_PAYOUT.add(1),
        })
      ).revertedWith('Ceiling cannot exceed 1')
    })

    it('should not allow expiry before current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket({
          ...defaultParams,
          expiryTime: lastTimestamp - 1,
        })
      ).revertedWith('Invalid expiry')
    })

    it('should not allow expiry at current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket({
          ...defaultParams,
          expiryTime: lastTimestamp,
        })
      ).revertedWith('Invalid expiry')
    })

    it('should emit MarketCreated event', async () => {
      const createMarketResult = await createMarket(defaultParams)
      prePOMarket = await prePOMarketAttachFixture(createMarketResult)

      await expect(createMarketResult.tx)
        .to.emit(prePOMarket, 'MarketCreated')
        .withArgs(
          await prePOMarket.getLongToken(),
          await prePOMarket.getShortToken(),
          await prePOMarket.getFloorLongPayout(),
          await prePOMarket.getCeilingLongPayout(),
          TEST_FLOOR_VAL,
          TEST_CEILING_VAL,
          TEST_EXPIRY
        )
    })
  })

  describe('# setFinalLongPayout', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setFinalLongPayout')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      await snapshotter.saveSnapshot()
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        prePOMarket.SET_FINAL_LONG_PAYOUT_ROLE(),
        prePOMarket.populateTransaction.setFinalLongPayout(MAX_PAYOUT)
      )
    })

    it('reverts if value set more than once', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))
      expect(await prePOMarket.getFinalLongPayout()).to.eq(TEST_CEILING_PAYOUT.sub(1))

      const tx = prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      await expect(tx).revertedWith('Final payout already set')
    })

    it('should not be settable beyond ceiling', async () => {
      await expect(
        prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.add(1))
      ).to.revertedWith('Payout cannot exceed ceiling')
    })

    it('should not be settable below floor', async () => {
      await expect(
        prePOMarket.connect(treasury).setFinalLongPayout(TEST_FLOOR_PAYOUT.sub(1))
      ).to.revertedWith('Payout cannot be below floor')
    })

    it('should be settable to value between payout and ceiling', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      expect(await prePOMarket.getFinalLongPayout()).to.eq(TEST_CEILING_PAYOUT.sub(1))
    })

    it('should emit a FinalLongPayoutSet event', async () => {
      const tx = await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))
      await expect(tx)
        .to.emit(prePOMarket, 'FinalLongPayoutSet')
        .withArgs(TEST_CEILING_PAYOUT.sub(1))
    })
  })

  describe('# setMintHook', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setMintHook')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      await snapshotter.saveSnapshot()
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        prePOMarket.SET_MINT_HOOK_ROLE(),
        prePOMarket.populateTransaction.setMintHook(user.address)
      )
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarket.getMintHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await prePOMarket.connect(treasury).setMintHook(user.address)
      expect(await prePOMarket.getMintHook()).to.not.eq(ZERO_ADDRESS)

      await prePOMarket.connect(treasury).setMintHook(ZERO_ADDRESS)

      expect(await prePOMarket.getMintHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarket.getMintHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)
    })

    it('emits MintHookChange', async () => {
      const tx = await prePOMarket.connect(treasury).setMintHook(user.address)

      await expect(tx).to.emit(prePOMarket, 'MintHookChange').withArgs(user.address)
    })
  })

  describe('# setRedeemHook', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setRedeemHook')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      await snapshotter.saveSnapshot()
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        prePOMarket.SET_REDEEM_HOOK_ROLE(),
        prePOMarket.populateTransaction.setRedeemHook(user.address)
      )
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarket.getRedeemHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await prePOMarket.connect(treasury).setRedeemHook(user.address)
      expect(await prePOMarket.getRedeemHook()).to.not.eq(ZERO_ADDRESS)

      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      expect(await prePOMarket.getRedeemHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarket.getRedeemHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)
    })

    it('emits RedeemHookChange', async () => {
      const tx = await prePOMarket.connect(treasury).setRedeemHook(user.address)

      await expect(tx).to.emit(prePOMarket, 'RedeemHookChange').withArgs(user.address)
    })
  })

  describe('# setRedemptionFee', () => {
    snapshotter.setupSnapshotContext('prePOMarket-setRedemptionFee')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      await snapshotter.saveSnapshot()
    })

    it('reverts if not role holder', async () => {
      await revertsIfNotRoleHolder(
        prePOMarket.SET_REDEMPTION_FEE_ROLE(),
        prePOMarket.populateTransaction.setRedemptionFee(MARKET_FEE_LIMIT + 1)
      )
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT + 1)
      ).to.revertedWith('Exceeds fee limit')
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.not.eq(MARKET_FEE_LIMIT)

      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      expect(await prePOMarket.getRedemptionFee()).to.eq(MARKET_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.not.eq(MARKET_FEE_LIMIT - 1)

      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT - 1)

      expect(await prePOMarket.getRedemptionFee()).to.eq(MARKET_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      expect(await prePOMarket.getRedemptionFee()).to.not.eq(0)

      await prePOMarket.connect(treasury).setRedemptionFee(0)

      expect(await prePOMarket.getRedemptionFee()).to.eq(0)
    })

    it('emits RedemptionFeeChange', async () => {
      const tx = await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      await expect(tx).to.emit(prePOMarket, 'RedemptionFeeChange').withArgs(MARKET_FEE_LIMIT)
    })
  })

  describe('# mint', () => {
    let mintHook: FakeContract<MintHook>
    snapshotter.setupSnapshotContext('prePOMarket-mint')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      await snapshotter.saveSnapshot()
    })

    it('prevents minting if market ended', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).revertedWith('Market ended')
    })

    it('should not allow minting an amount exceeding owned collateral', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT.sub(1))
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT.sub(1))

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).revertedWith(
        'Insufficient collateral'
      )
    })

    it('transfers collateral from sender', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(await collateralToken.balanceOf(prePOMarket.address)).to.eq(TEST_MINT_AMOUNT)
    })

    it('mints long and short tokens in equal amounts', async () => {
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT)
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT)
    })

    it('calls hook with correct parameters', async () => {
      mintHook = await fakeMintHookFixture()
      await prePOMarket.connect(treasury).setMintHook(mintHook.address)
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(mintHook.hook).calledWith(
        user.address,
        user.address,
        TEST_MINT_AMOUNT,
        TEST_MINT_AMOUNT
      )
    })

    it('ignores hook if not set', async () => {
      // reset smock hook or else smock history will be preserved from previous test
      mintHook = await fakeMintHookFixture()
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(treasury).setMintHook(ZERO_ADDRESS)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(mintHook.hook).not.called
    })

    it('reverts if hook reverts', async () => {
      mintHook = await fakeMintHookFixture()
      await prePOMarket.connect(treasury).setMintHook(mintHook.address)
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      mintHook.hook.reverts()

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).reverted
    })

    it('emits Mint', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      const mintFilter = {
        address: prePOMarket.address,
        topics: [
          ethers.utils.id('Mint(address,uint256)'),
          ethers.utils.hexZeroPad(user.address, 32),
        ],
      }
      const mintEvents = await prePOMarket.queryFilter(mintFilter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mintEvent = mintEvents[0].args as any

      expect(await mintEvent.minter).to.eq(user.address)
      expect(await mintEvent.amount).to.eq(TEST_MINT_AMOUNT)
    })

    it('returns long short tokens minted', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      expect(await prePOMarket.connect(user).callStatic.mint(TEST_MINT_AMOUNT)).to.eq(
        TEST_MINT_AMOUNT
      )
    })
  })

  describe('# redeem', () => {
    let longToken: LongShortToken
    let shortToken: LongShortToken
    let redeemHook: FakeContract<RedeemHook>
    snapshotter.setupSnapshotContext('prePOMarket-redeem')

    before(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      await roleAssigners.assignPrePOMarketRoles(treasury, treasury, prePOMarket)
      redeemHook = await fakeRedeemHookFixture()
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)
      longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await prePOMarket.connect(treasury).setRedemptionFee(TEST_REDEMPTION_FEE)
      await prePOMarket.connect(treasury).setRedeemHook(redeemHook.address)
    })

    const calculateTotalOwed = async (
      longToRedeem: BigNumber,
      shortToRedeem: BigNumber,
      finalPayoutSet: boolean
    ): Promise<BigNumber> => {
      let totalOwed: BigNumber
      if (finalPayoutSet) {
        totalOwed = longToRedeem
      } else {
        const owedForLongs = longToRedeem
          .mul(await prePOMarket.getFinalLongPayout())
          .div(MAX_PAYOUT)
        const owedForShort = shortToRedeem
          .mul(MAX_PAYOUT.sub(await prePOMarket.getFinalLongPayout()))
          .div(MAX_PAYOUT)
        totalOwed = owedForLongs.add(owedForShort)
      }
      return totalOwed
    }

    it('reverts if amounts = 0, fee = 0%, and before market end', async () => {
      await prePOMarket.connect(treasury).setRedemptionFee(0)

      await expect(prePOMarket.connect(user).redeem(0, 0, user.address)).revertedWith('amount = 0')
    })

    it('reverts if amounts = 0, fee = 0%, and after market end', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)

      await expect(prePOMarket.connect(user).redeem(0, 0, user.address)).revertedWith('amount = 0')
    })

    it('reverts if amounts = 0, fee > 0%, and before market end', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)

      await expect(prePOMarket.connect(user).redeem(0, 0, user.address)).revertedWith('fee = 0')
    })

    it('reverts if amounts = 0, fee > 0%, and after market end', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)

      await expect(prePOMarket.connect(user).redeem(0, 0, user.address)).revertedWith('fee = 0')
    })

    it('reverts if hook reverts', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      redeemHook.hook.reverts()

      await expect(prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address))
        .reverted
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming equal parts', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * Given a test fee of 20 (0.002%), smallest redemption that would result in a
       * fee(of 1) would be 50000 wei, so for fee = 0, redeem 49999.
       */
      const longToRedeem = BigNumber.from(49999)
      const shortToRedeem = longToRedeem
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)
      ).revertedWith('fee = 0')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more long', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)
      ).revertedWith('fee = 0')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more short', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)
      ).revertedWith('fee = 0')
    })

    it('should not allow long token redemption exceeding long token balance', async () => {
      await expect(
        prePOMarket.connect(user).redeem(TEST_MINT_AMOUNT.add(1), TEST_MINT_AMOUNT, user.address)
      ).revertedWith('Insufficient long tokens')
    })

    it('should not allow short token redemption exceeding short token balance', async () => {
      await expect(
        prePOMarket.connect(user).redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT.add(1), user.address)
      ).revertedWith('Insufficient short tokens')
    })

    it('should only allow token redemption in equal parts before expiry', async () => {
      await expect(
        prePOMarket.connect(user).redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT.sub(1), user.address)
      ).revertedWith('Long and Short must be equal')
    })

    it('should correctly settle equal non-zero redemption amounts before market end', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('redeems if funder != recipient and market not ended', async () => {
      expect(user.address).not.eq(recipient.address)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, recipient.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(recipient.address)).to.eq(totalOwed)
    })

    it('should correctly settle non-equal non-zero redemption amounts after market end', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT.sub(1)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('should correctly settle redemption done with only long tokens after market end', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = ethers.utils.parseEther('0')
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('should correctly settle redemption done with only short tokens after market end', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = ethers.utils.parseEther('0')
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('redeems if funder != recipient and market ended', async () => {
      expect(user.address).not.eq(recipient.address)
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = TEST_MINT_AMOUNT
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, recipient.address)

      const filter = prePOMarket.filters.Redemption(user.address, recipient.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.redeemer).to.eq(user.address)
      expect(event.recipient).to.eq(recipient.address)
      expect(event.amountAfterFee).to.eq(totalOwed)
      expect(event.fee).to.eq(0)
      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(recipient.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming equal parts', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more long', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const longBalanceBefore = await longToken.balanceOf(user.address)
      const shortBalanceBefore = await shortToken.balanceOf(user.address)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(longBalanceBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(shortBalanceBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more short', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const longBalanceBefore = await longToken.balanceOf(user.address)
      const shortBalanceBefore = await shortToken.balanceOf(user.address)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await longToken.balanceOf(user.address)).to.eq(longBalanceBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(shortBalanceBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('calls hook with correct parameters and redeemer = recipient', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(redeemHook.hook).calledWith(
        user.address,
        user.address,
        totalOwed,
        totalOwed.sub(redeemFee)
      )
    })

    it('calls hook with correct parameters if redeemer != recipient', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, recipient.address)

      expect(redeemHook.hook).calledWith(
        user.address,
        recipient.address,
        totalOwed,
        totalOwed.sub(redeemFee)
      )
    })

    it('ignores hook if not set', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(redeemHook.hook).not.called
    })

    it('approves fee for hook to use', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      await expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
    })

    it('sets approval back to 0', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      await expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
      await expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, 0)
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).to.eq(0)
    })

    it("doesn't approve fee if hook not set", async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      await expect(tx).to.not.emit(collateralToken, 'Approval')
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).to.eq(0)
    })

    it('sends full collateral amount if hook not set', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('sends correct collateral amount if hook takes partial fee', async () => {
      // TestRedeemHook meant to take 50% of the fee
      const factory = await ethers.getContractFactory('TestRedeemHook')
      const testRedeemHook = await factory.connect(deployer).deploy()
      const testTreasury = await testRedeemHook.treasury()
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const treasuryCollateralBefore = await collateralToken.balanceOf(testTreasury)
      await prePOMarket.connect(treasury).setRedeemHook(testRedeemHook.address)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)
      const expectedPartialFee = redeemFee.div(2)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      const filter = prePOMarket.filters.Redemption(user.address, user.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.redeemer).to.eq(user.address)
      expect(event.recipient).to.eq(user.address)
      expect(event.amountAfterFee).to.eq(TEST_MINT_AMOUNT.sub(expectedPartialFee))
      expect(event.fee).to.eq(expectedPartialFee)
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed.sub(expectedPartialFee))
      expect(await collateralToken.balanceOf(testTreasury)).eq(
        treasuryCollateralBefore.add(expectedPartialFee)
      )
    })

    it('sends correct collateral amount if hook takes full fee', async () => {
      const allowedCallers = await fakeAccountListFixture()
      const allowList = await fakeAccountListFixture()
      const tokenSender = await fakeTokenSenderFixture()
      const factory = await ethers.getContractFactory('RedeemHook')
      const testRedeemHook = await factory.connect(deployer).deploy()
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const treasuryCollateralBefore = await collateralToken.balanceOf(treasury.address)
      await testRedeemHook.connect(deployer).setAllowedMsgSenders(allowedCallers.address)
      await testRedeemHook.connect(deployer).setAccountList(allowList.address)
      await testRedeemHook.connect(deployer).setTreasury(treasury.address)
      await testRedeemHook.connect(deployer).setTokenSender(tokenSender.address)
      await prePOMarket.connect(treasury).setRedeemHook(testRedeemHook.address)
      allowedCallers.isIncluded.whenCalledWith(prePOMarket.address).returns(true)
      allowList.isIncluded.whenCalledWith(user.address).returns(true)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      const filter = prePOMarket.filters.Redemption(user.address, user.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.redeemer).to.eq(user.address)
      expect(event.recipient).to.eq(user.address)
      expect(event.amountAfterFee).to.eq(TEST_MINT_AMOUNT.sub(redeemFee))
      expect(event.fee).to.eq(redeemFee)
      expect(await collateralToken.balanceOf(user.address)).eq(totalOwed.sub(redeemFee))
      expect(await collateralToken.balanceOf(treasury.address)).eq(
        treasuryCollateralBefore.add(redeemFee)
      )
    })

    it('sends full collateral amount if hook takes no fee', async () => {
      const longToRedeem = TEST_MINT_AMOUNT
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem, user.address)

      expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('emits Redemption indexed by redeemer', async () => {
      // redeem expected to not take any fee
      await prePOMarket.connect(user).redeem(TEST_MINT_AMOUNT, TEST_MINT_AMOUNT, recipient.address)

      const filter = prePOMarket.filters.Redemption(user.address, recipient.address)
      const events = await prePOMarket.queryFilter(filter)
      const event = events[0].args
      expect(event.redeemer).to.eq(user.address)
      expect(event.recipient).to.eq(recipient.address)
      expect(event.amountAfterFee).to.eq(TEST_MINT_AMOUNT)
      expect(event.fee).to.eq(0)
    })

    afterEach(() => {
      redeemHook.hook.reset()
    })
  })
})
