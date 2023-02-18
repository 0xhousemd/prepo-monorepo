import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { parseEther } from 'ethers/lib/utils'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { depositHookFixture, fakeAccountListFixture } from '../fixtures/HookFixture'
import { setAccountBalance, testRoleConstants } from '../utils'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { Snapshotter } from '../snapshots'
import { fakeDepositRecordFixture } from '../fixtures/DepositRecordFixture'
import {
  AccountList,
  Collateral,
  DepositHook,
  DepositRecord,
  TestERC20,
  TokenSender,
} from '../../types/generated'

chai.use(smock.matchers)

const { grantAndAcceptRole } = utils
const snapshotter = new Snapshotter()

describe('=> DepositHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let treasury: SignerWithAddress
  let depositHook: DepositHook
  let testToken: MockContract<TestERC20>
  let tokenSender: FakeContract<TokenSender>
  let depositRecord: FakeContract<DepositRecord>
  let collateral: FakeContract<Collateral>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1.01')
  const TEST_AMOUNT_AFTER_FEE = parseEther('1')

  snapshotter.setupSnapshotContext('DepositHook')
  before(async () => {
    ;[deployer, user, treasury] = await ethers.getSigners()
    testToken = await smockTestERC20Fixture('Test Token', 'TEST', 18)
    tokenSender = await fakeTokenSenderFixture()
    depositRecord = await fakeDepositRecordFixture()
    depositHook = await depositHookFixture()
    collateral = await fakeCollateralFixture()
    await setAccountBalance(collateral.address, '0.1')
    collateral.getBaseToken.returns(testToken.address)
    await grantAndAcceptRole(depositHook, deployer, deployer, await depositHook.SET_TREASURY_ROLE())
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_TOKEN_SENDER_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_COLLATERAL_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_DEPOSIT_RECORD_ROLE()
    )
    await grantAndAcceptRole(
      depositHook,
      deployer,
      deployer,
      await depositHook.SET_DEPOSITS_ALLOWED_ROLE()
    )
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await depositHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets role constants to the correct hash', async () => {
      await testRoleConstants([
        depositHook.SET_TREASURY_ROLE(),
        'setTreasury',
        depositHook.SET_TOKEN_SENDER_ROLE(),
        'setTokenSender',
        depositHook.SET_COLLATERAL_ROLE(),
        'setCollateral',
        depositHook.SET_DEPOSIT_RECORD_ROLE(),
        'setDepositRecord',
        depositHook.SET_DEPOSITS_ALLOWED_ROLE(),
        'setDepositsAllowed',
      ])
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_BEFORE_FEE is ignored.
     */
    snapshotter.setupSnapshotContext('DepositHook-hook')
    before(async () => {
      depositRecord.recordDeposit.returns()
      await depositHook.connect(deployer).setCollateral(collateral.address)
      await depositHook.connect(deployer).setDepositsAllowed(true)
      await depositHook.connect(deployer).setDepositRecord(depositRecord.address)
      await depositHook.connect(deployer).setTreasury(treasury.address)
      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
      await testToken.connect(deployer).mint(collateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken
        .connect(collateral.wallet)
        .approve(depositHook.address, ethers.constants.MaxUint256)
      await snapshotter.saveSnapshot()
    })

    it('should only usable by collateral', async () => {
      expect(await depositHook.getCollateral()).to.not.eq(user.address)

      await expect(
        depositHook
          .connect(user)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).revertedWith('msg.sender != collateral')
    })

    it('reverts if deposits not allowed', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(false)
      expect(await depositHook.depositsAllowed()).to.eq(false)

      await expect(
        depositHook
          .connect(collateral.wallet)
          .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).revertedWith('Deposits not allowed')
    })

    it('calls recordDeposit() if fee = 0', async () => {
      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(depositRecord.recordDeposit).calledWith(user.address, TEST_AMOUNT_BEFORE_FEE)
    })

    it('calls recordDeposit() if fee > 0', async () => {
      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      expect(depositRecord.recordDeposit).calledWith(user.address, TEST_AMOUNT_AFTER_FEE)
    })

    it('transfers fee to treasury if fee > 0', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(testToken.transferFrom).calledWith(collateral.address, treasury.address, fee)
    })

    it('calls tokenSender.send() if fee > 0', async () => {
      expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
      expect(tokenSender.send).calledWith(user.address, fee)
    })

    it("doesn't transfer fee to treasury if fee = 0", async () => {
      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(testToken.transferFrom).not.called
    })

    it("doesn't call tokenSender.send() if fee = 0", async () => {
      await depositHook
        .connect(collateral.wallet)
        .hook(user.address, user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

      expect(tokenSender.send).not.called
    })

    afterEach(() => {
      depositRecord.recordDeposit.reset()
      testToken.transferFrom.reset()
      tokenSender.send.reset()
    })
  })

  describe('# setCollateral', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLATERAL_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setCollateral(collateral.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_COLLATERAL_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setCollateral(collateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSIT_RECORD_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositRecord(depositRecord.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })
  })

  describe('# setDepositsAllowed', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_DEPOSITS_ALLOWED_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setDepositsAllowed(true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_DEPOSITS_ALLOWED_ROLE()}`
      )
    })

    it('sets to false', async () => {
      await depositHook.connect(deployer).setDepositsAllowed(true)
      expect(await depositHook.depositsAllowed()).to.not.eq(false)

      await depositHook.connect(deployer).setDepositsAllowed(false)

      expect(await depositHook.depositsAllowed()).to.eq(false)
    })

    it('sets to true', async () => {
      expect(await depositHook.depositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)
    })

    it('is idempotent', async () => {
      expect(await depositHook.depositsAllowed()).to.not.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)

      await depositHook.connect(deployer).setDepositsAllowed(true)

      expect(await depositHook.depositsAllowed()).to.eq(true)
    })

    it('emits DepositsAllowedChange', async () => {
      const tx = await depositHook.connect(deployer).setDepositsAllowed(true)

      await expect(tx).to.emit(depositHook, 'DepositsAllowedChange').withArgs(true)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not role holder', async () => {
      expect(await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), user.address)).to.eq(
        false
      )

      await expect(depositHook.connect(user).setTreasury(treasury.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TREASURY_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TREASURY_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositHook.connect(user).setTokenSender(tokenSender.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositHook.SET_TOKEN_SENDER_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await depositHook.hasRole(await depositHook.SET_TOKEN_SENDER_ROLE(), deployer.address)
      ).to.eq(true)

      await depositHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })
})
