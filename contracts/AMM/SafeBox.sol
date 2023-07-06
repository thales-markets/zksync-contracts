pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../utils/proxy/ProxyOwned.sol";

contract SafeBox is ProxyOwned, Initializable {
    using SafeERC20 for IERC20;
    IERC20 public sUSD;

    function initialize(address _owner, IERC20 _sUSD) public initializer {
        setOwner(_owner);
        sUSD = _sUSD;
    }

    function retrieveSUSDAmount(address payable account, uint amount) external onlyOwner {
        sUSD.transfer(account, amount);
    }
}
