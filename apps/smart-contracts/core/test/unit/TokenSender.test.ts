import { ethers } from 'hardhat'
import chai, { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseUnits } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { BigNumber } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { tokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { smockTestERC20Fixture } from '../fixtures/TestERC20Fixture'
import { fakeTestUintValueFixture } from '../fixtures/UintValueFixtures'
import { fakeAccountListFixture } from '../fixtures/HookFixture'
import { AccountList, TestERC20, TestUintValue, TokenSender } from '../../types/generated'

chai.use(smock.matchers)

const { grantAndAcceptRole } = utils

describe('=> TokenSender', () => {
  let tokenSender: TokenSender
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let outputToken: FakeContract<TestERC20>
  let priceOracle: FakeContract<TestUintValue>
  let allowlist: FakeContract<AccountList>
  const MULTIPLIER_DENOMINATOR = 10000
  const OUTPUT_TOKEN_DECIMALS = 18
  const OUTPUT_TOKEN_DECIMALS_FACTOR = parseUnits('1', OUTPUT_TOKEN_DECIMALS)
  beforeEach(async () => {
    ;[deployer, user] = await ethers.getSigners()
    outputToken = await smockTestERC20Fixture('Output Token', 'OUT', OUTPUT_TOKEN_DECIMALS)
    tokenSender = await tokenSenderFixture(outputToken.address, OUTPUT_TOKEN_DECIMALS)
    priceOracle = await fakeTestUintValueFixture()
    allowlist = await fakeAccountListFixture()
    await grantAndAcceptRole(tokenSender, deployer, deployer, await tokenSender.SET_PRICE_ROLE())
    await grantAndAcceptRole(
      tokenSender,
      deployer,
      deployer,
      await tokenSender.SET_PRICE_MULTIPLIER_ROLE()
    )
    await grantAndAcceptRole(
      tokenSender,
      deployer,
      deployer,
      await tokenSender.SET_SCALED_PRICE_LOWER_BOUND_ROLE()
    )
    await grantAndAcceptRole(
      tokenSender,
      deployer,
      deployer,
      await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE()
    )
    await grantAndAcceptRole(
      tokenSender,
      deployer,
      deployer,
      await tokenSender.WITHDRAW_ERC20_ROLE()
    )
  })

  describe('# initialize', () => {
    it('sets output token from constructor', async () => {
      expect(await tokenSender.getOutputToken()).to.eq(outputToken.address)
    })
    it('does not set price', async () => {
      expect(await tokenSender.getPrice()).to.eq(ZERO_ADDRESS)
    })
    it('does not set price multiplier', async () => {
      expect(await tokenSender.getPriceMultiplier()).to.eq(0)
    })
    it('does not set scaled price lower bound', async () => {
      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(0)
    })
    it('sets role constants', async () => {
      expect(await tokenSender.SET_PRICE_ROLE()).to.eq(id('setPrice'))
      expect(await tokenSender.SET_PRICE_MULTIPLIER_ROLE()).to.eq(id('setPriceMultiplier'))
      expect(await tokenSender.SET_SCALED_PRICE_LOWER_BOUND_ROLE()).to.eq(
        id('setScaledPriceLowerBound')
      )
      expect(await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE()).to.eq(id('setAllowedMsgSenders'))
      expect(await tokenSender.WITHDRAW_ERC20_ROLE()).eq(id('withdrawERC20'))
    })
  })

  describe('# setPrice', () => {
    it('reverts if not role holder', async () => {
      expect(await tokenSender.hasRole(await tokenSender.SET_PRICE_ROLE(), user.address)).to.eq(
        false
      )

      await expect(tokenSender.connect(user).setPrice(user.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_PRICE_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      await tokenSender.setPrice(user.address)

      expect(await tokenSender.getPrice()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await tokenSender.setPrice(ZERO_ADDRESS)

      expect(await tokenSender.getPrice()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent for non-zero address', async () => {
      await tokenSender.setPrice(user.address)
      expect(await tokenSender.getPrice()).to.eq(user.address)

      await tokenSender.setPrice(user.address)

      expect(await tokenSender.getPrice()).to.eq(user.address)
    })

    it('is idempotent for zero address', async () => {
      await tokenSender.setPrice(ZERO_ADDRESS)
      expect(await tokenSender.getPrice()).to.eq(ZERO_ADDRESS)

      await tokenSender.setPrice(ZERO_ADDRESS)

      expect(await tokenSender.getPrice()).to.eq(ZERO_ADDRESS)
    })

    it('emits PriceChange', async () => {
      await expect(tokenSender.setPrice(user.address))
        .to.emit(tokenSender, 'PriceChange')
        .withArgs(user.address)
    })
  })

  describe('# setPriceMultiplier', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.SET_PRICE_MULTIPLIER_ROLE(), user.address)
      ).to.eq(false)

      await expect(tokenSender.connect(user).setPriceMultiplier(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_PRICE_MULTIPLIER_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await tokenSender.setPriceMultiplier(0)

      expect(await tokenSender.getPriceMultiplier()).to.eq(0)
    })

    it('sets to non-zero', async () => {
      await tokenSender.setPriceMultiplier(1)

      expect(await tokenSender.getPriceMultiplier()).to.eq(1)
    })

    it('is idempotent for zero', async () => {
      await tokenSender.setPriceMultiplier(0)
      expect(await tokenSender.getPriceMultiplier()).to.eq(0)

      await tokenSender.setPriceMultiplier(0)

      expect(await tokenSender.getPriceMultiplier()).to.eq(0)
    })

    it('is idempotent for non-zero', async () => {
      await tokenSender.setPriceMultiplier(1)
      expect(await tokenSender.getPriceMultiplier()).to.eq(1)

      await tokenSender.setPriceMultiplier(1)

      expect(await tokenSender.getPriceMultiplier()).to.eq(1)
    })

    it('emits PriceMultiplierChange', async () => {
      await expect(tokenSender.setPriceMultiplier(1))
        .to.emit(tokenSender, 'PriceMultiplierChange')
        .withArgs(1)
    })
  })

  describe('# setScaledPriceLowerBound', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(
          await tokenSender.SET_SCALED_PRICE_LOWER_BOUND_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(tokenSender.connect(user).setScaledPriceLowerBound(0)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_SCALED_PRICE_LOWER_BOUND_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await tokenSender.setScaledPriceLowerBound(0)

      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(0)
    })

    it('sets to non-zero', async () => {
      await tokenSender.setScaledPriceLowerBound(1)

      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(1)
    })

    it('is idempotent for zero', async () => {
      await tokenSender.setScaledPriceLowerBound(0)
      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(0)

      await tokenSender.setScaledPriceLowerBound(0)

      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(0)
    })

    it('is idempotent for non-zero', async () => {
      await tokenSender.setScaledPriceLowerBound(1)
      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(1)

      await tokenSender.setScaledPriceLowerBound(1)

      expect(await tokenSender.getScaledPriceLowerBound()).to.eq(1)
    })

    it('emits ScaledPriceLowerBoundChange', async () => {
      await expect(tokenSender.setScaledPriceLowerBound(1))
        .to.emit(tokenSender, 'ScaledPriceLowerBoundChange')
        .withArgs(1)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE(), user.address)
      ).to.eq(false)

      await expect(tokenSender.connect(user).setAllowedMsgSenders(ZERO_ADDRESS)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.SET_ALLOWED_MSG_SENDERS_ROLE()}`
      )
    })
  })

  describe('# send', () => {
    beforeEach(async () => {
      await tokenSender.connect(deployer).setPrice(priceOracle.address)
      await tokenSender.connect(deployer).setAllowedMsgSenders(allowlist.address)
      allowlist.isIncluded.returns(true)
    })

    async function calculateExpectedOutput(unconvertedAmount: number): Promise<BigNumber> {
      const scaledPrice = (await priceOracle.get())
        .mul(await tokenSender.getPriceMultiplier())
        .div(MULTIPLIER_DENOMINATOR)
      expect(scaledPrice).to.be.gt(await tokenSender.getScaledPriceLowerBound())
      const outputAmount = ethers.BigNumber.from(unconvertedAmount)
        .mul(OUTPUT_TOKEN_DECIMALS_FACTOR)
        .div(scaledPrice)
      return outputAmount
    }

    it('reverts if not allowed caller', async () => {
      allowlist.isIncluded.returns(false)
      expect(await allowlist.isIncluded(user.address)).to.eq(false)

      await expect(tokenSender.connect(user).send(user.address, 1)).revertedWith(
        `msg.sender not allowed`
      )
    })

    it("doesn't transfer if unconverted amount = 0", async () => {
      priceOracle.get.returns(2)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)

      await tokenSender.connect(deployer).send(user.address, 0)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if price = 0", async () => {
      priceOracle.get.returns(0)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if price > 0 and priceMultiplier = 0", async () => {
      priceOracle.get.returns(2)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)
      await tokenSender.connect(deployer).setPriceMultiplier(0)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if scaled price < lowerBound", async () => {
      priceOracle.get.returns(1)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(2)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if scaled price = lowerBound", async () => {
      priceOracle.get.returns(1)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if outputAmount > token balance", async () => {
      priceOracle.get.returns(2)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)
      const outputAmount = await calculateExpectedOutput(10)
      expect(outputAmount).to.be.gt(0)
      expect(outputAmount).to.be.gt(await outputToken.balanceOf(tokenSender.address))

      await tokenSender.connect(deployer).send(user.address, 1)

      expect(outputToken.transfer).not.called
    })

    it("doesn't transfer if outputAmount = 0", async () => {
      priceOracle.get.returns(1)
      await tokenSender.connect(deployer).setPriceMultiplier(ethers.constants.MaxUint256)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)

      const unconvertedAmount = 1
      const outputAmount = await calculateExpectedOutput(unconvertedAmount)
      expect(outputAmount).to.be.eq(0)

      await tokenSender.connect(deployer).send(user.address, unconvertedAmount)

      expect(outputToken.transfer).not.called
    })

    it('transfers', async () => {
      priceOracle.get.returns(2)
      await tokenSender.connect(deployer).setPriceMultiplier(MULTIPLIER_DENOMINATOR)
      await tokenSender.connect(deployer).setScaledPriceLowerBound(1)
      await outputToken.connect(deployer).mint(tokenSender.address, ethers.constants.MaxUint256)

      const unconvertedAmount = 10
      const outputAmount = await calculateExpectedOutput(unconvertedAmount)
      expect(outputAmount).to.be.gt(0)
      expect(await outputToken.balanceOf(tokenSender.address)).to.be.gt(outputAmount)

      await tokenSender.connect(deployer).send(user.address, unconvertedAmount)

      expect(outputToken.transfer).calledWith(user.address, outputAmount)
      expect(await outputToken.balanceOf(user.address)).to.be.eq(outputAmount)
    })
  })

  describe('# withdrawERC20', () => {
    it('reverts if not role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.WITHDRAW_ERC20_ROLE(), user.address)
      ).to.eq(false)

      await expect(tokenSender.connect(user)['withdrawERC20(address[])']([])).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await tokenSender.WITHDRAW_ERC20_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await tokenSender.hasRole(await tokenSender.WITHDRAW_ERC20_ROLE(), deployer.address)
      ).to.eq(true)

      await tokenSender.connect(deployer)['withdrawERC20(address[])']([])
    })
  })
})
