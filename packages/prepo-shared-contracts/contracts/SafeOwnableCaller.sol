// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ISafeOwnable.sol";
import "./interfaces/ISafeOwnableCaller.sol";

abstract contract SafeOwnableCaller is ISafeOwnableCaller {
  function transferOwnership(address safeOwnableContract, address nominee)
    public
    virtual
    override;

  function acceptOwnership(address safeOwnableContract)
    public
    virtual
    override;

  function renounceOwnership(address safeOwnableContract)
    public
    virtual
    override;
}
