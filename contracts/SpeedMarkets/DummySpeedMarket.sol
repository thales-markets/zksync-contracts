// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DummySpeedMarket {
    uint public one;
    uint public two;
    uint public three;

    constructor() {}

    function setONE(uint _one) external {
        one = _one;
        two = _one;
        three = _one;
    }
}
