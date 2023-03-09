import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { getPrePOAddressForNetwork } from 'prepo-constants'
import { utils, snapshots } from 'prepo-hardhat'
import { parseEther } from '@ethersproject/units'
import { create2DeployerFixture } from '../fixtures/Create2DeployerFixtures'
import { MockCoreWithLiveBaseToken } from '../../harnesses/mock'
import { roleAssigners } from '../../helpers/roles'
import { attachSwapRouter } from '../../helpers/uniswap'
import { PrePOMarketParams } from '../../types'
import {
  Create2Deployer,
  ERC20,
  SwapRouter,
  DepositTradeHelper,
  IDepositTradeHelper,
  IVault,
} from '../../types/generated'
import { attachVaultFixture, fakeVaultFixture } from '../fixtures/BalancerFixtures'
import { depositTradeHelperFixture } from '../fixtures/DepositTradeHelperFixture'
import { ERC20AttachFixture } from '../fixtures/ERC20Fixture'
import { getBaseTokenAmountForWithdrawal, getCollateralAmountForDeposit } from '../../helpers'
import { getPermitFromSignature } from '../utils'

const { nowPlusMonths } = utils

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> DepositTradeHelper', () => {
  let weth: ERC20
  let wsteth: ERC20
  let core: MockCoreWithLiveBaseToken
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let user: SignerWithAddress
  let defaultMarketParams: PrePOMarketParams
  let create2Deployer: Create2Deployer
  let swapRouter: SwapRouter
  let wstethVault: IVault
  let depositTradeHelper: DepositTradeHelper
  const TEST_NAME_SUFFIX = 'Fake Token ($5-10B)'
  const TEST_SYMBOL_SUFFIX = 'FAKE_5-10B'
  const TEST_FLOOR_PAYOUT = ethers.utils.parseEther('0.2')
  const TEST_CEILING_PAYOUT = ethers.utils.parseEther('0.8')
  const TEST_FLOOR_VAL = BigNumber.from(2000)
  const TEST_CEILING_VAL = BigNumber.from(10000)
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_DEPOSIT_AMOUNT = parseEther('1')
  const TEST_DEPOSIT_FEE = 10000 // 1%
  const TEST_WITHDRAW_FEE = 10000 // 1%
  const WSTETH_ETH_METASTABLE_POOL_ID =
    '0x36bf227d6bac96e2ab1ebb5492ecec69c691943f000200000000000000000316'

  const getBalancerSingleSwapQuote = async (
    amountIn: BigNumber,
    tokenIn: string,
    tokenOut: string
  ): Promise<BigNumber> => {
    const swapParams: IVault.BatchSwapStepStruct = {
      poolId: WSTETH_ETH_METASTABLE_POOL_ID,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount: amountIn,
      userData: [],
    }
    const fundingParams: IVault.FundManagementStruct = {
      sender: deployer.address,
      fromInternalBalance: false,
      recipient: deployer.address,
      toInternalBalance: false,
    }
    const amountDeltas = await wstethVault.callStatic.queryBatchSwap(
      0,
      [swapParams],
      [tokenIn, tokenOut],
      fundingParams
    )
    return amountDeltas[1].abs()
  }

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
            blockNumber: 65307000,
          },
        },
      ],
    })
    weth = await ERC20AttachFixture(ethers, getPrePOAddressForNetwork('WETH', 'arbitrumOne'))
    wsteth = await ERC20AttachFixture(ethers, getPrePOAddressForNetwork('WSTETH', 'arbitrumOne'))
    core = await MockCoreWithLiveBaseToken.Instance.init(ethers, wsteth)
    ;[deployer, governance, user] = core.accounts
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
    await core.collateral.connect(governance).setDepositFee(TEST_DEPOSIT_FEE)
    await core.collateral.connect(governance).setWithdrawFee(TEST_WITHDRAW_FEE)
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
    wstethVault = await attachVaultFixture(
      ethers,
      getPrePOAddressForNetwork('WSTETH_ETH_BALANCER_VAULT', 'arbitrumOne')
    )
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address,
      wstethVault.address
    )
    await depositTradeHelper.connect(deployer).setWstethPoolId(WSTETH_ETH_METASTABLE_POOL_ID)
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
    let expectedWstETHFromDepositSwap: BigNumber
    let balancerParamsForDeposit: IDepositTradeHelper.OffChainBalancerParamsStruct
    before(async () => {
      expectedWstETHFromDepositSwap = await getBalancerSingleSwapQuote(
        TEST_DEPOSIT_AMOUNT,
        weth.address,
        wsteth.address
      )
      // Assuming 1% slippage for testing purposes
      balancerParamsForDeposit = {
        amountOutMinimum: expectedWstETHFromDepositSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
    })

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
        depositTradeHelper.connect(user).wrapAndDeposit(user.address, balancerParamsForDeposit, {
          value: (await user.getBalance()).add(1),
        })
      ).rejectedWith("sender doesn't have enough funds to send tx")
    })

    it('reverts if swap returns less than `amountOutMinimum`', async () => {
      const fakeWstethVault = await fakeVaultFixture()
      // Use fake vault so that recipient gets nothing
      fakeWstethVault.swap.returns()
      const depositTradeHelperForFakeVault = await depositTradeHelperFixture(
        core.collateral.address,
        swapRouter.address,
        fakeWstethVault.address
      )

      await expect(
        depositTradeHelperForFakeVault
          .connect(user)
          .wrapAndDeposit(user.address, balancerParamsForDeposit, {
            value: TEST_DEPOSIT_AMOUNT,
          })
      ).revertedWith('Insufficient wstETH from swap')
    })

    it('wraps ETH and swaps for wstETH if funder = recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      const collateralBalanceBefore = await core.collateral.balanceOf(user.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(user.address, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })

      await expect(tx)
        .to.emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wstethVault.address, TEST_DEPOSIT_AMOUNT)
      await expect(tx)
        .to.emit(wsteth, 'Transfer')
        .withArgs(wstethVault.address, depositTradeHelper.address, expectedWstETHFromDepositSwap)
      expect(await core.collateral.balanceOf(user.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, expectedWstETHFromDepositSwap)
        )
      )
      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        ethBalanceBefore
          .sub(TEST_DEPOSIT_AMOUNT)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })

    it('wraps ETH and swaps for wstETH if funder != recipient', async () => {
      const ethBalanceBefore = await user.getBalance()
      // Check if their balance is greater than 2x the deposit amount
      expect(ethBalanceBefore).gt(TEST_DEPOSIT_AMOUNT.mul(2))
      const collateralBalanceBefore = await core.collateral.balanceOf(deployer.address)

      const tx = await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(deployer.address, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })

      await expect(tx)
        .emit(weth, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wstethVault.address, TEST_DEPOSIT_AMOUNT)
      await expect(tx)
        .to.emit(wsteth, 'Transfer')
        .withArgs(wstethVault.address, depositTradeHelper.address, expectedWstETHFromDepositSwap)
      expect(await core.collateral.balanceOf(deployer.address)).eq(
        collateralBalanceBefore.add(
          await getCollateralAmountForDeposit(core.collateral, expectedWstETHFromDepositSwap)
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

  describe('# withdrawAndUnwrap', () => {
    let collateralBalanceBefore: BigNumber
    let expectedWstETHFromWithdrawal: BigNumber
    let expectedWstETHFromDepositSwap: BigNumber
    let expectedWETHFromWithdrawSwap: BigNumber
    let collateralPermit: IDepositTradeHelper.PermitStruct
    let balancerParamsForDeposit: IDepositTradeHelper.OffChainBalancerParamsStruct
    let balancerParamsForWithdraw: IDepositTradeHelper.OffChainBalancerParamsStruct
    const JUNK_PERMIT = <IDepositTradeHelper.PermitStruct>{
      deadline: 0,
      v: 0,
      r: formatBytes32String('JUNK_DATA'),
      s: formatBytes32String('JUNK_DATA'),
    }
    snapshotter.setupSnapshotContext('DepositTradeHelper-withdrawAndUnwrap')
    before(async () => {
      expectedWstETHFromDepositSwap = await getBalancerSingleSwapQuote(
        TEST_DEPOSIT_AMOUNT,
        weth.address,
        wsteth.address
      )
      balancerParamsForDeposit = {
        amountOutMinimum: expectedWstETHFromDepositSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
      await depositTradeHelper
        .connect(user)
        .wrapAndDeposit(user.address, balancerParamsForDeposit, {
          value: TEST_DEPOSIT_AMOUNT,
        })
      collateralBalanceBefore = await core.collateral.balanceOf(user.address)
      collateralPermit = await getPermitFromSignature(
        core.collateral,
        user,
        depositTradeHelper.address,
        ethers.constants.MaxUint256,
        TEST_EXPIRY
      )
      expectedWstETHFromWithdrawal = await getBaseTokenAmountForWithdrawal(
        core.collateral,
        collateralBalanceBefore
      )
      expectedWETHFromWithdrawSwap = await getBalancerSingleSwapQuote(
        expectedWstETHFromWithdrawal,
        wsteth.address,
        weth.address
      )
      balancerParamsForWithdraw = {
        amountOutMinimum: expectedWETHFromWithdrawSwap.mul(99).div(100),
        deadline: nowPlusMonths(1),
      }
      await snapshotter.saveSnapshot()
    })

    it('reverts if insufficient collateral', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore.add(1))

      await expect(
        depositTradeHelper
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore.add(1),
            JUNK_PERMIT,
            balancerParamsForWithdraw
          )
      ).revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if insufficient collateral approval', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore.sub(1))

      await expect(
        depositTradeHelper
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore,
            JUNK_PERMIT,
            balancerParamsForWithdraw
          )
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if swap returns less than `amountOutMinimum`', async () => {
      const fakeWstethVault = await fakeVaultFixture()
      // Use fake vault so that recipient gets nothing
      fakeWstethVault.swap.returns()
      const depositTradeHelperForFakeVault = await depositTradeHelperFixture(
        core.collateral.address,
        swapRouter.address,
        fakeWstethVault.address
      )
      const collateralPermitForFakeVault = await getPermitFromSignature(
        core.collateral,
        user,
        depositTradeHelperForFakeVault.address,
        ethers.constants.MaxUint256,
        TEST_EXPIRY
      )

      await expect(
        depositTradeHelperForFakeVault
          .connect(user)
          .withdrawAndUnwrap(
            deployer.address,
            collateralBalanceBefore,
            collateralPermitForFakeVault,
            balancerParamsForWithdraw
          )
      ).revertedWith('Insufficient ETH from swap')
    })

    it('ignores collateral approval if deadline = 0', async () => {
      await core.collateral
        .connect(user)
        .approve(depositTradeHelper.address, collateralBalanceBefore)
      expect(JUNK_PERMIT.deadline).eq(0)

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          JUNK_PERMIT,
          balancerParamsForWithdraw
        )

      expect(core.collateral.permit).not.called
      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).eq(0)
    })

    it('processes collateral permit if deadline != 0', async () => {
      expect(collateralPermit.deadline).not.eq(0)
      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).not.eq(
        ethers.constants.MaxUint256
      )

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).eq(
        ethers.constants.MaxUint256
      )
    })

    it('withdraws wstETH to DepositTradeHelper contract', async () => {
      const tx = await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          collateralPermit,
          balancerParamsForWithdraw
        )

      await expect(tx)
        .emit(core.baseToken, 'Transfer')
        .withArgs(core.collateral.address, depositTradeHelper.address, expectedWstETHFromWithdrawal)
    })

    it('swaps wstETH for WETH and unwraps to funder if funder = recipient', async () => {
      const recipientEthBefore = await user.getBalance()

      const tx = await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          user.address,
          collateralBalanceBefore,
          collateralPermit,
          balancerParamsForWithdraw
        )

      const receipt = await tx.wait()
      expect(await user.getBalance()).eq(
        recipientEthBefore
          .add(expectedWETHFromWithdrawSwap)
          .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      )
    })

    it('swaps wstETH for WETH and unwraps to recipient if funder != recipient', async () => {
      const recipientEthBefore = await deployer.getBalance()

      await depositTradeHelper
        .connect(user)
        .withdrawAndUnwrap(
          deployer.address,
          collateralBalanceBefore,
          collateralPermit,
          balancerParamsForWithdraw
        )

      expect(await deployer.getBalance()).eq(recipientEthBefore.add(expectedWETHFromWithdrawSwap))
    })

    afterEach(() => {
      core.collateral.permit.reset()
    })
  })
})
