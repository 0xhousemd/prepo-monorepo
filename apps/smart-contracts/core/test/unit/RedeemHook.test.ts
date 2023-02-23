import { FakeContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { ZERO_ADDRESS } from 'prepo-constants'
import {
  AccountList,
  Collateral,
  PrePOMarket,
  RedeemHook,
  TokenSender,
} from '../../types/generated'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { fakeAccountListFixture, redeemHookFixture } from '../fixtures/HookFixture'
import { fakePrePOMarketFixture } from '../fixtures/PrePOMarketFixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { getSignerForContract } from '../utils'

chai.use(smock.matchers)

describe('=> RedeemHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let treasury: SignerWithAddress
  let redeemHook: RedeemHook
  let allowlist: FakeContract<AccountList>
  let msgSendersAllowlist: FakeContract<AccountList>
  let tokenSender: FakeContract<TokenSender>
  let collateral: FakeContract<Collateral>
  let market: FakeContract<PrePOMarket>
  let marketSigner: SignerWithAddress

  beforeEach(async () => {
    ;[deployer, user, treasury, recipient] = await ethers.getSigners()
    redeemHook = await redeemHookFixture()
    allowlist = await fakeAccountListFixture()
    msgSendersAllowlist = await fakeAccountListFixture()
    tokenSender = await fakeTokenSenderFixture()
  })

  describe('initial state', () => {
    it('sets deployer to owner', async () => {
      expect(await redeemHook.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await redeemHook.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setAccountList', () => {
    it('reverts if not owner', async () => {
      expect(await redeemHook.owner()).to.not.eq(user.address)

      await expect(redeemHook.connect(user).setAccountList(allowlist.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await redeemHook.owner()).to.eq(deployer.address)

      await redeemHook.connect(deployer).setAccountList(allowlist.address)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    it('reverts if not owner', async () => {
      expect(await redeemHook.owner()).to.not.eq(user.address)

      await expect(
        redeemHook.connect(user).setAllowedMsgSenders(msgSendersAllowlist.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('succeeds if owner', async () => {
      expect(await redeemHook.owner()).to.eq(deployer.address)

      await redeemHook.connect(deployer).setAllowedMsgSenders(msgSendersAllowlist.address)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not owner', async () => {
      expect(await redeemHook.owner()).to.not.eq(user.address)

      await expect(redeemHook.connect(user).setTreasury(treasury.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await redeemHook.owner()).to.eq(deployer.address)

      await redeemHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not owner', async () => {
      expect(await redeemHook.owner()).to.not.eq(user.address)

      await expect(redeemHook.connect(user).setTokenSender(tokenSender.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await redeemHook.owner()).to.eq(deployer.address)

      await redeemHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })

  describe('# hook', () => {
    beforeEach(async () => {
      await redeemHook.setAccountList(allowlist.address)
      await redeemHook.setAllowedMsgSenders(msgSendersAllowlist.address)
      msgSendersAllowlist.isIncluded.whenCalledWith(deployer.address).returns(true)
    })

    it('reverts if caller not allowed', async () => {
      msgSendersAllowlist.isIncluded.returns(false)
      expect(await msgSendersAllowlist.isIncluded(user.address)).to.be.false

      await expect(redeemHook.connect(user).hook(user.address, user.address, 1, 1)).revertedWith(
        'msg.sender not allowed'
      )
    })

    it('reverts if sender not allowed', async () => {
      expect(await msgSendersAllowlist.isIncluded(deployer.address)).to.be.true
      expect(await allowlist.isIncluded(user.address)).to.eq(false)

      await expect(
        redeemHook.connect(deployer).hook(user.address, recipient.address, 1, 1)
      ).revertedWith('Redeemer not allowed')
    })

    describe('fee reimbursement', () => {
      beforeEach(async () => {
        allowlist.isIncluded.whenCalledWith(user.address).returns(true)
        collateral = await fakeCollateralFixture()
        market = await fakePrePOMarketFixture()
        market.getCollateral.returns(collateral.address)
        marketSigner = await getSignerForContract(market)
        await redeemHook.setAllowedMsgSenders(msgSendersAllowlist.address)
        msgSendersAllowlist.isIncluded.whenCalledWith(marketSigner.address).returns(true)
        await redeemHook.setTreasury(treasury.address)
        await redeemHook.setTokenSender(tokenSender.address)
      })

      it('transfers fee to treasury if fee > 0', async () => {
        await redeemHook.connect(marketSigner).hook(user.address, user.address, 2, 1)

        expect(collateral.transferFrom).calledWith(market.address, treasury.address, 1)
      })

      it('calls tokenSender.send() if fee > 0 and redeemer = recipient', async () => {
        await redeemHook.connect(marketSigner).hook(user.address, user.address, 2, 1)

        expect(tokenSender.send).calledWith(user.address, 1)
      })

      it('calls tokenSender.send() if fee > 0 and redeemer != recipient', async () => {
        expect(user.address).not.eq(recipient.address)

        await redeemHook.connect(marketSigner).hook(user.address, recipient.address, 2, 1)

        expect(tokenSender.send).calledWith(recipient.address, 1)
      })

      it("doesn't transfer fee to treasury if fee = 0", async () => {
        await redeemHook.connect(marketSigner).hook(user.address, user.address, 1, 1)

        expect(collateral.transferFrom).not.called
      })

      it("doesn't call tokenSender.send() if fee = 0", async () => {
        await redeemHook.connect(marketSigner).hook(user.address, user.address, 1, 1)

        expect(tokenSender.send).not.called
      })
    })
  })
})
