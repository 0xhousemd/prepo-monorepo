// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "prepo-shared-contracts/contracts/interfaces/IUniswapV3OracleUintValue.sol";

contract UniswapV3OracleUintValue is IUniswapV3OracleUintValue, SafeOwnable {
  IUniswapV3Oracle private immutable _oracle;
  address private immutable _baseToken;
  address private immutable _quoteToken;
  uint32 private _observationPeriod;
  uint256 private _baseAmount;

  constructor(
    IUniswapV3Oracle oracle,
    address baseToken,
    address quoteToken
  ) {
    _oracle = oracle;
    _baseToken = baseToken;
    _quoteToken = quoteToken;
  }

  function setObservationPeriod(uint32 observationPeriod)
    external
    override
    onlyOwner
  {
    _observationPeriod = observationPeriod;
    emit ObservationPeriodChange(observationPeriod);
  }

  function setBaseAmount(uint256 baseAmount) external override onlyOwner {
    _baseAmount = baseAmount;
    emit BaseAmountChange(baseAmount);
  }

  function get() external view override returns (uint256) {}

  function getOracle() external view override returns (IUniswapV3Oracle) {
    return _oracle;
  }

  function getBaseToken() external view override returns (address) {
    return _baseToken;
  }

  function getQuoteToken() external view override returns (address) {
    return _quoteToken;
  }

  function getObservationPeriod() external view override returns (uint32) {
    return _observationPeriod;
  }

  function getBaseAmount() external view override returns (uint256) {
    return _baseAmount;
  }
}
