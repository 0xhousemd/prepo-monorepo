/* eslint-disable func-names */
import chai, { expect } from 'chai'
import { ethers, network, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther, parseUnits } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import {
  COLLATERAL_FEE_LIMIT,
  DEFAULT_ADMIN_ROLE,
  PERCENT_DENOMINATOR,
  ZERO_ADDRESS,
} from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { fakeDepositHookFixture, fakeWithdrawHookFixture } from '../fixtures/HookFixture'
import { collateralFixture } from '../fixtures/CollateralFixture'
import { testERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { roleAssigners } from '../../helpers'
import {
  Collateral,
  DepositHook,
  TestERC20,
  TokenSender,
  WithdrawHook,
} from '../../types/generated'

chai.use(smock.matchers)

const { grantAndAcceptRole } = utils

describe('=> Collateral', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let baseToken: TestERC20
  let collateral: Collateral
  let depositHook: FakeContract<DepositHook>
  let withdrawHook: FakeContract<WithdrawHook>
  let tokenSender: FakeContract<TokenSender>
  let snapshotBeforeAllTests: string
  let snapshotBeforeEachTest: string
  const TEST_DEPOSIT_FEE = 1000 // 0.1%
  const TEST_WITHDRAW_FEE = 2000 // 0.2%
  const USDC_DECIMALS = 6
  const USDC_DENOMINATOR = 10 ** USDC_DECIMALS

  const getSignersAndDeployContracts = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    ;[deployer, user, recipient] = await ethers.getSigners()
    baseToken = await testERC20Fixture('Test Coin', 'TST', baseTokenDecimals)
    collateral = await collateralFixture(
      'prePO USDC Collateral',
      'preUSDC',
      baseToken.address,
      baseTokenDecimals
    )
    depositHook = await fakeDepositHookFixture()
    withdrawHook = await fakeWithdrawHookFixture()
    tokenSender = await fakeTokenSenderFixture()
  }

  const setupDepositHook = (): void => {
    depositHook.getCollateral.returns(collateral.address)
    depositHook.depositsAllowed.returns(true)
    depositHook.getTreasury.returns(deployer.address)
    depositHook.getTokenSender.returns(tokenSender.address)
  }

  const setupWithdrawHook = (): void => {
    withdrawHook.getCollateral.returns(collateral.address)
    withdrawHook.getTreasury.returns(deployer.address)
    withdrawHook.getTokenSender.returns(tokenSender.address)
  }

  const setupCollateralRoles = async (): Promise<void> => {
    await roleAssigners.assignCollateralRoles(deployer, deployer, collateral)
  }

  const setupCollateralStackForDeposits = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    await getSignersAndDeployContracts(baseTokenDecimals)
    await setupCollateralRoles()
    await setupDepositHook()
  }

  const setupCollateralStackForWithdrawals = async (
    baseTokenDecimals: number = USDC_DECIMALS
  ): Promise<void> => {
    await setupCollateralStackForDeposits(baseTokenDecimals)
    await setupWithdrawHook()
  }

  before(async () => {
    upgrades.silenceWarnings()
    snapshotBeforeAllTests = await ethers.provider.send('evm_snapshot', [])
  })

  describe('initial state', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('sets base token from constructor', async () => {
      expect(await collateral.getBaseToken()).to.eq(baseToken.address)
    })

    it('sets name from initialize', async () => {
      expect(await collateral.name()).to.eq('prePO USDC Collateral')
    })

    it('sets symbol from initialize', async () => {
      expect(await collateral.symbol()).to.eq('preUSDC')
    })

    it('sets DEFAULT_ADMIN_ROLE holder to deployer', async () => {
      expect(await collateral.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true)
    })

    it('sets PERCENT_DENOMINATOR constant', async () => {
      expect(await collateral.PERCENT_DENOMINATOR()).to.eq(PERCENT_DENOMINATOR)
    })

    it('sets FEE_LIMIT constant', async () => {
      expect(await collateral.FEE_LIMIT()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await collateral.SET_DEPOSIT_FEE_ROLE()).to.eq(id('setDepositFee'))
      expect(await collateral.SET_WITHDRAW_FEE_ROLE()).to.eq(id('setWithdrawFee'))
      expect(await collateral.SET_DEPOSIT_HOOK_ROLE()).to.eq(id('setDepositHook'))
      expect(await collateral.SET_WITHDRAW_HOOK_ROLE()).to.eq(id('setWithdrawHook'))
    })
  })

  describe('# setDepositFee', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_DEPOSIT_FEE_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(await collateral.hasRole(await collateral.SET_DEPOSIT_FEE_ROLE(), user.address)).to.eq(
        false
      )

      await expect(collateral.connect(user).setDepositFee(TEST_DEPOSIT_FEE)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_FEE_ROLE()}`
      )
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        collateral.connect(deployer).setDepositFee(COLLATERAL_FEE_LIMIT + 1)
      ).revertedWith('Exceeds fee limit')
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await collateral.getDepositFee()).to.not.eq(COLLATERAL_FEE_LIMIT)

      await collateral.connect(deployer).setDepositFee(COLLATERAL_FEE_LIMIT)

      expect(await collateral.getDepositFee()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await collateral.getDepositFee()).to.not.eq(COLLATERAL_FEE_LIMIT - 1)

      await collateral.connect(deployer).setDepositFee(COLLATERAL_FEE_LIMIT - 1)

      expect(await collateral.getDepositFee()).to.eq(COLLATERAL_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)
      expect(await collateral.getDepositFee()).to.not.eq(0)

      await collateral.connect(deployer).setDepositFee(0)

      expect(await collateral.getDepositFee()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositFee()).to.not.eq(TEST_DEPOSIT_FEE)

      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      expect(await collateral.getDepositFee()).to.eq(TEST_DEPOSIT_FEE)

      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      expect(await collateral.getDepositFee()).to.eq(TEST_DEPOSIT_FEE)
    })

    it('emits DepositFeeChange', async () => {
      const tx = await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)

      await expect(tx).to.emit(collateral, 'DepositFeeChange').withArgs(TEST_DEPOSIT_FEE)
    })
  })

  describe('# setWithdrawFee', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_WITHDRAW_FEE_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_FEE_ROLE(), user.address)
      ).to.eq(false)

      await expect(collateral.connect(user).setWithdrawFee(TEST_WITHDRAW_FEE)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_FEE_ROLE()}`
      )
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        collateral.connect(deployer).setWithdrawFee(COLLATERAL_FEE_LIMIT + 1)
      ).revertedWith('Exceeds fee limit')
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await collateral.getWithdrawFee()).to.not.eq(COLLATERAL_FEE_LIMIT)

      await collateral.connect(deployer).setWithdrawFee(COLLATERAL_FEE_LIMIT)

      expect(await collateral.getWithdrawFee()).to.eq(COLLATERAL_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await collateral.getWithdrawFee()).to.not.eq(COLLATERAL_FEE_LIMIT - 1)

      await collateral.connect(deployer).setWithdrawFee(COLLATERAL_FEE_LIMIT - 1)

      expect(await collateral.getWithdrawFee()).to.eq(COLLATERAL_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)
      expect(await collateral.getWithdrawFee()).to.not.eq(0)

      await collateral.connect(deployer).setWithdrawFee(0)

      expect(await collateral.getWithdrawFee()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawFee()).to.not.eq(TEST_WITHDRAW_FEE)

      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      expect(await collateral.getWithdrawFee()).to.eq(TEST_WITHDRAW_FEE)

      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      expect(await collateral.getWithdrawFee()).to.eq(TEST_WITHDRAW_FEE)
    })

    it('emits WithdrawFeeChange', async () => {
      const tx = await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)

      await expect(tx).to.emit(collateral, 'WithdrawFeeChange').withArgs(TEST_WITHDRAW_FEE)
    })
  })

  describe('# setDepositHook', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_DEPOSIT_HOOK_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_DEPOSIT_HOOK_ROLE(), user.address)
      ).to.eq(false)

      await expect(collateral.connect(user).setDepositHook(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await collateral.SET_DEPOSIT_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user.address)

      await collateral.connect(deployer).setDepositHook(user.address)

      expect(await collateral.getDepositHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setDepositHook(user.address)
      expect(await collateral.getDepositHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setDepositHook(ZERO_ADDRESS)

      expect(await collateral.getDepositHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getDepositHook()).to.not.eq(user.address)

      await collateral.connect(deployer).setDepositHook(user.address)

      expect(await collateral.getDepositHook()).to.eq(user.address)

      await collateral.connect(deployer).setDepositHook(user.address)

      expect(await collateral.getDepositHook()).to.eq(user.address)
    })

    it('emits DepositHookChange', async () => {
      const tx = await collateral.connect(deployer).setDepositHook(user.address)

      await expect(tx).to.emit(collateral, 'DepositHookChange').withArgs(user.address)
    })
  })

  describe('# setWithdrawHook', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      await grantAndAcceptRole(
        collateral,
        deployer,
        deployer,
        await collateral.SET_WITHDRAW_HOOK_ROLE()
      )
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it('reverts if not role holder', async () => {
      expect(
        await collateral.hasRole(await collateral.SET_WITHDRAW_HOOK_ROLE(), user.address)
      ).to.eq(false)

      await expect(collateral.connect(user).setWithdrawHook(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await collateral.SET_WITHDRAW_HOOK_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user.address)

      await collateral.connect(deployer).setWithdrawHook(user.address)

      expect(await collateral.getWithdrawHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await collateral.connect(deployer).setWithdrawHook(user.address)
      expect(await collateral.getWithdrawHook()).to.not.eq(ZERO_ADDRESS)

      await collateral.connect(deployer).setWithdrawHook(ZERO_ADDRESS)

      expect(await collateral.getWithdrawHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await collateral.getWithdrawHook()).to.not.eq(user.address)

      await collateral.connect(deployer).setWithdrawHook(user.address)

      expect(await collateral.getWithdrawHook()).to.eq(user.address)

      await collateral.connect(deployer).setWithdrawHook(user.address)

      expect(await collateral.getWithdrawHook()).to.eq(user.address)
    })

    it('emits WithdrawHookChange', async () => {
      const tx = await collateral.connect(deployer).setWithdrawHook(user.address)

      await expect(tx).to.emit(collateral, 'WithdrawHookChange').withArgs(user.address)
    })
  })

  describe('# getBaseTokenBalance', () => {
    before(async () => {
      await getSignersAndDeployContracts()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    it("returns contract's base token balance", async () => {
      await baseToken.connect(deployer).mint(collateral.address, parseEther('1'))
      const contractBalance = await baseToken.balanceOf(collateral.address)
      expect(contractBalance).to.be.eq(parseEther('1'))

      expect(await collateral.getBaseTokenBalance()).to.eq(contractBalance)
    })
  })

  describe('# deposit', () => {
    let sender: SignerWithAddress
    before(async function () {
      await setupCollateralStackForDeposits()
      sender = user
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    beforeEach(async function () {
      if (this.currentTest?.title.includes('= base token decimals')) {
        await setupCollateralStackForDeposits(18)
      } else if (this.currentTest?.title.includes('< base token decimals')) {
        await setupCollateralStackForDeposits(19)
      } else if (this.currentTest?.title.includes('mints to sender if sender = recipient')) {
        /**
         * We have to reset the stack here and take a new snapshot, because now the global
         * contract variables have been overwritten by the special base token setups above.
         * If we do not update the snapshot, the contracts we setup to return back to 6 decimals
         * will be interacting with a network where they never existed.
         */
        await setupCollateralStackForDeposits()
        snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
      }
      await baseToken.mint(sender.address, parseUnits('1', await baseToken.decimals()))
      await baseToken
        .connect(sender)
        .approve(collateral.address, parseUnits('1', await baseToken.decimals()))
      await collateral.connect(deployer).setDepositFee(TEST_DEPOSIT_FEE)
      await collateral.connect(deployer).setDepositHook(depositHook.address)
    })

    it('reverts if deposit = 0 and deposit fee = 0%', async () => {
      await collateral.connect(deployer).setDepositFee(0)

      await expect(collateral.connect(sender).deposit(recipient.address, 0)).revertedWith(
        'base token amount = 0'
      )
    })

    it('reverts if deposit = 0 and deposit fee > 0%', async () => {
      expect(await collateral.getDepositFee()).to.be.gt(0)

      await expect(collateral.connect(sender).deposit(recipient.address, 0)).revertedWith('fee = 0')
    })

    it('reverts if deposit > 0, fee = 0, and deposit fee > 0%', async () => {
      expect(await collateral.getDepositFee()).to.be.gt(0)
      const amountToDeposit = BigNumber.from(1)
      // expect fee to be zero
      expect(amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)).to.eq(
        0
      )

      await expect(
        collateral.connect(sender).deposit(recipient.address, amountToDeposit)
      ).revertedWith('fee = 0')
    })

    it('reverts if insufficient approval', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      await baseToken.connect(sender).approve(collateral.address, amountToDeposit.sub(1))
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.lt(
        amountToDeposit
      )

      await expect(
        collateral.connect(sender).deposit(recipient.address, amountToDeposit)
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if insufficient balance', async () => {
      const amountToDeposit = (await baseToken.balanceOf(sender.address)).add(1)
      expect(amountToDeposit).to.be.gt(0)
      await baseToken.connect(sender).approve(collateral.address, amountToDeposit)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )

      await expect(
        collateral.connect(sender).deposit(recipient.address, amountToDeposit)
      ).revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if hook reverts', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      depositHook.hook.reverts()

      await expect(collateral.connect(sender).deposit(recipient.address, amountToDeposit)).reverted
    })

    it('transfers amount from sender to contract', async () => {
      const senderBTBefore = await baseToken.balanceOf(sender.address)
      const amountToDeposit = senderBTBefore
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )

      const tx = await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await baseToken.balanceOf(sender.address)).to.eq(senderBTBefore.sub(amountToDeposit))
      await expect(tx)
        .to.emit(baseToken, 'Transfer')
        .withArgs(sender.address, collateral.address, amountToDeposit)
    })

    it('approves fee for hook to use', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)

      const tx = await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, fee)
    })

    it('sets hook approval back to 0', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)

      const tx = await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, fee)
      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, depositHook.address, 0)
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals > base token decimals', async () => {
      expect(await collateral.decimals()).to.be.gt(await baseToken.decimals())
      const recipientCTBefore = await collateral.balanceOf(recipient.address)
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      const expectedCT = amountToDeposit.sub(fee).mul(parseEther('1')).div(USDC_DENOMINATOR)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await collateral.balanceOf(recipient.address)).to.eq(recipientCTBefore.add(expectedCT))
      expect(await collateral.balanceOf(sender.address)).to.eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).to.eq(await baseToken.decimals())
      const recipientCTBefore = await collateral.balanceOf(recipient.address)
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      const expectedCT = amountToDeposit.sub(fee)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await collateral.balanceOf(recipient.address)).to.eq(recipientCTBefore.add(expectedCT))
      expect(await collateral.balanceOf(sender.address)).to.eq(0)
    })

    it('mints decimal-adjusted amount to recipient if decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).to.be.lt(await baseToken.decimals())
      const recipientCTBefore = await collateral.balanceOf(recipient.address)
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      const expectedCT = amountToDeposit
        .sub(fee)
        .mul(parseEther('1'))
        .div(GREATER_DECIMAL_DENOMINATOR)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await collateral.balanceOf(recipient.address)).to.eq(recipientCTBefore.add(expectedCT))
      expect(await collateral.balanceOf(sender.address)).to.eq(0)
    })

    it('mints to sender if sender = recipient', async () => {
      recipient = sender
      const recipientCTBefore = await collateral.balanceOf(recipient.address)
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      const expectedCT = amountToDeposit.sub(fee).mul(parseEther('1')).div(USDC_DENOMINATOR)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await collateral.balanceOf(recipient.address)).to.eq(recipientCTBefore.add(expectedCT))
    })

    it('allows a deposit > 0 if deposit fee = 0%', async () => {
      await collateral.connect(deployer).setDepositFee(0)
      const senderBTBefore = await baseToken.balanceOf(sender.address)
      const contractBTBefore = await baseToken.balanceOf(collateral.address)
      const recipientCTBefore = await collateral.balanceOf(recipient.address)
      const amountToDeposit = senderBTBefore
      const feeAmount = amountToDeposit
        .mul(await collateral.getDepositFee())
        .div(PERCENT_DENOMINATOR)
      expect(feeAmount).to.eq(0)
      const expectedCT = amountToDeposit.mul(parseEther('1')).div(USDC_DENOMINATOR)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await baseToken.balanceOf(sender.address)).to.eq(senderBTBefore.sub(amountToDeposit))
      expect(await baseToken.balanceOf(collateral.address)).to.eq(
        contractBTBefore.add(amountToDeposit)
      )
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
      expect(await collateral.balanceOf(recipient.address)).to.eq(recipientCTBefore.add(expectedCT))
    })

    it('ignores hook if hook not set', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      await collateral.connect(deployer).setDepositHook(ZERO_ADDRESS)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(depositHook.hook).callCount(0)
    })

    it("doesn't give fee approval if hook not set", async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      expect(fee).to.be.gt(0)
      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
      await collateral.connect(deployer).setDepositHook(ZERO_ADDRESS)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(await baseToken.allowance(collateral.address, depositHook.address)).to.eq(0)
    })

    it('calls deposit hook with correct parameters', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)

      await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      expect(depositHook.hook).calledWith(
        sender.address,
        recipient.address,
        amountToDeposit,
        amountToDeposit.sub(fee)
      )
    })

    it('emits Deposit', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)

      const tx = await collateral.connect(sender).deposit(recipient.address, amountToDeposit)

      await expect(tx)
        .to.emit(collateral, 'Deposit')
        .withArgs(recipient.address, amountToDeposit.sub(fee), fee)
    })

    it('returns collateral minted', async () => {
      const amountToDeposit = await baseToken.balanceOf(sender.address)
      expect(amountToDeposit).to.be.gt(0)
      expect(await baseToken.allowance(sender.address, collateral.address)).to.be.eq(
        amountToDeposit
      )
      const fee = amountToDeposit.mul(await collateral.getDepositFee()).div(PERCENT_DENOMINATOR)
      const expectedCT = amountToDeposit.sub(fee).mul(parseEther('1')).div(USDC_DENOMINATOR)
      expect(expectedCT).to.be.gt(0)

      expect(
        await collateral.connect(sender).callStatic.deposit(recipient.address, amountToDeposit)
      ).to.eq(expectedCT)
    })

    afterEach(() => {
      depositHook.hook.reset()
    })
  })

  describe('# withdraw', () => {
    before(async function () {
      await setupCollateralStackForWithdrawals()
      snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
    })

    beforeEach(async function () {
      if (this.currentTest?.title.includes('= base token decimals')) {
        await setupCollateralStackForWithdrawals(18)
      } else if (this.currentTest?.title.includes('< base token decimals')) {
        await setupCollateralStackForWithdrawals(19)
      } else if (this.currentTest?.title.includes('sets hook approval back to 0')) {
        await setupCollateralStackForWithdrawals()
        snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
      }
      await baseToken.mint(user.address, parseUnits('1', await baseToken.decimals()))
      await baseToken
        .connect(user)
        .approve(collateral.address, parseUnits('1', await baseToken.decimals()))
      await collateral
        .connect(user)
        .deposit(user.address, parseUnits('1', await baseToken.decimals()))
      await collateral.connect(deployer).setWithdrawFee(TEST_WITHDRAW_FEE)
      await collateral.connect(deployer).setWithdrawHook(withdrawHook.address)
    })

    it('reverts if withdrawal = 0 and withdraw fee = 0%', async () => {
      await collateral.connect(deployer).setWithdrawFee(0)

      await expect(collateral.connect(user).withdraw(user.address, 0)).revertedWith(
        'base token amount = 0'
      )
    })

    it('reverts if withdrawal = 0 and withdraw fee > 0%', async () => {
      expect(await collateral.getWithdrawFee()).to.be.gt(0)

      await expect(collateral.connect(user).withdraw(user.address, 0)).revertedWith('fee = 0')
    })

    it('reverts if withdrawal > 0, fee = 0, and withdraw fee > 0%', async () => {
      /**
       * Given USDC precision is 6, and Collateral is 18, 1e12 will result in 0.000001 USDC
       * (the smallest amount) before fees, resulting in a fee of 0.
       */
      const amountToWithdraw = parseUnits('1', 12)
      const baseTokenToReceive = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const feeAmount = baseTokenToReceive
        .mul(await collateral.getWithdrawFee())
        .div(PERCENT_DENOMINATOR)
      expect(feeAmount).to.eq(0)
      expect(await collateral.getWithdrawFee()).to.be.gt(0)

      await expect(collateral.connect(user).withdraw(user.address, amountToWithdraw)).revertedWith(
        'fee = 0'
      )
    })

    it('reverts if base token returned is 0 and withdraw fee = 0%', async () => {
      await collateral.connect(deployer).setWithdrawFee(0)
      // Given USDC precision is 6, and Collateral is 18, anything below 1e12 will result in 0
      const amountToWithdraw = parseUnits('1', 12).sub(1)
      const baseTokenToReceive = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      expect(baseTokenToReceive).to.eq(0)

      await expect(collateral.connect(user).withdraw(user.address, amountToWithdraw)).revertedWith(
        'base token amount = 0'
      )
    })

    it('reverts if insufficient balance', async () => {
      const amountToWithdraw = (await collateral.balanceOf(user.address)).add(1)
      expect(amountToWithdraw).to.be.gt(0)

      await expect(collateral.connect(user).withdraw(user.address, amountToWithdraw)).revertedWith(
        'ERC20: burn amount exceeds balance'
      )
    })

    it('reverts if hook reverts', async () => {
      // Still providing valid inputs to ensure withdrawals are only reverting due to smock
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      withdrawHook.hook.reverts()

      await expect(collateral.connect(user).withdraw(user.address, amountToWithdraw)).reverted
      expect(withdrawHook.hook).callCount(1)
    })

    it("burns caller's collateral without approval", async () => {
      const totalSupplyBefore = await collateral.totalSupply()
      expect(totalSupplyBefore).to.be.gt(0)
      const userCTBefore = await collateral.balanceOf(user.address)
      const amountToWithdraw = userCTBefore
      expect(amountToWithdraw).to.be.gt(0)
      expect(await collateral.allowance(user.address, collateral.address)).to.be.eq(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(await collateral.totalSupply()).to.eq(totalSupplyBefore.sub(amountToWithdraw))
      expect(await collateral.balanceOf(user.address)).to.eq(userCTBefore.sub(amountToWithdraw))
      await expect(tx)
        .to.emit(collateral, 'Transfer')
        .withArgs(user.address, ZERO_ADDRESS, amountToWithdraw)
    })

    it('approves fee to hook adjusting for when decimals > base token decimals', async () => {
      expect(await collateral.decimals()).to.be.gt(await baseToken.decimals())
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, fee)
    })

    it('withdraws to recipient adjusting for when decimals > base token decimals', async () => {
      expect(await collateral.decimals()).to.be.gt(await baseToken.decimals())
      const userBTBefore = await baseToken.balanceOf(user.address)
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)

      await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(await baseToken.balanceOf(user.address)).to.eq(userBTBefore.add(expectedBT.sub(fee)))
    })

    it('approves fee to hook adjusting for when decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).to.eq(await baseToken.decimals())
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, fee)
    })

    it('withdraws to recipient adjusting for when decimals = base token decimals', async () => {
      // Setup 18 decimal base token
      expect(await collateral.decimals()).to.eq(await baseToken.decimals())
      const userBTBefore = await baseToken.balanceOf(user.address)
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)

      await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(await baseToken.balanceOf(user.address)).to.eq(userBTBefore.add(expectedBT.sub(fee)))
    })

    it('approves fee to hook adjusting for when decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).to.be.lt(await baseToken.decimals())
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      const expectedBT = amountToWithdraw.mul(GREATER_DECIMAL_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, fee)
    })

    it('withdraws to recipient adjusting for when decimals < base token decimals', async () => {
      // Setup 19 decimal base token
      expect(await collateral.decimals()).to.be.lt(await baseToken.decimals())
      const userBTBefore = await baseToken.balanceOf(user.address)
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const GREATER_DECIMAL_DENOMINATOR = parseUnits('1', (await collateral.decimals()) + 1)
      const expectedBT = amountToWithdraw.mul(GREATER_DECIMAL_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)

      await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(await baseToken.balanceOf(user.address)).to.eq(userBTBefore.add(expectedBT.sub(fee)))
    })

    it('sets hook approval back to 0', async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(fee).to.be.gt(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, fee)
      await expect(tx)
        .to.emit(baseToken, 'Approval')
        .withArgs(collateral.address, withdrawHook.address, 0)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.eq(0)
    })

    it('allows withdrawals if withdraw fee = 0%', async () => {
      await collateral.connect(deployer).setWithdrawFee(0)
      const userBTBefore = await baseToken.balanceOf(user.address)
      const contractBTBefore = await baseToken.balanceOf(collateral.address)
      const userCTBefore = await collateral.balanceOf(user.address)
      const amountToWithdraw = userCTBefore
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(await baseToken.balanceOf(user.address)).to.eq(userBTBefore.add(expectedBT))
      expect(await baseToken.balanceOf(collateral.address)).to.eq(contractBTBefore.sub(expectedBT))
      expect(await collateral.balanceOf(user.address)).to.eq(userCTBefore.sub(amountToWithdraw))
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)
    })

    it('withdraws to recipient if recipient != withdrawer', async () => {
      expect(user.address).not.eq(recipient.address)
      const userBTBefore = await baseToken.balanceOf(user.address)
      const recipientBTBefore = await baseToken.balanceOf(recipient.address)
      const amountToWithdraw = await collateral.balanceOf(user.address)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      expect(recipientBTBefore).to.eq(0)
      expect(amountToWithdraw).to.be.gt(0)
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      const tx = await collateral.connect(user).withdraw(recipient.address, amountToWithdraw)

      await expect(tx)
        .to.emit(collateral, 'Withdraw')
        .withArgs(user.address, recipient.address, expectedBT.sub(fee), fee)

      expect(userBTBefore).to.eq(await baseToken.balanceOf(user.address))
      expect(await baseToken.balanceOf(recipient.address)).to.eq(
        recipientBTBefore.add(expectedBT.sub(fee))
      )
    })

    it('ignores hook if hook not set', async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      await collateral.connect(deployer).setWithdrawHook(ZERO_ADDRESS)

      await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      expect(withdrawHook.hook).callCount(0)
    })

    it("doesn't give fee approval if hook not set", async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(fee).to.be.gt(0)
      await collateral.connect(deployer).setWithdrawHook(ZERO_ADDRESS)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.eq(0)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx).to.not.emit(baseToken, 'Approval')
    })

    it('calls withdraw hook with correct parameters', async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)

      await collateral.connect(user).withdraw(recipient.address, amountToWithdraw)

      expect(withdrawHook.hook).calledWith(
        user.address,
        recipient.address,
        expectedBT,
        expectedBT.sub(fee)
      )
    })

    it('emits Withdraw', async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)

      const tx = await collateral.connect(user).withdraw(user.address, amountToWithdraw)

      await expect(tx)
        .to.emit(collateral, 'Withdraw')
        .withArgs(user.address, user.address, expectedBT.sub(fee), fee)
    })

    it('returns base token transferred to user', async () => {
      const amountToWithdraw = await collateral.balanceOf(user.address)
      expect(amountToWithdraw).to.be.gt(0)
      const expectedBT = amountToWithdraw.mul(USDC_DENOMINATOR).div(parseEther('1'))
      const fee = expectedBT.mul(await collateral.getWithdrawFee()).div(PERCENT_DENOMINATOR)
      expect(fee).gt(0)
      expect(await baseToken.allowance(collateral.address, withdrawHook.address)).to.be.eq(0)

      expect(await collateral.connect(user).callStatic.withdraw(user.address, amountToWithdraw)).eq(
        expectedBT.sub(fee)
      )
    })

    afterEach(() => {
      withdrawHook.hook.reset()
    })
  })

  afterEach(async () => {
    // revert state of chain to after stacks have been initialized.
    await network.provider.send('evm_revert', [snapshotBeforeEachTest])
    // we need to store snapshot into a new id because you cannot use ids more than once with evm_revert.
    snapshotBeforeEachTest = await ethers.provider.send('evm_snapshot', [])
  })

  after(async () => {
    // revert state of chain to before the test ran.
    await network.provider.send('evm_revert', [snapshotBeforeAllTests])
    // we need to store snapshot into a new id because you cannot use ids more than once with evm_revert.
    snapshotBeforeAllTests = await ethers.provider.send('evm_snapshot', [])
  })
})
