import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { tokenSenderCallerFixture } from './fixtures/TokenSenderCallerFixtures'
import { TokenSenderCaller } from '../types/generated'

chai.use(smock.matchers)

describe('=> TokenSenderCaller', () => {
  let tokenSenderCaller: TokenSenderCaller
  let deployer: SignerWithAddress
  let tokenSender: SignerWithAddress

  beforeEach(async () => {
    ;[deployer, tokenSender] = await ethers.getSigners()
    tokenSenderCaller = await tokenSenderCallerFixture()
  })

  describe('initial state', () => {
    it('does not set TokenSender', async () => {
      expect(await tokenSenderCaller.getTokenSender()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setTokenSender', () => {
    it('sets non-zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('sets zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(ZERO_ADDRESS)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)
      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)

      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('emits TokenSenderChange', async () => {
      await expect(tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address))
        .to.emit(tokenSenderCaller, 'TokenSenderChange')
        .withArgs(tokenSender.address)
    })
  })
})
