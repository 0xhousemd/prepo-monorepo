// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IArbitrageBroker.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";

contract ArbitrageBroker is IArbitrageBroker, SafeAccessControlEnumerable {
  ICollateral private immutable _collateral;
  ISwapRouter private immutable _swapRouter;
  mapping(address => bool) private _marketToValidity;

  uint24 public constant override POOL_FEE_TIER = 10000;
  bytes32 public immutable override BUY_AND_REDEEM_ROLE =
    keccak256("buyAndRedeem");
  bytes32 public immutable override MINT_AND_SELL_ROLE =
    keccak256("mintAndSell");
  bytes32 public immutable override SET_MARKET_VALIDITY_ROLE =
    keccak256("setMarketValidity");

  constructor(ICollateral collateral, ISwapRouter swapRouter) {
    _collateral = collateral;
    _swapRouter = swapRouter;
    collateral.approve(address(swapRouter), type(uint256).max);
  }

  modifier onlyValidMarkets(IPrePOMarket market) {
    if (!_marketToValidity[address(market)]) {
      revert InvalidMarket(address(market));
    }
    _;
  }

  function buyAndRedeem(
    IPrePOMarket market,
    OffChainTradeParams calldata tradeParams
  )
    external
    override
    onlyRole(BUY_AND_REDEEM_ROLE)
    onlyValidMarkets(market)
    returns (
      uint256 profit,
      uint256 collateralToBuyLong,
      uint256 collateralToBuyShort
    )
  {
    uint256 collateralBefore = _collateral.balanceOf(address(this));
    collateralToBuyLong = _buyLongOrShort(
      tradeParams,
      market.getLongToken(),
      true
    );
    collateralToBuyShort = _buyLongOrShort(
      tradeParams,
      market.getShortToken(),
      false
    );
    market.redeem(
      tradeParams.longShortAmount,
      tradeParams.longShortAmount,
      address(this)
    );
    uint256 collateralAfter = _collateral.balanceOf(address(this));
    if (collateralBefore >= collateralAfter) {
      revert UnprofitableTrade(collateralBefore, collateralAfter);
    }
    profit = collateralAfter - collateralBefore;
    emit ArbitrageProfit(address(market), false, profit);
  }

  function mintAndSell(
    IPrePOMarket market,
    OffChainTradeParams calldata tradeParams
  )
    external
    override
    onlyRole(MINT_AND_SELL_ROLE)
    onlyValidMarkets(market)
    returns (
      uint256 profit,
      uint256 collateralFromSellingLong,
      uint256 collateralFromSellingShort
    )
  {
    uint256 collateralBefore = _collateral.balanceOf(address(this));
    market.mint(tradeParams.longShortAmount);
    collateralFromSellingLong = _sellLongOrShort(
      tradeParams,
      market.getLongToken(),
      true
    );
    collateralFromSellingShort = _sellLongOrShort(
      tradeParams,
      market.getShortToken(),
      false
    );
    uint256 collateralAfter = _collateral.balanceOf(address(this));
    if (collateralBefore >= collateralAfter) {
      revert UnprofitableTrade(collateralBefore, collateralAfter);
    }
    profit = collateralAfter - collateralBefore;
    emit ArbitrageProfit(address(market), true, profit);
  }

  function setMarketValidity(address market, bool validity)
    external
    override
    onlyRole(SET_MARKET_VALIDITY_ROLE)
  {
    _marketToValidity[market] = validity;
    address swapRouter = address(_swapRouter);
    ILongShortToken longToken = IPrePOMarket(market).getLongToken();
    ILongShortToken shortToken = IPrePOMarket(market).getShortToken();
    if (validity) {
      _collateral.approve(market, type(uint256).max);
      longToken.approve(swapRouter, type(uint256).max);
      shortToken.approve(swapRouter, type(uint256).max);
    } else {
      _collateral.approve(market, 0);
      longToken.approve(swapRouter, 0);
      shortToken.approve(swapRouter, 0);
    }
    emit MarketValidityChange(market, validity);
  }

  function getCollateral() external view override returns (ICollateral) {
    return _collateral;
  }

  function getSwapRouter() external view override returns (ISwapRouter) {
    return _swapRouter;
  }

  function isMarketValid(address market)
    external
    view
    override
    returns (bool)
  {
    return _marketToValidity[market];
  }

  function _buyLongOrShort(
    OffChainTradeParams calldata tradeParams,
    ILongShortToken longShortToken,
    bool long
  ) private returns (uint256) {
    uint256 amountInMaximum = long
      ? tradeParams.collateralLimitForLong
      : tradeParams.collateralLimitForShort;
    ISwapRouter.ExactOutputSingleParams memory exactOutputSingleParams = ISwapRouter
      .ExactOutputSingleParams(
        address(_collateral), // tokenIn
        address(longShortToken), // tokenOut
        POOL_FEE_TIER,
        address(this), // recipient
        tradeParams.deadline,
        tradeParams.longShortAmount, // amountOut
        amountInMaximum,
        0 // sqrtPriceLimitX96
      );
    return _swapRouter.exactOutputSingle(exactOutputSingleParams);
  }

  function _sellLongOrShort(
    OffChainTradeParams calldata tradeParams,
    ILongShortToken longShortToken,
    bool long
  ) private returns (uint256) {
    uint256 amountOutMinimum = long
      ? tradeParams.collateralLimitForLong
      : tradeParams.collateralLimitForShort;
    ISwapRouter.ExactInputSingleParams memory exactInputSingleParams = ISwapRouter
      .ExactInputSingleParams(
        address(longShortToken), // tokenIn
        address(_collateral), // tokenOut
        POOL_FEE_TIER,
        address(this), // recipient
        tradeParams.deadline,
        tradeParams.longShortAmount, // amountIn
        amountOutMinimum,
        0 // sqrtPriceLimitX96
      );
    return _swapRouter.exactInputSingle(exactInputSingleParams);
  }
}
