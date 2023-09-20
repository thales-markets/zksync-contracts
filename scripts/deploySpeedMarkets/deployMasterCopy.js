const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
// const snx = require('synthetix-2.50.4-ovm');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

const { Wallet, Provider } = require('zksync-web3');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');

const hre = require('hardhat');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	if (networkObj.chainId == 280) {
		networkObj.name = 'zkTestnet';
		network = 'zkTestnet';
	}
	if (networkObj.chainId == 324) {
		networkObj.name = 'zkSyncNetwork';
		network = 'zkSyncNetwork';
	}

	// console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	if (network == 'zkTestnet') {
		const zkSyncProvider = new Provider('https://testnet.era.zksync.dev/');
		const ethereumProvider = ethers.getDefaultProvider('goerli');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('SpeedMarketMastercopy');
		// const deploymentFee = await deployer.estimateDeployFee(contract);

		// const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
		// console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

		const SpeedMarketMastercopy = await deployer.deploy(contract);

		await SpeedMarketMastercopy.deployed();
		//obtain the Constructor Arguments
		// console.log("constructor args:" + greeterContract.interface.encodeDeploy([greeting]));

		// Show the contract info.
		const contractAddress = SpeedMarketMastercopy.address;
		console.log(`${contract.contractName} was deployed to ${contractAddress}`);

		console.log('SpeedMarketMastercopy deployed to:', SpeedMarketMastercopy.address);
		setTargetAddress('SpeedMarketMastercopy', network, SpeedMarketMastercopy.address);

		await delay(25000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketMastercopy.address,
				contract: 'contracts/SpeedMarkets/SpeedMarketMastercopy.sol:SpeedMarketMastercopy',
			});
		} catch (e) {
			console.log(e);
		}
	} else if (network == 'zkSyncNetwork') {
		const zkSyncProvider = new Provider('https://mainnet.era.zksync.io');
		const ethereumProvider = ethers.getDefaultProvider('mainnet');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('SpeedMarketMastercopy');
		// const deploymentFee = await deployer.estimateDeployFee(contract);

		// const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
		// console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

		const SpeedMarketMastercopy = await deployer.deploy(contract);

		await SpeedMarketMastercopy.deployed();
		//obtain the Constructor Arguments
		// console.log("constructor args:" + greeterContract.interface.encodeDeploy([greeting]));

		// Show the contract info.
		const contractAddress = SpeedMarketMastercopy.address;
		console.log(`${contract.contractName} was deployed to ${contractAddress}`);

		console.log('SpeedMarketMastercopy deployed to:', SpeedMarketMastercopy.address);
		setTargetAddress('SpeedMarketMastercopy', network, SpeedMarketMastercopy.address);

		await delay(25000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketMastercopy.address,
				contract: 'contracts/SpeedMarkets/SpeedMarketMastercopy.sol:SpeedMarketMastercopy',
			});
		} catch (e) {
			console.log(e);
		}
	} else {
		const SpeedMarketMastercopy = await ethers.getContractFactory('SpeedMarketMastercopy');
		const SpeedMarketMastercopyDeployed = await SpeedMarketMastercopy.deploy();
		await SpeedMarketMastercopyDeployed.deployed();

		console.log('SpeedMarketMastercopy deployed to:', SpeedMarketMastercopyDeployed.address);
		setTargetAddress('SpeedMarketMastercopy', network, SpeedMarketMastercopyDeployed.address);

		await hre.run('verify:verify', {
			address: SpeedMarketMastercopyDeployed.address,
			constructorArguments: [],
			contract: 'contracts/SpeedMarkets/SpeedMarketMastercopy.sol:SpeedMarketMastercopy',
		});
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
