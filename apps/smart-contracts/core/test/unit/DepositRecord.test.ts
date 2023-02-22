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
import { roleAssigners } from '../../helpers'

const { grantAndAcceptRole } = utils

describe('=> DepositRecord', () => {
  let depositRecord: DepositRecord
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let uncappedUser: SignerWithAddress
  let bypassList: FakeContract<AccountList>
  let allowlist: FakeContract<AccountList>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_USER_DEPOSIT_CAP = parseEther('10000')
  const TEST_AMOUNT_ONE = parseEther('1')
  const TEST_AMOUNT_TWO = parseEther('2')

  const getSignersAndDeployRecord = async (): Promise<void> => {
    ;[deployer, user, user2, uncappedUser] = await ethers.getSigners()
    depositRecord = await depositRecordFixture()
    bypassList = await fakeAccountListFixture()
    allowlist = await fakeAccountListFixture()
  }

  const setupDepositRecord = async (): Promise<void> => {
    await getSignersAndDeployRecord()
    await roleAssigners.assignDepositRecordRoles(deployer, deployer, depositRecord)
    await depositRecord.connect(deployer).setAccountList(allowlist.address)
    await depositRecord.connect(deployer).setAllowedMsgSenders(allowlist.address)
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
      expect(await depositRecord.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).eq(true)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()).eq(id('setGlobalNetDepositCap'))
      expect(await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()).eq(id('setUserDepositCap'))
      expect(await depositRecord.SET_ALLOWED_MSG_SENDERS_ROLE()).eq(id('setAllowedMsgSenders'))
      expect(await depositRecord.SET_ACCOUNT_LIST_ROLE()).eq(id('setAccountList'))
    })
  })

  describe('# recordDeposit', () => {
    beforeEach(async () => {
      await setupDepositRecord()
      allowlist.isIncluded.whenCalledWith(user.address).returns(true)
    })

    it('reverts if caller not allowed', async () => {
      expect(await allowlist.isIncluded(user2.address)).eq(false)

      await expect(
        depositRecord.connect(user2).recordDeposit(user.address, TEST_AMOUNT_TWO)
      ).revertedWith('msg.sender not allowed')
    })

    it("should correctly add 'amount' to both deposited totals when starting from zero", async () => {
      expect(await depositRecord.getGlobalNetDepositAmount()).eq(0)
      expect(await depositRecord.getUserDepositAmount(user.address)).eq(0)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(TEST_AMOUNT_TWO)
      expect(await depositRecord.getUserDepositAmount(user.address)).eq(TEST_AMOUNT_TWO)
    })

    it("should correctly add 'amount' to both deposited totals when starting from a non-zero value", async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(user.address)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_ONE)
      )
      expect(await depositRecord.getUserDepositAmount(user.address)).eq(
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

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_TWO)
      )
      expect(await depositRecord.getUserDepositAmount(uncappedUser.address)).eq(
        userDepositsBefore.add(TEST_AMOUNT_TWO)
      )
    })

    it('adds to global and user totals if uncapped user below caps and starting from non-zero value', async () => {
      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)
      await depositRecord.setUserDepositCap(TEST_AMOUNT_ONE)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      const userDepositsBefore = await depositRecord.getUserDepositAmount(uncappedUser.address)

      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(
        globalDepositAmountBefore.add(TEST_AMOUNT_TWO)
      )
      expect(await depositRecord.getUserDepositAmount(uncappedUser.address)).eq(
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

    it('reverts if amount > global cap', async () => {
      await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_AMOUNT_ONE)

      const tx = depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE.add(1))

      await expect(tx).revertedWith('Global deposit cap exceeded')
    })

    it('reverts if global cap already exceeded', async () => {
      await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_AMOUNT_ONE)
      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_AMOUNT_ONE.sub(1))

      const tx = depositRecord.connect(user).recordDeposit(user.address, 0)

      await expect(tx).revertedWith('Global deposit cap exceeded')
    })

    it('reverts if uncapped user and global cap already exceeded', async () => {
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_AMOUNT_ONE)
      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_ONE)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(TEST_AMOUNT_ONE.sub(1))

      const tx = depositRecord.connect(user).recordDeposit(uncappedUser.address, 0)

      await expect(tx).revertedWith('Global deposit cap exceeded')
    })

    it('reverts if user cap already exceeded', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(TEST_AMOUNT_ONE)
      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE)
      await depositRecord.connect(deployer).setUserDepositCap(TEST_AMOUNT_ONE.sub(1))

      const tx = depositRecord.connect(user).recordDeposit(user.address, 0)

      await expect(tx).revertedWith('User deposit cap exceeded')
    })

    it('reverts if uncapped user changes to capped user and user cap already exceeded', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(TEST_AMOUNT_ONE)
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(true)
      await depositRecord.connect(user).recordDeposit(uncappedUser.address, TEST_AMOUNT_ONE)
      expect(await depositRecord.getUserDepositCap()).eq(
        await depositRecord.getUserDepositAmount(uncappedUser.address)
      )
      bypassList.isIncluded.whenCalledWith(uncappedUser.address).returns(false)

      const tx = depositRecord.connect(user).recordDeposit(uncappedUser.address, 1)

      await expect(tx).revertedWith('User deposit cap exceeded')
    })

    it('should revert if per-account deposit cap is exceeded', async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getGlobalNetDepositAmount()).eq(TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getUserDepositAmount(user.address)).eq(TEST_USER_DEPOSIT_CAP)

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
        expect(await depositRecord.getUserDepositAmount(currentAccountAddress)).eq(
          TEST_USER_DEPOSIT_CAP
        )
      }
      expect(await depositRecord.getGlobalNetDepositAmount()).eq(TEST_GLOBAL_DEPOSIT_CAP)
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
      allowlist.isIncluded.whenCalledWith(user.address).returns(true)
      await depositRecord
        .connect(user)
        .recordDeposit(user.address, TEST_AMOUNT_ONE.add(TEST_AMOUNT_TWO))
    })

    it('reverts if caller not allowed', async () => {
      expect(await allowlist.isIncluded(user2.address)).eq(false)

      await expect(depositRecord.connect(user2).recordWithdrawal(TEST_AMOUNT_TWO)).revertedWith(
        'msg.sender not allowed'
      )
    })

    it('subtracts from global deposits if withdrawal > 0 and global deposits > 0', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(
        globalDepositAmountBefore.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if withdrawal > 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits > 0', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(globalDepositAmountBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getGlobalNetDepositAmount())
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).eq(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(globalDepositAmountBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getUserDepositAmount(user.address))
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).eq(userDepositBefore)
    })

    it('sets global deposits to 0 if withdrawal > global deposits', async () => {
      const globalDepositAmountBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositAmountBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(globalDepositAmountBefore.add(1))

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(0)
    })

    it('leaves user deposits unchanged if withdrawal > global deposits', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).gt(0)

      await depositRecord.connect(user).recordWithdrawal(userDepositBefore.add(1))

      expect(await depositRecord.getUserDepositAmount(user.address)).eq(userDepositBefore)
    })

    it('subtracts from global deposits if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const globalDepositAmountBeforeSecondWithdrawal =
        await depositRecord.getGlobalNetDepositAmount()

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).eq(
        globalDepositAmountBeforeSecondWithdrawal.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const userDepositBeforeSecondWithdrawal = await depositRecord.getUserDepositAmount(
        user.address
      )

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).eq(
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
      ).eq(false)

      await expect(
        depositRecord.connect(user).setGlobalNetDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).not.eq(0)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(0)

      expect(await depositRecord.getGlobalNetDepositCap()).eq(0)
    })

    it('should correctly set the same value twice', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).not.eq(differentCapToTestWith)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).eq(differentCapToTestWith)
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
      ).eq(false)

      await expect(
        depositRecord.connect(user).setUserDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getUserDepositCap()).not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).not.eq(0)

      await depositRecord.connect(deployer).setUserDepositCap(0)

      expect(await depositRecord.getUserDepositCap()).eq(0)
    })

    it('should correctly set the same value twice', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).eq(differentCapToTestWith)
    })

    it('should emit a UserDepositCapChange event', async () => {
      const tx = await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      await expect(tx)
        .to.emit(depositRecord, 'UserDepositCapChange')
        .withArgs(differentCapToTestWith)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    before(async () => {
      await setupDepositRecord()
    })

    it('reverts if user != SET_ALLOWED_MSG_SENDERS_ROLE', async () => {
      expect(
        await depositRecord.hasRole(
          await depositRecord.SET_ALLOWED_MSG_SENDERS_ROLE(),
          user.address
        )
      ).eq(false)
      expect(deployer.address).not.eq(user.address)

      await expect(
        depositRecord.connect(user).setAllowedMsgSenders(allowlist.address)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_ALLOWED_MSG_SENDERS_ROLE()}`
      )
    })

    it('succeeds if user == SET_ALLOWED_MSG_SENDERS_ROLE', async () => {
      expect(
        await depositRecord.hasRole(
          await depositRecord.SET_ALLOWED_MSG_SENDERS_ROLE(),
          deployer.address
        )
      )

      await depositRecord.connect(deployer).setAllowedMsgSenders(allowlist.address)
    })

    describe('# setAccountList', () => {
      it('reverts if not role holder', async () => {
        expect(
          await depositRecord.hasRole(await depositRecord.SET_ACCOUNT_LIST_ROLE(), user.address)
        ).eq(false)

        await expect(depositRecord.connect(user).setAccountList(user.address)).revertedWith(
          `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_ACCOUNT_LIST_ROLE()}`
        )
      })

      it("doesn't revert if role holder", async () => {
        expect(
          await depositRecord.hasRole(await depositRecord.SET_ACCOUNT_LIST_ROLE(), deployer.address)
        ).eq(true)

        await depositRecord.connect(deployer).setAccountList(allowlist.address)
      })
    })
  })
})
