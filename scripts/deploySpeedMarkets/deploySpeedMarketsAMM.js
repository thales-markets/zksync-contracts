const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
// const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');
const w3utils = require('web3-utils');

const { utils, Wallet, Provider } = require('zksync-web3');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');

const hre = require('hardhat');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let thalesAddress, ProxyERC20sUSDaddress;

	let proxySUSD;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
		proxySUSD = getTargetAddress('BUSD', network);
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}
	if (networkObj.chainId == 280) {
		networkObj.name = 'zkTestnet';
		network = 'zkTestnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}
	if (networkObj.chainId == 324) {
		networkObj.name = 'zkSyncNetwork';
		network = 'zkSyncNetwork';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	// let speedMasterHash = '0x0100029df27f12cec5258e3e4e96e07740510c368e78e8642cab53541befbc8d';

	// console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);
	if (network == 'zkTestnet') {
		const zkSyncProvider = new Provider('https://testnet.era.zksync.dev/');
		const ethereumProvider = ethers.getDefaultProvider('goerli');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('AAFactory');
		const speedMarket = await deployer.loadArtifact('TwoUserMultiSig');
		const speedMasterHash = utils.hashBytecode(speedMarket.bytecode);
		const SpeedMarketsAMM = await deployer.deploy(contract, [speedMasterHash], undefined, [
			speedMarket.bytecode,
		]);

		await SpeedMarketsAMM.deployed();
		//obtain the Constructor Arguments
		// console.log("constructor args:" + greeterContract.interface.encodeDeploy([greeting]));

		// Show the contract info.
		const contractAddress = SpeedMarketsAMM.address;
		console.log(`${contract.contractName} was deployed to ${contractAddress}`);

		console.log('AAFactory deployed to:', SpeedMarketsAMM.address);
		setTargetAddress('AAFactory', network, SpeedMarketsAMM.address);

		await delay(25000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketsAMM.address,
				// contract: 'contracts/SpeedMarkets/DummySpeedMarket.sol:DummySpeedMarket',
				// contract: 'contracts/SpeedMarkets/SpeedMarketsAMM.sol:SpeedMarketsAMM',
				contract: 'contracts/SpeedMarkets/AAFactory.sol:AAFactory',
				constructorArguments: [speedMasterHash],
			});
		} catch (e) {
			console.log(e);
		}

		await delay(25000);
		console.log('start deploying accounts');
		const salt = ethers.constants.HashZero;
		const owner1 = Wallet.createRandom();
		const owner2 = Wallet.createRandom();
		console.log('salt: ', salt);
		console.log('owner1: ', owner1.address);
		console.log('owner2: ', owner2.address);

		const tx = await SpeedMarketsAMM.deployAccount(salt, owner1.address, owner2.address);
		await tx.wait();

		const abiCoder = new ethers.utils.AbiCoder();
		const multisigAddress = utils.create2Address(
			SpeedMarketsAMM.address,
			await SpeedMarketsAMM.aaBytecodeHash(),
			salt,
			abiCoder.encode(['address', 'address'], [owner1.address, owner2.address])
		);
		console.log(`Multisig account deployed on address ${multisigAddress}`);

		// const SpeedMarketsAMM = await hre.zkUpgrades.deployProxy(
		// 	deployer.zkWallet,
		// 	contract,
		// 	[zkWallet.address, proxySUSD, getTargetAddress('Pyth', network), speedMasterHash],
		// 	{ initializer: 'initialize' }
		// );

		// await SpeedMarketsAMM.deployed();
		// console.log(contract.contractName + ' deployed to:', SpeedMarketsAMM.address);
		// setTargetAddress('SpeedMarketsAMM', network, SpeedMarketsAMM.address);
		// await delay(5000);

		// try {
		// 	const verificationId = await hre.run('verify:verify', {
		// 		address: SpeedMarketsAMM.address,
		// 		contract: 'contracts/SpeedMarkets/SpeedMarketsAMM.sol:SpeedMarketsAMM',
		// 	});
		// } catch (e) {
		// 	console.log(e);
		// }
	} else if (network == 'zkSyncNetwork') {
		const zkSyncProvider = new Provider('https://mainnet.era.zksync.io');
		const ethereumProvider = ethers.getDefaultProvider('mainnet');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('SpeedMarketsAMM');

		const SpeedMarketsAMM = await hre.zkUpgrades.deployProxy(
			deployer.zkWallet,
			contract,
			[zkWallet.address, proxySUSD, getTargetAddress('Pyth', network)],
			{ initializer: 'initialize' }
		);

		await SpeedMarketsAMM.deployed();
		console.log(contract.contractName + ' deployed to:', SpeedMarketsAMM.address);
		setTargetAddress('SpeedMarketsAMM', network, SpeedMarketsAMM.address);
		await delay(5000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketsAMM.address,
				contract: 'contracts/SpeedMarkets/SpeedMarketsAMM.sol:SpeedMarketsAMM',
			});
		} catch (e) {
			console.log(e);
		}
	} else {
		const SpeedMarketsAMM = await ethers.getContractFactory('SpeedMarketsAMM');
		let SpeedMarketsAMMDeployed = await upgrades.deployProxy(SpeedMarketsAMM, [
			owner.address,
			proxySUSD,
			getTargetAddress('Pyth', network),
		]);
		await SpeedMarketsAMMDeployed.deployed();

		console.log('SpeedMarketsAMM proxy:', SpeedMarketsAMMDeployed.address);

		const SpeedMarketsAMMImplementation = await getImplementationAddress(
			ethers.provider,
			SpeedMarketsAMMDeployed.address
		);

		console.log('Implementation SpeedMarketsAMM: ', SpeedMarketsAMMImplementation);

		setTargetAddress('SpeedMarketsAMM', network, SpeedMarketsAMMDeployed.address);
		setTargetAddress('SpeedMarketsAMMImplementation', network, SpeedMarketsAMMImplementation);

		delay(5000);

		try {
			await hre.run('verify:verify', {
				address: SpeedMarketsAMMImplementation,
			});
		} catch (e) {
			console.log(e);
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
