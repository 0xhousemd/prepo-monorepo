import chai, { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String, parseUnits, parseEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { utils, snapshots } from 'prepo-hardhat'
import { ZERO_BYTES32, JUNK_ADDRESS } from 'prepo-constants'
import { getPermitFromSignature } from '../utils'
import { fakeVaultFixture } from '../fixtures/BalancerFixtures'
import { depositTradeHelperFixture } from '../fixtures/DepositTradeHelperFixture'
import { fakeSwapRouterFixture } from '../fixtures/UniswapFixtures'
import { MockCoreWithMockBaseToken } from '../../harnesses/mock'
import { DepositTradeHelper, IDepositTradeHelper, IVault, SwapRouter } from '../../types/generated'
import { getCollateralAmountForDeposit } from '../../helpers'

const { setNextTimestamp, nowPlusMonths } = utils

chai.use(smock.matchers)
const { Snapshotter } = snapshots
const snapshotter = new Snapshotter(ethers, network)

describe('=> DepositTradeHelper', () => {
  let core: MockCoreWithMockBaseToken
  let swapRouter: FakeContract<SwapRouter>
  let wstethVault: FakeContract<IVault>
  let depositTradeHelper: DepositTradeHelper
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  const TEST_POOL_ID = formatBytes32String('JUNK_DATA')
  const TEST_TIMESTAMP = nowPlusMonths(1)
  snapshotter.setupSnapshotContext('DepositTradeHelper')

  const junkPermit = <IDepositTradeHelper.PermitStruct>{
    deadline: 0,
    v: 0,
    r: formatBytes32String('JUNK_DATA'),
    s: formatBytes32String('JUNK_DATA'),
  }

  const junkTradeParams = <IDepositTradeHelper.OffChainTradeParamsStruct>{
    tokenOut: JUNK_ADDRESS,
    deadline: 0,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  }

  before(async () => {
    core = await MockCoreWithMockBaseToken.Instance.init(ethers)
    ;[deployer, user] = core.accounts
    swapRouter = await fakeSwapRouterFixture()
    wstethVault = await fakeVaultFixture()
    depositTradeHelper = await depositTradeHelperFixture(
      core.collateral.address,
      swapRouter.address,
      wstethVault.address
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

    it('sets WstETH vault from constructor', async () => {
      expect(await depositTradeHelper.getWstethVault()).to.eq(wstethVault.address)
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

  describe('# setWstethPoolId', () => {
    it('reverts if not owner', async () => {
      await expect(depositTradeHelper.connect(user).setWstethPoolId(TEST_POOL_ID)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero id', async () => {
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).not.eq(ZERO_BYTES32)
      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)
    })

    it('sets to zero id', async () => {
      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(ZERO_BYTES32)

      await depositTradeHelper.connect(deployer).setWstethPoolId(ZERO_BYTES32)

      expect(await depositTradeHelper.getWstethPoolId()).eq(ZERO_BYTES32)
    })

    it('is idempotent', async () => {
      expect(await depositTradeHelper.getWstethPoolId()).not.eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)

      await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      expect(await depositTradeHelper.getWstethPoolId()).eq(TEST_POOL_ID)
    })

    it('emits WstethPoolIdChange event', async () => {
      const tx = await depositTradeHelper.connect(deployer).setWstethPoolId(TEST_POOL_ID)

      await expect(tx).emit(depositTradeHelper, 'WstethPoolIdChange').withArgs(TEST_POOL_ID)
    })
  })

  describe('# depositAndTrade', () => {
    const baseTokenToDeposit = parseUnits('1', 6)
    let expectedCollateralMinted: BigNumber
    snapshotter.setupSnapshotContext('DepositTradeHelper-depositAndTrade')

    before(async () => {
      await core.baseToken.mint(user.address, baseTokenToDeposit)
      core.collateral.depositHook.hook.returns()
      expectedCollateralMinted = await getCollateralAmountForDeposit(
        core.collateral,
        baseTokenToDeposit
      )
      await snapshotter.saveSnapshot()
    })

    it('reverts if insufficient base token approval', async () => {
      expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.be.lt(
        baseTokenToDeposit
      )

      await expect(
        depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)
      ).revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if insufficient collateral approval', async () => {
      // Can just statically call for expected amount instead of rewriting calculation logic
      await core.baseToken.connect(user).approve(core.collateral.address, baseTokenToDeposit)
      const expectedCT = await core.collateral
        .connect(user)
        .callStatic.deposit(user.address, baseTokenToDeposit)
      await core.baseToken.connect(user).approve(core.collateral.address, 0)
      await core.baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
      expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.be.lt(
        expectedCT
      )

      await expect(
        depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)
      ).revertedWith('ERC20: insufficient allowance')
    })

    describe('permit testing', () => {
      it('ignores base token approval if deadline = 0', async () => {
        await core.baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(junkPermit.deadline).to.eq(0)
        const collateralPermit = await getPermitFromSignature(
          core.collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, collateralPermit, junkTradeParams)

        expect(tx).to.not.emit(core.baseToken, 'Approval')
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('ignores collateral approval if deadline = 0', async () => {
        await core.collateral
          .connect(user)
          .approve(depositTradeHelper.address, expectedCollateralMinted)
        expect(junkPermit.deadline).to.eq(0)
        const baseTokenPermit = await getPermitFromSignature(
          core.baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, junkPermit, junkTradeParams)

        expect(tx).to.not.emit(core.collateral, 'Approval')
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('ignores both permits if deadlines = 0', async () => {
        await core.baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        await core.collateral
          .connect(user)
          .approve(depositTradeHelper.address, expectedCollateralMinted)
        expect(junkPermit.deadline).to.eq(0)

        const tx = await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, junkPermit, junkTradeParams)

        expect(tx).to.not.emit(core.baseToken, 'Approval')
        expect(tx).to.not.emit(core.collateral, 'Approval')
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
      })

      it('processes base token approval permit from user', async () => {
        await core.collateral
          .connect(user)
          .approve(depositTradeHelper.address, expectedCollateralMinted)
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const baseTokenPermit = await getPermitFromSignature(
          core.baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, junkPermit, junkTradeParams)

        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })

      it('processes collateral approval permit from user', async () => {
        await core.baseToken.connect(user).approve(depositTradeHelper.address, baseTokenToDeposit)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const collateralPermit = await getPermitFromSignature(
          core.collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, junkPermit, collateralPermit, junkTradeParams)

        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })

      it('processes both permits', async () => {
        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(0)
        const baseTokenPermit = await getPermitFromSignature(
          core.baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        const collateralPermit = await getPermitFromSignature(
          core.collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(await core.baseToken.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
        expect(await core.collateral.allowance(user.address, depositTradeHelper.address)).to.eq(
          ethers.constants.MaxUint256
        )
      })
    })

    describe('if all permits provided', () => {
      let baseTokenPermit: IDepositTradeHelper.PermitStruct
      let collateralPermit: IDepositTradeHelper.PermitStruct

      snapshotter.setupSnapshotContext('DepositTradeHelper-depositAndTrade-allPermitsProvided')

      before(async () => {
        baseTokenPermit = await getPermitFromSignature(
          core.baseToken,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        collateralPermit = await getPermitFromSignature(
          core.collateral,
          user,
          depositTradeHelper.address,
          ethers.constants.MaxUint256,
          TEST_TIMESTAMP
        )
        await snapshotter.saveSnapshot()
      })

      it('reverts if insufficient base token', async () => {
        const userBTBalanceBefore = await core.baseToken.balanceOf(user.address)
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await expect(
          depositTradeHelper
            .connect(user)
            .depositAndTrade(
              userBTBalanceBefore.add(1),
              baseTokenPermit,
              collateralPermit,
              junkTradeParams
            )
        ).revertedWith('ERC20: transfer amount exceeds balance')
      })

      it('takes `baseTokenAmount` from user prior to minting Collateral', async () => {
        const userBTBalanceBefore = await core.baseToken.balanceOf(user.address)
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(await core.baseToken.balanceOf(user.address)).to.be.eq(
          userBTBalanceBefore.sub(baseTokenToDeposit)
        )
        expect(core.baseToken.transferFrom.atCall(0)).calledWith(
          user.address,
          depositTradeHelper.address,
          baseTokenToDeposit
        )
        expect(core.baseToken.transferFrom).calledBefore(core.collateral.deposit)
      })

      it('mints Collateral to user prior to transferring back', async () => {
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(core.collateral.deposit.atCall(0)).calledWith(user.address, baseTokenToDeposit)
        expect(core.collateral.deposit).calledBefore(core.collateral.transferFrom)
      })

      it('transfers newly minted Collateral back prior to calling swap', async () => {
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(baseTokenToDeposit, baseTokenPermit, collateralPermit, junkTradeParams)

        expect(core.collateral.transferFrom.atCall(0)).calledWith(
          user.address,
          depositTradeHelper.address,
          expectedCollateralMinted
        )
        expect(core.collateral.transferFrom).calledBefore(swapRouter.exactInputSingle)
      })

      it('calls swap router with correct parameters', async () => {
        await core.baseToken.connect(user).approve(core.collateral.address, baseTokenToDeposit)
        const expectedCT = await core.collateral
          .connect(user)
          .callStatic.deposit(user.address, baseTokenToDeposit)
        const nonZeroTradeParams = <IDepositTradeHelper.OffChainTradeParamsStruct>{
          tokenOut: core.baseToken.address,
          deadline: baseTokenPermit.deadline,
          amountOutMinimum: parseEther('1'),
          sqrtPriceLimitX96: parseEther('2'),
        }
        await setNextTimestamp(ethers.provider, TEST_TIMESTAMP)

        await depositTradeHelper
          .connect(user)
          .depositAndTrade(
            baseTokenToDeposit,
            baseTokenPermit,
            collateralPermit,
            nonZeroTradeParams
          )

        const swapRouterCallArgs = swapRouter.exactInputSingle
          .atCall(0)
          .callHistory[0].args[0].slice(0, 8)
        const correctSwapArgs = [
          core.collateral.address,
          core.baseToken.address,
          await depositTradeHelper.POOL_FEE_TIER(),
          user.address,
          BigNumber.from(baseTokenPermit.deadline),
          expectedCT,
          parseEther('1'),
          parseEther('2'),
        ]
        swapRouterCallArgs.forEach((arg, i) => {
          expect(arg).to.eq(correctSwapArgs[i])
        })
      })
    })

    afterEach(() => {
      core.collateral.depositHook.hook.reset()
      core.baseToken.transferFrom.reset()
      core.collateral.deposit.reset()
      core.collateral.transferFrom.reset()
      swapRouter.exactInputSingle.reset()
    })
  })
})
