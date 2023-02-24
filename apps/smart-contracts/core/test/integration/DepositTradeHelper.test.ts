import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { parseEther } from '@ethersproject/units'
import { create2DeployerFixture } from '../fixtures/Create2DeployerFixtures'
import { Snapshotter } from '../snapshots'
import { MockCore } from '../../harnesses/mock'
import { roleAssigners } from '../../helpers/roles'
import { attachSwapRouter } from '../../helpers/uniswap'
import { PrePOMarketParams } from '../../types'
import { Create2Deployer, ERC20, SwapRouter, DepositTradeHelper } from '../../types/generated'
import { depositTradeHelperFixture } from '../fixtures/DepositTradeHelperFixture'
import { ERC20AttachFixture } from '../fixtures/ERC20Fixture'
import { getCollateralAmountForDeposit } from '../../helpers'

const { nowPlusMonths } = utils

chai.use(smock.matchers)
const snapshotter = new Snapshotter()

describe('=> DepositTradeHelper', () => {
  let weth: ERC20
  let core: MockCore
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let user: SignerWithAddress
  let defaultMarketParams: PrePOMarketParams
  let create2Deployer: Create2Deployer
  let swapRouter: SwapRouter
  let depositTradeHelper: DepositTradeHelper
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_PAYOUT = ethers.utils.parseEther('0.2')
  const TEST_CEILING_PAYOUT = ethers.utils.parseEther('0.8')
  const TEST_FLOOR_VAL = BigNumber.from(2000)
  const TEST_CEILING_VAL = BigNumber.from(10000)
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_DEPOSIT_AMOUNT = parseEther('1')
  const GOVERNANCE_COLLATERAL_SUPPLY = parseEther('10')
  const GOVERNANCE_LSTOKEN_SUPPLY = parseEther('10')

  snapshotter.setupSnapshotContext('DepositTradeHelper')
  before(async () => {
    /**
     * Connect to Alchemy provider since forking off a specific block
     * number is available to free tiers.
     */
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
            blockNumber: 46247692,
          },
        },
      ],
    })
    weth = await ERC20AttachFixture(ethers, getPrePOAddressForNetwork('WETH', 'arbitrumOne'))
    core = await MockCore.Instance.init(ethers, weth)
    ;[deployer, governance, user] = core.accounts
    /**
     * Mint WETH to governance, doing it via the fallback function which
     * isn't ideal via the contract, but here it is typed as an ERC20 which
     * will not have IWETH9 functions available.
     */
    const mintWETHTx = {
      to: weth.address,
      value: parseEther('1000'),
    }
    await governance.sendTransaction(mintWETHTx)
    await roleAssigners.assignCollateralRoles(deployer, governance, core.collateral)
    defaultMarketParams = {
      governance: governance.address,
      collateral: core.collateral.address,
      floorLongPayout: TEST_FLOOR_PAYOUT,
      ceilingLongPayout: TEST_CEILING_PAYOUT,
      floorValuation: TEST_FLOOR_VAL,
      ceilingValuation: TEST_CEILING_VAL,
      expiryTime: TEST_EXPIRY,
    }
    /**
     * Deploy market ensuring L/S token addresses are less than
     * the Collateral address.
     */
    create2Deployer = await create2DeployerFixture()
    await core.createAndAddMockMarket(
      TEST_NAME_SUFFIX,
      TEST_SYMBOL_SUFFIX,
      defaultMarketParams,
      create2Deployer
    )
    swapRouter = await attachSwapRouter(
      ethers,
      getPrePOAddressForNetwork('UNIV3_SWAP_ROUTER', 'arbitrumOne')
    )
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address
    )
    // Supply governance with Collateral and LongShort tokens
    await core.mintLSFromBaseToken(
      governance,
      governance,
      GOVERNANCE_COLLATERAL_SUPPLY,
      TEST_NAME_SUFFIX
    )
    await core.mintCollateralFromBaseToken(
      governance,
      governance.address,
      GOVERNANCE_LSTOKEN_SUPPLY
    )
    await snapshotter.saveSnapshot()
  })

  describe('initial state', () => {
    it('sets collateral from constructor', async () => {
      expect(await depositTradeHelper.getCollateral()).to.eq(core.collateral.address)
    })

    it('sets base token from collateral', async () => {
      expect(await depositTradeHelper.getBaseToken()).to.eq(core.baseToken.address)
    })

    it('sets swap router from constructor', async () => {
      expect(await depositTradeHelper.getSwapRouter()).to.eq(swapRouter.address)
    })

    it('gives collateral contract unlimited base token approval', async () => {
      expect(
        await core.baseToken.allowance(depositTradeHelper.address, core.collateral.address)
      ).to.eq(ethers.constants.MaxUint256)
    })

    it('gives swap router unlimited collateral approval', async () => {
      expect(await core.collateral.allowance(depositTradeHelper.address, swapRouter.address)).to.eq(
        ethers.constants.MaxUint256
      )
    })
  })

  describe('# wrapAndDeposit', () => {
    /**
     * TODO: Add tests using a non-WETH base token, 1 to ensure `wrapAndDeposit`
     * reverts due to the absence of WETH functions existing on the base token,
     * and one to ensure that if for some reason, the WETH contract returns <
     * `msg.value` in WETH, the transaction reverts. This will require creating a
     * custom interface that combines IWETH9 and ERC20 so that these functions can
     * be mocked.
     */
    it('reverts if funder has insufficient ETH', async () => {
      /**
       * Could just set to user's eth balance, because the gas cost
       * would be deducted from the user's balance, but this is less
       * fragile in the case the test net gas cost is set to 0.
       *
       * This uses rejectedWith rather than reverted because the transaction
       * in this case will not even be evaluated and rejected by the provider.
       */
      await expect(
        depositTradeHelper
          .connect(user)
          .wrapAndDeposit(user.address, { value: (await user.getBalance()).add(1) })
      ).rejectedWith("sender doesn't have enough funds to send tx")
    })

    it('wraps and deposits ETH if funder = recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      const collateralBalanceBefore = await core.collateral.balanceOf(user.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(user.address, { value: TEST_DEPOSIT_AMOUNT })

      expect(tx)
        .emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, user.address, TEST_DEPOSIT_AMOUNT)
      expect(await core.collateral.balanceOf(user.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, TEST_DEPOSIT_AMOUNT)
        )
      )
      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        ethBalanceBefore
          .sub(TEST_DEPOSIT_AMOUNT)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })

    it('wraps and deposits ETH if funder != recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      // Check if their balance is greater than 2x the deposit amount
      expect(ethBalanceBefore).gt(TEST_DEPOSIT_AMOUNT.mul(2))
      const collateralBalanceBefore = await core.collateral.balanceOf(deployer.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(deployer.address, { value: TEST_DEPOSIT_AMOUNT })

      expect(tx)
        .emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, user.address, TEST_DEPOSIT_AMOUNT)
      expect(await core.collateral.balanceOf(deployer.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, TEST_DEPOSIT_AMOUNT)
        )
      )
      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        ethBalanceBefore
          .sub(TEST_DEPOSIT_AMOUNT)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })
  })
})
