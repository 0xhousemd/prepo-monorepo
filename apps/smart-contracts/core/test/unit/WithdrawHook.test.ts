import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { batchGrantAndAcceptRoles, grantAndAcceptRole, utils } from 'prepo-hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { fakeAccountListFixture, withdrawHookFixture } from '../fixtures/HookFixture'
import { smockDepositRecordFixture } from '../fixtures/DepositRecordFixture'
import { setAccountBalance } from '../utils'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { smockTokenSenderFixture } from '../fixtures/TokenSenderFixture'
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

describe('=> WithdrawHook', () => {
  let withdrawHook: WithdrawHook
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let treasury: SignerWithAddress
  let allowList: FakeContract<AccountList>
  let mockTestToken: MockContract<TestERC20>
  let fakeCollateral: FakeContract<Collateral>
  let mockDepositRecord: MockContract<DepositRecord>
  let fakeTokenSender: FakeContract<TokenSender>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1.01')
  const TEST_AMOUNT_AFTER_FEE = parseEther('1')
  const TEST_GLOBAL_PERIOD_LENGTH = 20
  const TEST_USER_PERIOD_LENGTH = 10
  const TEST_GLOBAL_WITHDRAW_LIMIT = TEST_AMOUNT_BEFORE_FEE.mul(3)
  const TEST_USER_WITHDRAW_LIMIT = TEST_AMOUNT_BEFORE_FEE.mul(2)

  beforeEach(async () => {
    ;[deployer, user, treasury] = await ethers.getSigners()
    withdrawHook = await withdrawHookFixture()
    mockTestToken = await smockTestERC20Fixture('Test Token', 'TEST', 18)
    fakeCollateral = await fakeCollateralFixture()
    allowList = await fakeAccountListFixture()
    fakeCollateral.getBaseToken.returns(mockTestToken.address)
    await setAccountBalance(fakeCollateral.address, '0.1')
    mockDepositRecord = await smockDepositRecordFixture()
    fakeTokenSender = await smockTokenSenderFixture(mockTestToken.address)
    await roleAssigners.assignWithdrawHookRoles(deployer, deployer, withdrawHook)
    await roleAssigners.assignDepositRecordRoles(deployer, deployer, mockDepositRecord)
    await mockDepositRecord.connect(deployer).setAllowedMsgSenders(allowList.address)
    await mockDepositRecord.connect(deployer).setAccountList(allowList.address)
    allowList.isIncluded.whenCalledWith(user.address).returns(true)
    allowList.isIncluded.whenCalledWith(withdrawHook.address).returns(true)
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets last global period reset to 0', async () => {
      expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(0)
    })

    it('sets last user period reset to 0', async () => {
      expect(await withdrawHook.getLastUserPeriodReset()).to.eq(0)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await withdrawHook.SET_TREASURY_ROLE()).to.eq(id('setTreasury'))
      expect(await withdrawHook.SET_TOKEN_SENDER_ROLE()).to.eq(id('setTokenSender'))
      expect(await withdrawHook.SET_COLLATERAL_ROLE()).to.eq(id('setCollateral'))
      expect(await withdrawHook.SET_DEPOSIT_RECORD_ROLE()).to.eq(id('setDepositRecord'))
      expect(await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE()).to.eq(id('setWithdrawalsAllowed'))
      expect(await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE()).to.eq(id('setGlobalPeriodLength'))
      expect(await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE()).to.eq(id('setUserPeriodLength'))
      expect(await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE()).to.eq(
        id('setGlobalWithdrawLimitPerPeriod')
      )
      expect(await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE()).to.eq(
        id('setUserWithdrawLimitPerPeriod')
      )
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_AFTER_FEE is ignored.
     */
    beforeEach(async () => {
      await withdrawHook.setCollateral(fakeCollateral.address)
      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)
      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setDepositRecord(mockDepositRecord.address)
      await withdrawHook.connect(deployer).setTreasury(treasury.address)
      await withdrawHook.connect(deployer).setTokenSender(fakeTokenSender.address)
      await mockTestToken.connect(deployer).mint(fakeCollateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await mockTestToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await mockTestToken
        .connect(fakeCollateral.wallet)
        .approve(withdrawHook.address, ethers.constants.MaxUint256)
      fakeTokenSender.send.returns()
      fakeCollateral.getBaseToken.returns(mockTestToken.address)
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
        mockTestToken.transferFrom.reset()
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(mockTestToken.transferFrom).calledWith(fakeCollateral.address, treasury.address, fee)
      })

      it('calls tokenSender.send() if fee > 0', async () => {
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(fakeTokenSender.send).calledWith(user.address, fee)
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
            TEST_USER_WITHDRAW_LIMIT,
            TEST_USER_WITHDRAW_LIMIT
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
            TEST_USER_WITHDRAW_LIMIT,
            TEST_USER_WITHDRAW_LIMIT
          )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        const amountToReachGlobalLimit = TEST_GLOBAL_WITHDRAW_LIMIT.sub(TEST_USER_WITHDRAW_LIMIT)
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

    describe('user withdraw limit testing', () => {
      it('sets last user reset to current time if 0', async () => {
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(0)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(
          await getLastTimestamp(ethers.provider)
        )
      })

      it('sets last user reset to current time if user period passed', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const currentResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(currentResetTimestamp)
      })

      it('sets user amount withdrawn to current amount being withdrawn if user period passed', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        /**
         * Using a different withdrawal amount to prevent a false positive if
         * the last amount withdrawn doesn't change. Using 2 as a value since
         * we want to show that `amountBeforeFee` is used rather than
         * `amountAfterFee` and 1 is already the smallest non-zero value.
         */
        const differentAmountToWithdraw = 2
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.not.eq(
          differentAmountToWithdraw
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(
            user.address,
            user.address,
            differentAmountToWithdraw,
            differentAmountToWithdraw - 1
          )

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          differentAmountToWithdraw
        )
      })

      it("doesn't update last user reset if user period exactly reached", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_USER_PERIOD_LENGTH)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to amount withdrawn if user period exactly reached', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousUserAmountWithdrawn = await withdrawHook.getAmountWithdrawnThisPeriod(
          user.address
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_USER_PERIOD_LENGTH)

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          previousUserAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it("doesn't update last user reset if user period not reached", async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to user amount withdrawn if user period not reached', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousUserAmountWithdrawn = await withdrawHook.getAmountWithdrawnThisPeriod(
          user.address
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          previousUserAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it('reverts if user withdraw limit exceeded for period', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 1, 1)
        ).revertedWith('User withdraw limit exceeded')
      })

      it('adds to user amount withdrawn if user withdraw limit exactly reached for period', async () => {
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(
            user.address,
            user.address,
            TEST_USER_WITHDRAW_LIMIT.sub(1),
            TEST_USER_WITHDRAW_LIMIT.sub(1)
          )

        await expect(
          withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 1, 1)
        ).to.not.reverted
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
      })

      it('reverts if user withdraw limit exceeded for period', async () => {
        await withdrawHook
          .connect(fakeCollateral.wallet)
          .hook(user.address, user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(fakeCollateral.wallet).hook(user.address, user.address, 1, 1)
        ).revertedWith('User withdraw limit exceeded')
      })
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

  describe('# setWithdrawalsAllowed', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setWithdrawalsAllowed(true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE()}`
      )
    })

    it('sets to false', async () => {
      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(false)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(false)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(false)
    })

    it('sets to true', async () => {
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)
    })

    it('emits WithdrawalsAllowedChange', async () => {
      const tx = await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      await expect(tx).to.emit(withdrawHook, 'WithdrawalsAllowedChange').withArgs(true)
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

  describe('# setUserPeriodLength', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(0)

      await withdrawHook.connect(deployer).setUserPeriodLength(0)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)
    })

    it('emits UserPeriodLengthChange', async () => {
      const tx = await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      await expect(tx)
        .to.emit(withdrawHook, 'UserPeriodLengthChange')
        .withArgs(TEST_USER_PERIOD_LENGTH)
    })
  })

  describe('# setGlobalWithdrawLimitPerPeriod', () => {
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

    it('sets to zero', async () => {
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(0)

      await withdrawHook.connect(deployer).setGlobalWithdrawLimitPerPeriod(0)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(
        TEST_GLOBAL_WITHDRAW_LIMIT
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(
        TEST_GLOBAL_WITHDRAW_LIMIT
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)
    })

    it('emits GlobalWithdrawLimitPerPeriodChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      await expect(tx)
        .to.emit(withdrawHook, 'GlobalWithdrawLimitPerPeriodChange')
        .withArgs(TEST_GLOBAL_WITHDRAW_LIMIT)
    })
  })

  describe('# setUserWithdrawLimitPerPeriod', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(
          await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(0)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(0)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)
    })

    it('emits UserWithdrawLimitPerPeriodChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      await expect(tx)
        .to.emit(withdrawHook, 'UserWithdrawLimitPerPeriodChange')
        .withArgs(TEST_USER_WITHDRAW_LIMIT)
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
})
