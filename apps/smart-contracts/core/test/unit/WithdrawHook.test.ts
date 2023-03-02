import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseUnits } from 'ethers/lib/utils'
import {
  ZERO_ADDRESS,
  MAX_GLOBAL_PERIOD_LENGTH,
  MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD,
  MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_IN_UNITS,
  PERCENT_DENOMINATOR,
} from 'prepo-constants'
import { utils, snapshots } from 'prepo-hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { fakeAccountListFixture, withdrawHookFixture } from '../fixtures/HookFixture'
import { smockDepositRecordFixture } from '../fixtures/DepositRecordFixture'
import { setAccountBalance } from '../utils'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { roleAssigners } from '../../helpers'
import {
  AccountList,
  Collateral,
  DepositRecord,
  TestERC20,
  TokenSender,
  WithdrawHook,
} from '../../types/generated'

chai.use(smock.matchers)

const { getLastTimestamp, setNextTimestamp } = utils
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> WithdrawHook', () => {
  let withdrawHook: WithdrawHook
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let treasury: SignerWithAddress
  let allowList: FakeContract<AccountList>
  let mockTestToken: MockContract<TestERC20>
  let fakeCollateral: FakeContract<Collateral>
  let mockDepositRecord: MockContract<DepositRecord>
  let fakeTokenSender: FakeContract<TokenSender>
  const BASE_TOKEN_DECIMALS = 18
  const MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD = parseUnits(
    MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_IN_UNITS.toString(),
    BASE_TOKEN_DECIMALS
  )
  const TEST_AMOUNT_BEFORE_FEE = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
  const TEST_AMOUNT_AFTER_FEE = TEST_AMOUNT_BEFORE_FEE.mul(99).div(100)
  const TEST_GLOBAL_PERIOD_LENGTH = 20
  const TEST_GLOBAL_WITHDRAW_LIMIT = TEST_AMOUNT_BEFORE_FEE.mul(3)
  snapshotter.setupSnapshotContext('WithdrawHook')

  before(async () => {
    ;[deployer, user, treasury, recipient] = await ethers.getSigners()
    withdrawHook = await withdrawHookFixture(BASE_TOKEN_DECIMALS)
    mockTestToken = await smockTestERC20Fixture('Test Token', 'TEST', BASE_TOKEN_DECIMALS)
    fakeCollateral = await fakeCollateralFixture()
    allowList = await fakeAccountListFixture()
    fakeCollateral.getBaseToken.returns(mockTestToken.address)
    await setAccountBalance(fakeCollateral.address, '0.1')
    mockDepositRecord = await smockDepositRecordFixture()
    mockDepositRecord.getGlobalNetDepositAmount.returns()
    fakeTokenSender = await fakeTokenSenderFixture()
    await roleAssigners.assignWithdrawHookRoles(deployer, deployer, withdrawHook)
    await roleAssigners.assignDepositRecordRoles(deployer, deployer, mockDepositRecord)
    await mockDepositRecord.connect(deployer).setAllowedMsgSenders(allowList.address)
    await mockDepositRecord.connect(deployer).setAccountList(allowList.address)
    allowList.isIncluded.whenCalledWith(user.address).returns(true)
    allowList.isIncluded.whenCalledWith(withdrawHook.address).returns(true)
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets last global period reset to 0', async () => {
      expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(0)
    })

    it('sets percent denominator', async () => {
      expect(await withdrawHook.PERCENT_DENOMINATOR()).eq(PERCENT_DENOMINATOR)
    })

    it('sets max global period length', async () => {
      expect(await withdrawHook.MAX_GLOBAL_PERIOD_LENGTH()).eq(MAX_GLOBAL_PERIOD_LENGTH)
    })

    it('sets min global withdraw limit percent per period', async () => {
      expect(await withdrawHook.MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD
      )
    })

    it('sets min global withdraw limit from base token decimals', async () => {
      expect(await withdrawHook.MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD()).eq(
        parseUnits(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_IN_UNITS.toString(), BASE_TOKEN_DECIMALS)
      )
    })

    it('sets role constants to the correct hash', async () => {
      expect(await withdrawHook.SET_TREASURY_ROLE()).to.eq(id('setTreasury'))
      expect(await withdrawHook.SET_TOKEN_SENDER_ROLE()).to.eq(id('setTokenSender'))
      expect(await withdrawHook.SET_COLLATERAL_ROLE()).to.eq(id('setCollateral'))
      expect(await withdrawHook.SET_DEPOSIT_RECORD_ROLE()).to.eq(id('setDepositRecord'))
      expect(await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE()).to.eq(id('setGlobalPeriodLength'))
      expect(await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE()).to.eq(
        id('setGlobalWithdrawLimitPerPeriod')
      )
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_AFTER_FEE is ignored.
     */
    snapshotter.setupSnapshotContext('WithdrawHook-hook')
    before(async () => {
      await withdrawHook.setCollateral(fakeCollateral.address)
      await withdrawHook.connect(deployer).setDepositRecord(mockDepositRecord.address)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      await withdrawHook.connect(deployer).setTreasury(treasury.address)
      await withdrawHook.connect(deployer).setTokenSender(fakeTokenSender.address)
      await mockTestToken.connect(deployer).mint(fakeCollateral.address, TEST_AMOUNT_BEFORE_FEE)
      await mockTestToken.connect(deployer).mint(user.address, TEST_AMOUNT_BEFORE_FEE)
      await mockTestToken
        .connect(fakeCollateral.wallet)
        .approve(withdrawHook.address, ethers.constants.MaxUint256)
      fakeTokenSender.send.returns()
      fakeCollateral.getBaseToken.returns(mockTestToken.address)
      await snapshotter.saveSnapshot()
    })

    it('only callable by collateral', async () => {
      expect(await withdrawHook.getCollateral()).to.not.eq(user.address)

      await expect(
        withdrawHook
          .connect(user)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).to.revertedWith('msg.sender != collateral')
    })

    it('calls recordWithdrawal() with correct parameters', async () => {
      await withdrawHook
        .connect(fakeCollateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      expect(mockDepositRecord.recordWithdrawal).calledWith(TEST_AMOUNT_BEFORE_FEE)
    })

    it("doesn't revert if withdrawing 0", async () => {
      await withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 0, 0)
    })

    describe('fee reimbursement', () => {
      it('transfers fee to treasury if fee > 0', async () => {
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(mockTestToken.transferFrom).calledWith(fakeCollateral.address, treasury.address, fee)
      })

      it('calls tokenSender.send() if fee > 0 and funder = recipient', async () => {
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(fakeTokenSender.send).calledWith(user.address, fee)
      })

      it('calls tokenSender.send() if fee > 0 and funder != recipient', async () => {
        expect(user.address).not.eq(recipient.address)
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, recipient.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(fakeTokenSender.send).calledWith(recipient.address, fee)
      })

      it("doesn't transfer fee to treasury if fee = 0", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

        expect(mockTestToken.transferFrom).not.called
      })

      it("doesn't call tokenSender.send() if fee = 0", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

        expect(fakeTokenSender.send).not.called
      })
    })

    describe('global withdraw limit testing', () => {
      it('sets last global reset to current time if 0', async () => {
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(0)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(
          await getLastTimestamp(ethers.provider)
        )
      })

      it('sets last global reset to current time if global period passed', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const currentResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(currentResetTimestamp).to.be.gt(previousResetTimestamp)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(currentResetTimestamp)
      })

      it('sets global amount withdrawn to current amount being withdrawn if global period passed', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const differentAmountToWithdraw = 1
        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.not.eq(
          differentAmountToWithdraw
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, differentAmountToWithdraw, differentAmountToWithdraw)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          differentAmountToWithdraw
        )
      })

      it("doesn't update last global reset if global period exactly reached", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to amount withdrawn if global period exactly reached', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousGlobalAmountWithdrawn =
          await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          previousGlobalAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it("doesn't update last global reset if global period not reached", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to global amount withdrawn if global period not reached', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousGlobalAmountWithdrawn =
          await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          previousGlobalAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it('adds to global amount withdrawn if global withdraw limit exactly reached for period', async () => {
        // Using deployer and user since we need 2 users to meet global cap
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(
            deployer.address,
            deployer.address,
            TEST_GLOBAL_WITHDRAW_LIMIT,
            TEST_GLOBAL_WITHDRAW_LIMIT
          )
        const globalWithdrawnBefore = await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )
        const amountToReachGlobalLimit = TEST_GLOBAL_WITHDRAW_LIMIT.sub(globalWithdrawnBefore)

        await expect(
          withdrawHook
            .connect(fakeCollateral.wallet)
            .hook(user.address, user.address, amountToReachGlobalLimit, amountToReachGlobalLimit)
        ).to.not.reverted
      })

      it('reverts if global withdraw limit exceeded for period', async () => {
        // Using deployer and user since we need 2 users to exceed global cap
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(
            deployer.address,
            deployer.address,
            TEST_GLOBAL_WITHDRAW_LIMIT,
            TEST_GLOBAL_WITHDRAW_LIMIT
          )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        const amountToReachGlobalLimit = TEST_GLOBAL_WITHDRAW_LIMIT.sub(TEST_GLOBAL_WITHDRAW_LIMIT)
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, amountToReachGlobalLimit, amountToReachGlobalLimit)
        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          TEST_GLOBAL_WITHDRAW_LIMIT
        )
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 1, 1)
        ).revertedWith('Global withdraw limit exceeded')
      })
    })

    it('reverts if global cap already exceeded', async () => {
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      await withdrawHook
        .connect(fakeCollateral.wallet)
        .hook(user.address, user.address, TEST_GLOBAL_WITHDRAW_LIMIT, TEST_GLOBAL_WITHDRAW_LIMIT)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT.sub(1))

      const tx = withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 0, 0)

      await expect(tx).revertedWith('Global withdraw limit exceeded')
    })

    it('reverts if first withdraw for period exceeds global limit', async () => {
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      const tx = withdrawHook
        .connect(fakeCollateral.wallet)
        .hook(
          user.address,
          user.address,
          TEST_GLOBAL_WITHDRAW_LIMIT.add(1),
          TEST_GLOBAL_WITHDRAW_LIMIT.add(1)
        )

      await expect(tx).revertedWith('Global withdraw limit exceeded')
    })

    afterEach(() => {
      fakeTokenSender.send.reset()
      mockTestToken.transferFrom.reset()
    })
  })

  describe('# setCollateral', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_COLLATERAL_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setCollateral(fakeCollateral.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_COLLATERAL_ROLE(), deployer.address)
      ).to.eq(true)

      await withdrawHook.connect(deployer).setCollateral(fakeCollateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_DEPOSIT_RECORD_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setDepositRecord(mockDepositRecord.address)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })
  })

  describe('# setGlobalPeriodLength', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE()}`
      )
    })

    it('reverts if > max period length', async () => {
      await expect(
        withdrawHook.connect(deployer).setGlobalPeriodLength(MAX_GLOBAL_PERIOD_LENGTH + 1)
      ).revertedWith('Exceeds period limit')
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(0)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(0)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)
    })

    it('sets to max period length', async () => {
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(MAX_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(MAX_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(MAX_GLOBAL_PERIOD_LENGTH)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)
    })

    it('emits GlobalPeriodLengthChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      await expect(tx)
        .to.emit(withdrawHook, 'GlobalPeriodLengthChange')
        .withArgs(TEST_GLOBAL_PERIOD_LENGTH)
    })
  })

  describe('# setGlobalWithdrawLimitPerPeriod', () => {
    snapshotter.setupSnapshotContext('WithdrawHook-setGlobalWithdrawLimitPerPeriod')
    before(async () => {
      await withdrawHook.connect(deployer).setDepositRecord(mockDepositRecord.address)
    })

    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(
          await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE()}`
      )
    })

    it('reverts if set to 0', async () => {
      await expect(withdrawHook.connect(deployer).setGlobalWithdrawLimitPerPeriod(0)).revertedWith(
        'Limit too low'
      )
    })

    it('reverts if set to < raw min if raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)

      await expect(
        withdrawHook
          .connect(deployer)
          .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.sub(1))
      ).revertedWith('Limit too low')
    })

    it('reverts if set to < raw min if raw min = percent min', async () => {
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)

      await expect(
        withdrawHook
          .connect(deployer)
          .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.sub(1))
      ).revertedWith('Limit too low')
    })

    it('reverts if set to > raw min and < percent min if raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)

      await expect(
        withdrawHook
          .connect(deployer)
          .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin.sub(1))
      ).revertedWith('Limit too low')
    })

    it('sets to > raw min if raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1))

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )
    })

    it('sets to raw min if raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('sets to > raw min if raw min = percent min', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1))

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )
    })

    it('sets to raw min if raw min = percent min', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('sets to > percent min if raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        percentMinGreaterThanRawMin.add(1)
      )
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin.add(1))

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(
        percentMinGreaterThanRawMin.add(1)
      )
    })

    it('sets to percent min if raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).not.eq(
        percentMinGreaterThanRawMin
      )
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).eq(percentMinGreaterThanRawMin)
    })

    it('emits GlobalWithdrawLimitPerPeriodChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      await expect(tx)
        .to.emit(withdrawHook, 'GlobalWithdrawLimitPerPeriodChange')
        .withArgs(TEST_GLOBAL_WITHDRAW_LIMIT)
    })

    afterEach(() => {
      mockDepositRecord.getGlobalNetDepositAmount.reset()
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TREASURY_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setTreasury(treasury.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_TREASURY_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TREASURY_ROLE(), deployer.address)
      ).to.eq(true)

      await withdrawHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TOKEN_SENDER_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setTokenSender(fakeTokenSender.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_TOKEN_SENDER_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TOKEN_SENDER_ROLE(), deployer.address)
      ).to.eq(true)

      await withdrawHook.connect(deployer).setTokenSender(fakeTokenSender.address)
    })
  })

  describe('# getEffectiveGlobalWithdrawLimitPerPeriod', () => {
    snapshotter.setupSnapshotContext('WithdrawHook-getEffectiveGlobalWithdrawLimitPerPeriod')
    before(async () => {
      await withdrawHook.connect(deployer).setDepositRecord(mockDepositRecord.address)
    })

    it('returns set limit if set > min and raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1))

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )
    })

    it('returns set limit if set > min and raw min = percent min', async () => {
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1))

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.add(1)
      )
    })

    it('returns set limit if set > min and raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin.add(1))

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        percentMinGreaterThanRawMin.add(1)
      )
    })

    it('returns set limit if set = min and raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)
      await withdrawHook.setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD)

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('returns set limit if set = min and raw min = percent min', async () => {
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)
      await withdrawHook.setGlobalWithdrawLimitPerPeriod(MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD)

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('returns set limit if set = min and raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin)

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        percentMinGreaterThanRawMin
      )
    })

    it('returns min limit if set < min and raw min > percent min', async () => {
      expect(await mockDepositRecord.getGlobalNetDepositAmount()).eq(0)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).lt(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('returns min limit if set < min and raw min = percent min', async () => {
      const globalDepositAmountToReachMinLimit = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(
        PERCENT_DENOMINATOR
      ).div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToReachMinLimit)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).lt(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD
      )
    })

    it('returns min limit if set < min and raw min < percent min', async () => {
      const percentMinGreaterThanRawMin = MIN_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD.mul(2)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(percentMinGreaterThanRawMin.sub(1))
      // Change globalNetDepositAmount to cause min limit to exceed set limit
      const globalDepositAmountToExceedMinLimit = percentMinGreaterThanRawMin
        .mul(PERCENT_DENOMINATOR)
        .div(MIN_GLOBAL_WITHDRAW_LIMIT_PERCENT_PER_PERIOD)
      mockDepositRecord.getGlobalNetDepositAmount.returns(globalDepositAmountToExceedMinLimit)

      expect(await withdrawHook.getEffectiveGlobalWithdrawLimitPerPeriod()).eq(
        percentMinGreaterThanRawMin
      )
    })

    afterEach(() => {
      mockDepositRecord.getGlobalNetDepositAmount.reset()
    })
  })
})
