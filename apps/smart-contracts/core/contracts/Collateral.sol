// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ICollateral.sol";
import "./interfaces/IHook.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

contract Collateral is
  ICollateral,
  ERC20PermitUpgradeable,
  ReentrancyGuardUpgradeable,
  SafeAccessControlEnumerableUpgradeable
{
  IERC20 private immutable _baseToken;
  uint256 private immutable _baseTokenDenominator;
  address private _manager;
  uint256 private _depositFee;
  uint256 private _withdrawFee;
  IHook private _depositHook;
  IHook private _withdrawHook;
  IHook private _managerWithdrawHook;

  uint256 public constant FEE_DENOMINATOR = 1000000;
  uint256 public constant FEE_LIMIT = 100000;
  bytes32 public constant MANAGER_WITHDRAW_ROLE = keccak256("managerWithdraw");
  bytes32 public constant SET_MANAGER_ROLE = keccak256("setManager");
  bytes32 public constant SET_DEPOSIT_FEE_ROLE = keccak256("setDepositFee");
  bytes32 public constant SET_WITHDRAW_FEE_ROLE = keccak256("setWithdrawFee");
  bytes32 public constant SET_DEPOSIT_HOOK_ROLE = keccak256("setDepositHook");
  bytes32 public constant SET_WITHDRAW_HOOK_ROLE =
    keccak256("setWithdrawHook");
  bytes32 public constant SET_MANAGER_WITHDRAW_HOOK_ROLE =
    keccak256("setManagerWithdrawHook");

  constructor(IERC20 baseToken, uint256 baseTokenDecimals) {
    _baseToken = baseToken;
    _baseTokenDenominator = 10**baseTokenDecimals;
  }

  function initialize(string memory name, string memory symbol)
    public
    initializer
  {
    __SafeAccessControlEnumerable_init();
    __ERC20_init(name, symbol);
    __ERC20Permit_init(name);
    __ReentrancyGuard_init();
  }

  /**
   * @dev If hook not set, fees remain within the contract as extra reserves
   * (withdrawable by manager). Converts amount after fee from base token
   * units to collateral token units.
   */
  function deposit(address recipient, uint256 amount)
    external
    override
    nonReentrant
    returns (uint256)
  {
    uint256 fee = (amount * _depositFee) / FEE_DENOMINATOR;
    if (_depositFee > 0) {
      require(fee > 0, "fee = 0");
    } else {
      require(amount > 0, "amount = 0");
    }
    _baseToken.transferFrom(msg.sender, address(this), amount);
    uint256 amountAfterFee = amount - fee;
    if (address(_depositHook) != address(0)) {
      _baseToken.approve(address(_depositHook), fee);
      _depositHook.hook(msg.sender, recipient, amount, amountAfterFee);
      _baseToken.approve(address(_depositHook), 0);
    }
    /// Converts amount after fee from base token units to collateral token units.
    uint256 collateralMintAmount = (amountAfterFee * 1e18) /
      _baseTokenDenominator;
    _mint(recipient, collateralMintAmount);
    emit Deposit(recipient, amountAfterFee, fee);
    return collateralMintAmount;
  }

  /// @dev Converts amount from collateral token units to base token units.
  function withdraw(address recipient, uint256 amount)
    external
    override
    nonReentrant
    returns (uint256 baseTokenAmountAfterFee)
  {
    uint256 baseTokenAmount = (amount * _baseTokenDenominator) / 1e18;
    uint256 fee = (baseTokenAmount * _withdrawFee) / FEE_DENOMINATOR;
    if (_withdrawFee > 0) {
      require(fee > 0, "fee = 0");
    } else {
      require(baseTokenAmount > 0, "amount = 0");
    }
    _burn(msg.sender, amount);
    baseTokenAmountAfterFee = baseTokenAmount - fee;
    if (address(_withdrawHook) != address(0)) {
      _baseToken.approve(address(_withdrawHook), fee);
      _withdrawHook.hook(
        msg.sender,
        recipient,
        baseTokenAmount,
        baseTokenAmountAfterFee
      );
      _baseToken.approve(address(_withdrawHook), 0);
    }
    _baseToken.transfer(recipient, baseTokenAmountAfterFee);
    emit Withdraw(msg.sender, recipient, baseTokenAmountAfterFee, fee);
  }

  function managerWithdraw(uint256 amount)
    external
    override
    onlyRole(MANAGER_WITHDRAW_ROLE)
    nonReentrant
  {
    if (address(_managerWithdrawHook) != address(0)) {
      _managerWithdrawHook.hook(msg.sender, msg.sender, amount, amount);
    }
    _baseToken.transfer(_manager, amount);
  }

  function setManager(address manager)
    external
    override
    onlyRole(SET_MANAGER_ROLE)
  {
    _manager = manager;
    emit ManagerChange(manager);
  }

  function setDepositFee(uint256 depositFee)
    external
    override
    onlyRole(SET_DEPOSIT_FEE_ROLE)
  {
    require(depositFee <= FEE_LIMIT, "Exceeds fee limit");
    _depositFee = depositFee;
    emit DepositFeeChange(depositFee);
  }

  function setWithdrawFee(uint256 withdrawFee)
    external
    override
    onlyRole(SET_WITHDRAW_FEE_ROLE)
  {
    require(withdrawFee <= FEE_LIMIT, "Exceeds fee limit");
    _withdrawFee = withdrawFee;
    emit WithdrawFeeChange(withdrawFee);
  }

  function setDepositHook(IHook depositHook)
    external
    override
    onlyRole(SET_DEPOSIT_HOOK_ROLE)
  {
    _depositHook = depositHook;
    emit DepositHookChange(address(depositHook));
  }

  function setWithdrawHook(IHook withdrawHook)
    external
    override
    onlyRole(SET_WITHDRAW_HOOK_ROLE)
  {
    _withdrawHook = withdrawHook;
    emit WithdrawHookChange(address(withdrawHook));
  }

  function setManagerWithdrawHook(IHook managerWithdrawHook)
    external
    override
    onlyRole(SET_MANAGER_WITHDRAW_HOOK_ROLE)
  {
    _managerWithdrawHook = managerWithdrawHook;
    emit ManagerWithdrawHookChange(address(managerWithdrawHook));
  }

  function getBaseToken() external view override returns (IERC20) {
    return _baseToken;
  }

  function getManager() external view override returns (address) {
    return _manager;
  }

  function getDepositFee() external view override returns (uint256) {
    return _depositFee;
  }

  function getWithdrawFee() external view override returns (uint256) {
    return _withdrawFee;
  }

  function getDepositHook() external view override returns (IHook) {
    return _depositHook;
  }

  function getWithdrawHook() external view override returns (IHook) {
    return _withdrawHook;
  }

  function getManagerWithdrawHook() external view override returns (IHook) {
    return _managerWithdrawHook;
  }

  function getBaseTokenBalance() external view override returns (uint256) {
    return _baseToken.balanceOf(address(this));
  }
}
