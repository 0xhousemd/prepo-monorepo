import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { DEFAULT_ADMIN_ROLE } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { FakeContract } from '@defi-wonderland/smock'
import { depositRecordFixture } from '../fixtures/DepositRecordFixture'
import { AccountList, DepositRecord } from '../../types/generated'
import { fakeAccountListFixture } from '../fixtures/HookFixture'

const { grantAndAcceptRole } = utils

describe('=> DepositRecord', () => {
  let depositRecord: DepositRecord
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let uncappedUser: SignerWithAddress
  let bypassList: FakeContract<AccountList>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_USER_DEPOSIT_CAP = parseEther('10000')
  const TEST_AMOUNT_ONE = parseEther('1')
  const TEST_AMOUNT_TWO = parseEther('2')

  const getSignersAndDeployRecord = async (): Promise<void> => {
    ;[deployer, user, user2, uncappedUser] = await ethers.getSigners()
    depositRecord = await depositRecordFixture()
    bypassList = await fakeAccountListFixture()
  }

  const setupDepositRecord = async (): Promise<void> => {
    await getSignersAndDeployRecord()
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_ALLOWED_HOOK_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_ACCOUNT_LIST_ROLE()
    )
    await depositRecord.connect(deployer).setAllowedHook(user.address, true)
    await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_GLOBAL_DEPOSIT_CAP)
    await depositRecord.connect(deployer).setUserDepositCap(TEST_USER_DEPOSIT_CAP)
    await depositRecord.connect(deployer).setAccountList(bypassList.address)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await getSignersAndDeployRecord()
    })

    it('sets global deposit cap to 0', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).eq(0)
    })

    it('sets user deposit cap to 0', async () => {
      expect(await depositRecord.getUserDepositCap()).eq(0)
    })

    it('sets DEFAULT_ADMIN_ROLE holder to deployer', async () => {
      expect(await depositRecord.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()).to.eq(
        id('setGlobalNetDepositCap')
      )
      expect(await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()).to.eq(id('setUserDepositCap'))
      expect(await depositRecord.SET_ALLOWED_HOOK_ROLE()).to.eq(id('setAllowedHook'))
      expect(await depositRecord.SET_ACCOUNT_LIST_ROLE()).to.eq(id('setAccountList'))
    })
  })

  describe('# recordDeposit', () => {
    beforeEach(async () => {
      await setupDepositRecord()
    })

    it('should only be callable by allowed contracts', async () => {
      expect(await depositRecord.isHookAllowed(user2.address)).to.eq(false)

      await expect(
        depositRecord.connect(user2).recordDeposit(user.address, TEST_AMOUNT_TWO)
      ).revertedWith('msg.sender != allowed hook')
    })

    it("should correctly add 'amount' to both deposited totals when starting from zero", async () => {
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(0)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(0)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_AMOUNT_TWO)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(TEST_AMOUNT_TWO)
    })

    it("should correctly add 'amount' to both deposited totals when starting from a non-zero value", async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(user.address)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_ONE)
      )
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(
        userDepositsBefore.add(TEST_AMOUNT_ONE)
      )
    })

    it('adds to global and user deposit totals if uncapped user and user cap exceeded', async () => {
      expect(TEST_AMOUNT_TWO).gt(TEST_AMOUNT_ONE)
      await depositRecord.setUserDepositCap(TEST_AMOUNT_ONE)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(uncappedUser.address)

      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_TWO)
      )
      expect(await depositRecord.getUserDepositAmount(uncappedUser.address)).to.eq(
        userDepositsBefore.add(TEST_AMOUNT_TWO)
      )
    })

    it('adds to global and user deposit totals if uncapped user and user cap exceeded', async () => {
      expect(TEST_AMOUNT_TWO).gt(TEST_AMOUNT_ONE)
      await depositRecord.setUserDepositCap(TEST_AMOUNT_TWO)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(uncappedUser.address)

      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_ONE)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_ONE)
      )
      expect(await depositRecord.getUserDepositAmount(uncappedUser.address)).to.eq(
        userDepositsBefore.add(TEST_AMOUNT_ONE)
      )
    })

    it('adds to global and user totals if uncapped user below caps and starting from non-zero value', async () => {
      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)
      await depositRecord.setUserDepositCap(TEST_AMOUNT_ONE)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(uncappedUser.address)

      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_TWO)
      )
      expect(await depositRecord.getUserDepositAmount(uncappedUser.address)).to.eq(
        userDepositsBefore.add(TEST_AMOUNT_TWO)
      )
    })

    it('reverts if uncapped user and global cap exceeded', async () => {
      const globalDepositAmountCap = TEST_AMOUNT_TWO.add(TEST_AMOUNT_ONE)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(globalDepositAmountCap)
      expect(await depositRecord.getGlobalNetDepositCap()).eq(globalDepositAmountCap)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)

      const tx = depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)

      await expect(tx).revertedWith('Global deposit cap exceeded')
    })

    it('should revert if per-account deposit cap is exceeded', async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(TEST_USER_DEPOSIT_CAP)

      await expect(depositRecord.connect(user).recordDeposit(user.address, 1)).revertedWith(
        'User deposit cap exceeded'
      )
    })

    it('should revert if global deposit cap is exceeded', async () => {
      const accountsToReachCap = TEST_GLOBAL_DEPOSIT_CAP.div(TEST_USER_DEPOSIT_CAP).toNumber()
      const allSigners = await ethers.getSigners()
      for (let i = 0; i < accountsToReachCap; i++) {
        const currentAccountAddress = allSigners[i].address
        // eslint-disable-next-line no-await-in-loop
        await depositRecord
          .connect(user)
          .recordDeposit(currentAccountAddress, TEST_USER_DEPOSIT_CAP)
        // eslint-disable-next-line no-await-in-loop
        expect(await depositRecord.getUserDepositAmount(currentAccountAddress)).to.eq(
          TEST_USER_DEPOSIT_CAP
        )
      }
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_GLOBAL_DEPOSIT_CAP)
      const lastAccountAddress = allSigners[accountsToReachCap].address

      await expect(depositRecord.connect(user).recordDeposit(lastAccountAddress, 1)).revertedWith(
        'Global deposit cap exceeded'
      )
    })

    afterEach(() => {
      bypassList.isIncluded.reset()
    })
  })

  describe('# recordWithdrawal', () => {
    beforeEach(async () => {
      await setupDepositRecord()
      await depositRecord
        .connect(user)
        .recordDeposit(user.address, TEST_AMOUNT_ONE.add(TEST_AMOUNT_TWO))
    })

    it('reverts if caller not allowed', async () => {
      expect(await depositRecord.isHookAllowed(user2.address)).to.eq(false)

      await expect(depositRecord.connect(user2).recordWithdrawal(TEST_AMOUNT_TWO)).revertedWith(
        'msg.sender != allowed hook'
      )
    })

    it('subtracts from global deposits if withdrawal > 0 and global deposits > 0', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBefore.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if withdrawal > 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits > 0', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(globalDepositAmountBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getGlobalNetDepositAmount())
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).to.be.eq(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(globalDepositAmountBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getUserDepositAmount(user.address))
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('sets global deposits to 0 if withdrawal > global deposits', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(globalDepositAmountBefore.add(1))

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(0)
    })

    it('leaves user deposits unchanged if withdrawal > global deposits', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(userDepositBefore.add(1))

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('subtracts from global deposits if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const globalDepositAmountBeforeSecondWithdrawal =
        await depositRecord.getGlobalNetDepositAmount()

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositAmountBeforeSecondWithdrawal.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const userDepositBeforeSecondWithdrawal = await depositRecord.getUserDepositAmount(
        user.address
      )

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(
        userDepositBeforeSecondWithdrawal
      )
    })
  })

  describe('# setGlobalNetDepositCap', () => {
    const differentCapToTestWith = TEST_GLOBAL_DEPOSIT_CAP.add(1)
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(
          await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        depositRecord.connect(user).setGlobalNetDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(0)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(0)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(0)
    })

    it('should correctly set the same value twice', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(differentCapToTestWith)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should emit a GlobalNetDepositCapChange event', async () => {
      const tx = await depositRecord
        .connect(deployer)
        .setGlobalNetDepositCap(differentCapToTestWith)

      await expect(tx)
        .to.emit(depositRecord, 'GlobalNetDepositCapChange')
        .withArgs(differentCapToTestWith)
    })
  })

  describe('# setUserDepositCap', () => {
    const differentCapToTestWith = TEST_USER_DEPOSIT_CAP.add(1)
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_USER_DEPOSIT_CAP_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        depositRecord.connect(user).setUserDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getUserDepositCap()).to.not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).to.not.eq(0)

      await depositRecord.connect(deployer).setUserDepositCap(0)

      expect(await depositRecord.getUserDepositCap()).to.eq(0)
    })

    it('should correctly set the same value twice', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should emit a UserDepositCapChange event', async () => {
      const tx = await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      await expect(tx)
        .to.emit(depositRecord, 'UserDepositCapChange')
        .withArgs(differentCapToTestWith)
    })
  })

  describe('# setAccountList', () => {
    beforeEach(async () => {
      await setupDepositRecord()
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_ACCOUNT_LIST_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositRecord.connect(user).setAccountList(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_ACCOUNT_LIST_ROLE()}`
      )
    })

    it("doesn't revert if role holder", async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_ACCOUNT_LIST_ROLE(), deployer.address)
      ).to.eq(true)

      await depositRecord.connect(deployer).setAccountList(user.address)
    })
  })

  describe('# setAllowedHook', () => {
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_ALLOWED_HOOK_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_ALLOWED_HOOK_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositRecord.connect(user).setAllowedHook(deployer.address, true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_ALLOWED_HOOK_ROLE()}`
      )
    })

    it('should be able to set the allowed status of an account to true', async () => {
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)
    })

    it('should be able to set the allowed status of an account to false', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)
    })

    it('should be able to set the allowed status of an account to true more than once', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)
    })

    it('should be able to set the allowed status of an account to false more than once', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)
    })

    it('should emit a AllowedHooksChange event', async () => {
      const tx = await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      await expect(tx).to.emit(depositRecord, 'AllowedHooksChange').withArgs(deployer.address, true)
    })
  })
})
