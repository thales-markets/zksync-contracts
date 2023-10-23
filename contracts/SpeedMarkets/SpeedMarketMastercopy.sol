// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SpeedMarket.sol";

contract SpeedMarketMastercopy is SpeedMarket {
    constructor(address _add1, address _add2) SpeedMarket(_add1, _add2) {
        // Freeze mastercopy on deployment so it can never be initialized with real arguments
        initialized = true;
    }
}
