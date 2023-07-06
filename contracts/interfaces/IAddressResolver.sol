// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAddressResolver {
    /* ========== VIEWS / VARIABLES ========== */
    function getAddress(bytes32 name) external view returns (address);
}
