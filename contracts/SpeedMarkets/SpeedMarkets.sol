// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "../utils/libraries/AddressSetLib.sol";

import "../interfaces/IStakingThales.sol";
import "../interfaces/IMultiCollateralOnOffRamp.sol";
// import "../interfaces/IContractDeployer.sol";
import {IReferrals} from "../interfaces/IReferrals.sol";


import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

/// @title An AMM for Thales speed markets
contract SpeedMarkets is ProxyOwned, ProxyPausable, ProxyReentrancyGuard {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressSetLib for AddressSetLib.AddressSet;

    enum Direction {
        Up,
        Down
    }

    struct MarketData {
        address user;
        bytes32 asset;
        uint64 strikeTime;
        int64 strikePrice;
        Direction direction;
        uint buyinAmount;
        bool resolved;
        int64 finalPrice;
        Direction result;
        bool isUserWinner;
        uint256 createdAt;
    }
    
    struct Risk {
        Direction direction;
        uint current;
        uint max;
    }
    
    uint private constant ONE = 1e18;
    IERC20Upgradeable public sUSD;
    //eth 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
    IPyth public pyth;
    IStakingThales public stakingThales;

    address public safeBox;

    uint64 public maximumPriceDelay;
    uint64 public maximumPriceDelayForResolving;

    uint public safeBoxImpact;
    uint public lpFee;
    
    uint public minimalTimeToMaturity;
    uint public maximalTimeToMaturity;

    uint public minBuyinAmount;
    uint public maxBuyinAmount;

    mapping(bytes32 => bool) public supportedAsset;
    mapping(bytes32 => uint) public maxRiskPerAsset;
    mapping(bytes32 => uint) public currentRiskPerAsset;
    mapping(bytes32 => bytes32) public assetToPythId;
    
    mapping(bytes32 => mapping(Direction => uint)) public maxRiskPerAssetAndDirection;
    mapping(bytes32 => mapping(Direction => uint)) public currentRiskPerAssetAndDirection;    

    mapping(address => bool) public whitelistedAddresses;

    // bellow subject to change/remove:

    AddressSetLib.AddressSet internal _activeMarkets;
    AddressSetLib.AddressSet internal _maturedMarkets;

    IMultiCollateralOnOffRamp public multiCollateralOnOffRamp;
    bool public multicollateralEnabled;

  


    mapping(address => bool) private marketHasCreatedAtAttribute;

    address public referrals;

    address public speedContract;

    bytes32 public speedContractHash;

    address public contractDeployer;
    
    mapping(address => AddressSetLib.AddressSet) internal _activeMarketsPerUser;
    mapping(address => AddressSetLib.AddressSet) internal _maturedMarketsPerUser;


    constructor(bytes32 _speedMarketHash) {
        speedContractHash = _speedMarketHash;
        setOwner(msg.sender);
        initNonReentrant();
    }

    // constructor(address _owner, IERC20Upgradeable _sUSD, IPyth _pyth, bytes32 _speedMarketHash) {
    //     setOwner(_owner);
    //     initNonReentrant();
    //     sUSD = _sUSD;
    //     pyth = _pyth;
    //     speedContractHash = _speedMarketHash;
    // }

    function initialize(address _owner, IERC20Upgradeable _sUSD, IPyth _pyth) public initializer {
        setOwner(_owner);
        initNonReentrant();
        sUSD = _sUSD;
        pyth = _pyth;
    }

    function createNewMarket(
        bytes32 asset,
        uint64 strikeTime,
        Direction direction,
        uint buyinAmount,
        bytes[] calldata priceUpdateData,
        address _referrer
    ) external payable nonReentrant notPaused {
        _createNewMarket(asset, strikeTime, direction, buyinAmount, priceUpdateData, true, _referrer);
    }

    function createNewMarketWithDelta(
        bytes32 asset,
        uint64 delta,
        Direction direction,
        uint buyinAmount,
        bytes[] calldata priceUpdateData,
        address _referrer
    ) external payable nonReentrant notPaused {
        _createNewMarket(asset, uint64(block.timestamp + delta), direction, buyinAmount, priceUpdateData, true, _referrer);
    }

    function createNewMarketWithDifferentCollateral(
        bytes32 asset,
        uint64 strikeTime,
        Direction direction,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth,
        address _referrer
    ) external payable nonReentrant notPaused {
        _createNewMarketWithDifferentCollateral(
            asset,
            strikeTime,
            direction,
            priceUpdateData,
            collateral,
            collateralAmount,
            isEth,
            _referrer
        );
    }

    function createNewMarketWithDifferentCollateralAndDelta(
        bytes32 asset,
        uint64 delta,
        Direction direction,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth,
        address _referrer
    ) external payable nonReentrant notPaused {
        _createNewMarketWithDifferentCollateral(
            asset,
            uint64(block.timestamp + delta),
            direction,
            priceUpdateData,
            collateral,
            collateralAmount,
            isEth,
            _referrer
        );
    }

    function _convertCollateral(address collateral, uint collateralAmount, bool isEth) internal returns (uint buyinAmount) {
        uint convertedAmount;
        if (isEth) {
            convertedAmount = multiCollateralOnOffRamp.onrampWithEth{value: collateralAmount}(collateralAmount);
        } else {
            IERC20Upgradeable(collateral).safeTransferFrom(msg.sender, address(this), collateralAmount);
            IERC20Upgradeable(collateral).approve(address(multiCollateralOnOffRamp), collateralAmount);
            convertedAmount = multiCollateralOnOffRamp.onramp(collateral, collateralAmount);
        }
        buyinAmount = (convertedAmount * (ONE - safeBoxImpact - lpFee)) / ONE;
    }

    function _createNewMarketWithDifferentCollateral(
        bytes32 asset,
        uint64 strikeTime,
        Direction direction,
        bytes[] calldata priceUpdateData,
        address collateral,
        uint collateralAmount,
        bool isEth,
        address _referrer
    ) internal {
        require(multicollateralEnabled, "Multicollateral onramp not enabled");
        uint buyinAmount = _convertCollateral(collateral, collateralAmount, isEth);
        _createNewMarket(asset, strikeTime, direction, buyinAmount, priceUpdateData, false, _referrer);
    }

    function _handleReferrer(address buyer, uint volume) internal returns (uint referrerShare) {
        if (referrals != address(0)) {
            address referrer = IReferrals(referrals).referrals(buyer);

            if (referrer != address(0)) {
                uint referrerFeeByTier = IReferrals(referrals).getReferrerFee(referrer);
                if (referrerFeeByTier > 0) {
                    referrerShare = (volume * referrerFeeByTier) / ONE;
                    sUSD.safeTransfer(referrer, referrerShare);
                    emit ReferrerPaid(referrer, buyer, referrerShare, volume);
                }
            }
        }
    }

    function _handleRisk(bytes32 asset, Direction direction, uint buyinAmount) internal {
        currentRiskPerAsset[asset] += buyinAmount;
        require(currentRiskPerAsset[asset] <= maxRiskPerAsset[asset], "OI cap breached");

        Direction oppositeDirection = direction == Direction.Up
            ? Direction.Down
            : Direction.Up;
        uint amountToIncreaseRisk = buyinAmount;
        // decrease risk for opposite direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] > buyinAmount) {
            currentRiskPerAssetAndDirection[asset][oppositeDirection] -= buyinAmount;
        } else {
            amountToIncreaseRisk = buyinAmount - currentRiskPerAssetAndDirection[asset][oppositeDirection];
            currentRiskPerAssetAndDirection[asset][oppositeDirection] = 0;
        }
        // until there is risk for opposite direction, don't modify/check risk for current direction
        if (currentRiskPerAssetAndDirection[asset][oppositeDirection] == 0) {
            currentRiskPerAssetAndDirection[asset][direction] += amountToIncreaseRisk;
            require(
                currentRiskPerAssetAndDirection[asset][direction] <= maxRiskPerAssetAndDirection[asset][direction],
                "Risk per direction exceeded"
            );
        }
    }

    function _createNewMarket(
        bytes32 asset,
        uint64 strikeTime,
        Direction direction,
        uint buyinAmount,
        bytes[] memory priceUpdateData,
        bool transferSusd,
        address _referrer
    ) internal {
        if (_referrer != address(0)) {
            IReferrals(referrals).setReferrer(_referrer, msg.sender);
        }
        require(supportedAsset[asset], "Asset is not supported");
        require(buyinAmount >= minBuyinAmount && buyinAmount <= maxBuyinAmount, "wrong buy in amount");
        require(
            strikeTime >= (block.timestamp + minimalTimeToMaturity),
            "time has to be in the future + minimalTimeToMaturity"
        );
        require(strikeTime <= block.timestamp + maximalTimeToMaturity, "time too far into the future");

        _handleRisk(asset, direction, buyinAmount);

        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(assetToPythId[asset]);

        require((price.publishTime + maximumPriceDelay) > block.timestamp && price.price > 0, "Stale price");

        if (transferSusd) {
            uint totalAmountToTransfer = (buyinAmount * (ONE + safeBoxImpact + lpFee)) / ONE;
            sUSD.safeTransferFrom(msg.sender, address(this), totalAmountToTransfer);
        }
        // changes start here:
        SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        srm.initialize(
            SpeedMarket.InitParams(address(this), msg.sender, asset, strikeTime, price.price, direction, buyinAmount)
        );

        sUSD.safeTransfer(address(srm), buyinAmount * 2);

        uint referrerShare = _handleReferrer(msg.sender, buyinAmount);
        sUSD.safeTransfer(safeBox, (buyinAmount * safeBoxImpact) / ONE - referrerShare);

        _activeMarkets.add(address(srm));
        _activeMarketsPerUser[msg.sender].add(address(srm));

        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(msg.sender, buyinAmount);
        }

        marketHasCreatedAtAttribute[address(srm)] = true;
        emit MarketCreated(address(srm), msg.sender, asset, strikeTime, price.price, direction, buyinAmount);
    }

    function setSpeedContractHash(bytes32 _speedContractHash) external {
        speedContractHash = _speedContractHash;
    }

    function setContractDeployer(address _contractDeployer) external {
        contractDeployer = _contractDeployer;
    }

    function createJustProxyMarket(bytes32 salt, address _add1, address _add2) external returns (address newContract) {
        (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
            uint32(gasleft()),
            address(DEPLOYER_SYSTEM_CONTRACT),
            uint128(0),
            abi.encodeCall(
                DEPLOYER_SYSTEM_CONTRACT.create2Account,
                (salt, speedContractHash, abi.encode(_add1, _add2), IContractDeployer.AccountAbstractionVersion.Version1)
            )
        );
        require(success, "Deployment failed");

        (newContract) = abi.decode(returnData, (address));
    }

    function _createNewProxyMarket(bytes32 salt) internal {
        bytes memory dummyBytes;
        speedContract = IContractDeployer(contractDeployer).create2(salt, speedContractHash, dummyBytes);
        // bytes32 asset = 0x4254430000000000000000000000000000000000000000000000000000000000;
        // SpeedMarket srm = SpeedMarket(Clones.clone(speedMarketMastercopy));
        // SpeedMarket srm = SpeedMarket(createClone(speedMarketMastercopy));
        // bytes32 bytecodeHash = 0x0100027d7f750c91f9217c2d9d013afb83690bd92da757e5613e39fa6f860702;
        // speedContract = new SpeedMarket();

        // srm.initialize(
        //     SpeedMarket.InitParams(address(this), msg.sender, asset, 55555, 1e7, Direction.Up, 66666)
        // );
        // emit MarketCreated(msg.sender, msg.sender, 0x4254430000000000000000000000000000000000000000000000000000000000, 55555, 1e7, Direction.Up, 66666);
        emit MarketCreated(
            speedContract,
            msg.sender,
            0x4254430000000000000000000000000000000000000000000000000000000000,
            55555,
            777,
            Direction.Up,
            66666
        );
    }

    function _updatePriceMarket(bytes32 asset, bytes[] memory priceUpdateData) internal {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(assetToPythId[asset]);

        emit MarketCreated(address(this), msg.sender, asset, 55555, price.price, Direction.Up, 66666);
    }

    function createClone(address target) internal returns (address result) {
        bytes20 targetBytes = bytes20(target) << 16;
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602b80600a3d3981f3363d3d373d3d3d363d71000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x26), 0x5af43d82803e903d91602957fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x35)
        }
        require(result != address(0), "ERC1167: custom create failed");
    }

    function updatePriceMarket(bytes32 asset, bytes[] memory priceUpdateData) external payable nonReentrant notPaused {
        _updatePriceMarket(asset, priceUpdateData);
    }

    /// @notice resolveMarket resolves an active market
    /// @param market address of the market
    function resolveMarket(address market, bytes[] calldata priceUpdateData) external payable nonReentrant notPaused {
        _resolveMarket(market, priceUpdateData);
    }

    /// @notice resolveMarkets in a batch
    function resolveMarketsBatch(
        address[] calldata markets,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant notPaused {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];
            if (canResolveMarket(market)) {
                bytes[] memory subarray = new bytes[](1);
                subarray[0] = priceUpdateData[i];
                _resolveMarket(market, subarray);
            }
        }
    }

    function _resolveMarket(address market, bytes[] memory priceUpdateData) internal {
        require(canResolveMarket(market), "Can not resolve");

        uint fee = pyth.getUpdateFee(priceUpdateData);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = assetToPythId[SpeedMarket(market).asset()];
        PythStructs.PriceFeed[] memory prices = pyth.parsePriceFeedUpdates{value: fee}(
            priceUpdateData,
            priceIds,
            SpeedMarket(market).strikeTime(),
            SpeedMarket(market).strikeTime() + maximumPriceDelayForResolving
        );

        PythStructs.Price memory price = prices[0].price;

        require(price.price > 0, "invalid price");

        _resolveMarketWithPrice(market, price.price);
    }

    /// @notice admin resolve market for a given market address with finalPrice
    function resolveMarketManually(address _market, int64 _finalPrice) external isAddressWhitelisted {
        _resolveMarketManually(_market, _finalPrice);
    }

    /// @notice admin resolve for a given markets with finalPrices
    function resolveMarketManuallyBatch(
        address[] calldata markets,
        int64[] calldata finalPrices
    ) external isAddressWhitelisted {
        for (uint i = 0; i < markets.length; i++) {
            if (canResolveMarket(markets[i])) {
                _resolveMarketManually(markets[i], finalPrices[i]);
            }
        }
    }

    function _resolveMarketManually(address _market, int64 _finalPrice) internal {
        require(canResolveMarket(_market), "Can not resolve");
        _resolveMarketWithPrice(_market, _finalPrice);
    }

    function _resolveMarketWithPrice(address market, int64 _finalPrice) internal {
        SpeedMarket(market).resolve(_finalPrice);
        _activeMarkets.remove(market);
        _maturedMarkets.add(market);
        address user = SpeedMarket(market).user();

        if (_activeMarketsPerUser[user].contains(market)) {
            _activeMarketsPerUser[user].remove(market);
        }
        _maturedMarketsPerUser[user].add(market);

        bytes32 asset = SpeedMarket(market).asset();
        uint buyinAmount = SpeedMarket(market).buyinAmount();
        Direction direction = SpeedMarket(market).direction();

        if (currentRiskPerAssetAndDirection[asset][direction] > buyinAmount) {
            currentRiskPerAssetAndDirection[asset][direction] -= buyinAmount;
        } else {
            currentRiskPerAssetAndDirection[asset][direction] = 0;
        }

        if (!SpeedMarket(market).isUserWinner()) {
            if (currentRiskPerAsset[asset] > 2 * buyinAmount) {
                currentRiskPerAsset[asset] -= (2 * buyinAmount);
            } else {
                currentRiskPerAsset[asset] = 0;
            }
        }

        emit MarketResolved(market, SpeedMarket(market).result(), SpeedMarket(market).isUserWinner());
    }

    //////////// getters for active and matured markets/////////////////

    /// @notice isKnownMarket checks if market is among matured or active markets
    /// @param candidate Address of the market.
    /// @return bool
    function isKnownMarket(address candidate) public view returns (bool) {
        return _activeMarkets.contains(candidate) || _maturedMarkets.contains(candidate);
    }

    /// @notice isActiveMarket checks if market is active market
    /// @param candidate Address of the market.
    /// @return bool
    function isActiveMarket(address candidate) public view returns (bool) {
        return _activeMarkets.contains(candidate);
    }

    /// @notice numActiveMarkets returns number of active markets
    /// @return uint
    function numActiveMarkets() external view returns (uint) {
        return _activeMarkets.elements.length;
    }

    /// @notice activeMarkets returns list of active markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] active market list
    function activeMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _activeMarkets.getPage(index, pageSize);
    }

    /// @notice numMaturedMarkets returns number of mature markets
    /// @return uint
    function numMaturedMarkets() external view returns (uint) {
        return _maturedMarkets.elements.length;
    }

    /// @notice maturedMarkets returns list of matured markets
    /// @param index index of the page
    /// @param pageSize number of addresses per page
    /// @return address[] matured market list
    function maturedMarkets(uint index, uint pageSize) external view returns (address[] memory) {
        return _maturedMarkets.getPage(index, pageSize);
    }

    /// @notice numActiveMarkets returns number of active markets per use
    function numActiveMarketsPerUser(address user) external view returns (uint) {
        return _activeMarketsPerUser[user].elements.length;
    }

    /// @notice activeMarkets returns list of active markets per user
    function activeMarketsPerUser(uint index, uint pageSize, address user) external view returns (address[] memory) {
        return _activeMarketsPerUser[user].getPage(index, pageSize);
    }

    /// @notice numMaturedMarkets returns number of matured markets per use
    function numMaturedMarketsPerUser(address user) external view returns (uint) {
        return _maturedMarketsPerUser[user].elements.length;
    }

    /// @notice maturedMarkets returns list of matured markets per user
    function maturedMarketsPerUser(uint index, uint pageSize, address user) external view returns (address[] memory) {
        return _maturedMarketsPerUser[user].getPage(index, pageSize);
    }

    /// @notice whether a market can be resolved
    function canResolveMarket(address market) public view returns (bool) {
        return
            _activeMarkets.contains(market) &&
            (SpeedMarket(market).strikeTime() < block.timestamp) &&
            !SpeedMarket(market).resolved();
    }

    /// @notice return all market data for an array of markets
    function getMarketsData(address[] calldata marketsArray) external view returns (MarketData[] memory) {
        MarketData[] memory markets = new MarketData[](marketsArray.length);
        for (uint i = 0; i < marketsArray.length; i++) {
            SpeedMarket market = SpeedMarket(marketsArray[i]);
            markets[i].user = market.user();
            markets[i].asset = market.asset();
            markets[i].strikeTime = market.strikeTime();
            markets[i].strikePrice = market.strikePrice();
            markets[i].direction = market.direction();
            markets[i].buyinAmount = market.buyinAmount();
            markets[i].resolved = market.resolved();
            markets[i].finalPrice = market.finalPrice();
            markets[i].result = market.result();
            markets[i].isUserWinner = market.isUserWinner();
            if (marketHasCreatedAtAttribute[marketsArray[i]]) {
                markets[i].createdAt = market.createdAt();
            }
        }
        return markets;
    }

    /// @notice return all risk data (direction, current and max) for both directions (Up and Down) by specified asset
    function getDirectionalRiskPerAsset(bytes32 asset) external view returns (Risk[] memory) {
        Direction[] memory directions = new Direction[](2);
        directions[0] = Direction.Up;
        directions[1] = Direction.Down;

        Risk[] memory risks = new Risk[](directions.length);
        for (uint i = 0; i < directions.length; i++) {
            Direction currentDirection = directions[i];
            risks[i].direction = currentDirection;
            risks[i].current = currentRiskPerAssetAndDirection[asset][currentDirection];
            risks[i].max = maxRiskPerAssetAndDirection[asset][currentDirection];
        }

        return risks;
    }

    //////////////////setters/////////////////

    /// @notice Set mastercopy to use to create markets
    /// @param _mastercopy to use to create markets
    function setMastercopy(address _mastercopy) external onlyOwner {
        speedMarketMastercopy = _mastercopy;
        emit MastercopyChanged(_mastercopy);
    }

    /// @notice Set minimum and maximum buyin amounts
    function setAmounts(uint _minBuyinAmount, uint _maxBuyinAmount) external onlyOwner {
        minBuyinAmount = _minBuyinAmount;
        maxBuyinAmount = _maxBuyinAmount;
        emit AmountsChanged(_minBuyinAmount, _maxBuyinAmount);
    }

    /// @notice Set minimum and maximum time to maturity
    function setTimes(uint _minimalTimeToMaturity, uint _maximalTimeToMaturity) external onlyOwner {
        minimalTimeToMaturity = _minimalTimeToMaturity;
        maximalTimeToMaturity = _maximalTimeToMaturity;
        emit TimesChanged(_minimalTimeToMaturity, _maximalTimeToMaturity);
    }

    /// @notice map asset to PythID, e.g. "ETH" as bytes 32 to an equivalent ID from pyth docs
    function setAssetToPythID(bytes32 asset, bytes32 pythId) external onlyOwner {
        assetToPythId[asset] = pythId;
        emit SetAssetToPythID(asset, pythId);
    }

    /// @notice whats the longest a price can be delayed
    function setMaximumPriceDelay(uint64 _maximumPriceDelay) external onlyOwner {
        maximumPriceDelay = _maximumPriceDelay;
        emit SetMaximumPriceDelay(maximumPriceDelay);
    }

    /// @notice whats the longest a price can be delayed when resolving
    function setMaximumPriceDelayForResolving(uint64 _maximumPriceDelayForResolving) external onlyOwner {
        maximumPriceDelayForResolving = _maximumPriceDelayForResolving;
        emit SetMaximumPriceDelayForResolving(maximumPriceDelayForResolving);
    }

    /// @notice maximum open interest per asset
    function setMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset) external onlyOwner {
        maxRiskPerAsset[asset] = _maxRiskPerAsset;
        emit SetMaxRiskPerAsset(asset, _maxRiskPerAsset);
    }

    /// @notice maximum risk per asset and direction
    function setMaxRiskPerAssetAndDirection(bytes32 asset, uint _maxRiskPerAssetAndDirection) external onlyOwner {
        maxRiskPerAssetAndDirection[asset][Direction.Up] = _maxRiskPerAssetAndDirection;
        maxRiskPerAssetAndDirection[asset][Direction.Down] = _maxRiskPerAssetAndDirection;
        emit SetMaxRiskPerAssetAndDirection(asset, _maxRiskPerAssetAndDirection);
    }

    /// @notice set SafeBox params
    function setSafeBoxParams(address _safeBox, uint _safeBoxImpact) external onlyOwner {
        safeBox = _safeBox;
        safeBoxImpact = _safeBoxImpact;
        emit SetSafeBoxParams(_safeBox, _safeBoxImpact);
    }

    /// @notice set LP fee
    function setLPFee(uint _lpFee) external onlyOwner {
        lpFee = _lpFee;
        emit SetLPFee(_lpFee);
    }

    /// @notice Set staking thales
    function setStakingThales(address _stakingThales) external onlyOwner {
        //TODO: dont set till StakingThalesBonusRewardsManager is ready for it
        stakingThales = IStakingThales(_stakingThales);
        emit SetStakingThales(_stakingThales);
    }

    /// @notice set referrals
    /// @param _referrals contract for referrals storage
    function setReferrals(address _referrals) external onlyOwner {
        require(_referrals != address(0), "Can not be zero address");
        referrals = _referrals;
    }

    /// @notice Set pyth
    function setPyth(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
        emit SetPyth(_pyth);
    }

    /// @notice set whether an asset is supported
    function setSupportedAsset(bytes32 asset, bool _supported) external onlyOwner {
        supportedAsset[asset] = _supported;
        emit SetSupportedAsset(asset, _supported);
    }

    /// @notice set multicollateral onramp contract
    function setMultiCollateralOnOffRamp(address _onramper, bool enabled) external onlyOwner {
        multiCollateralOnOffRamp = IMultiCollateralOnOffRamp(_onramper);
        multicollateralEnabled = enabled;
        emit SetMultiCollateralOnOffRamp(_onramper, enabled);
    }

    /// @notice adding/removing whitelist address depending on a flag
    /// @param _whitelistAddress address that needed to be whitelisted/ ore removed from WL
    /// @param _flag adding or removing from whitelist (true: add, false: remove)
    function addToWhitelist(address _whitelistAddress, bool _flag) external onlyOwner {
        require(_whitelistAddress != address(0) && whitelistedAddresses[_whitelistAddress] != _flag);
        whitelistedAddresses[_whitelistAddress] = _flag;
        emit AddedIntoWhitelist(_whitelistAddress, _flag);
    }

    //////////////////modifiers/////////////////

    modifier isAddressWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Resolver not whitelisted");
        _;
    }

    //////////////////events/////////////////

    event MarketCreated(
        address market,
        address user,
        bytes32 asset,
        uint strikeTime,
        int64 strikePrice,
        Direction direction,
        uint buyinAmount
    );

    event MarketResolved(address market, Direction result, bool userIsWinner);

    event MastercopyChanged(address mastercopy);
    event AmountsChanged(uint _minBuyinAmount, uint _maxBuyinAmount);
    event TimesChanged(uint _minimalTimeToMaturity, uint _maximalTimeToMaturity);
    event SetAssetToPythID(bytes32 asset, bytes32 pythId);
    event SetMaximumPriceDelay(uint _maximumPriceDelay);
    event SetMaximumPriceDelayForResolving(uint _maximumPriceDelayForResolving);
    event SetMaxRiskPerAsset(bytes32 asset, uint _maxRiskPerAsset);
    event SetMaxRiskPerAssetAndDirection(bytes32 asset, uint _maxRiskPerAssetAndDirection);
    event SetSafeBoxParams(address _safeBox, uint _safeBoxImpact);
    event SetLPFee(uint _lpFee);
    event SetStakingThales(address _stakingThales);
    event SetPyth(address _pyth);
    event SetSupportedAsset(bytes32 asset, bool _supported);
    event AddedIntoWhitelist(address _whitelistAddress, bool _flag);
    event SetMultiCollateralOnOffRamp(address _onramper, bool enabled);
    event ReferrerPaid(address refferer, address trader, uint amount, uint volume);
}