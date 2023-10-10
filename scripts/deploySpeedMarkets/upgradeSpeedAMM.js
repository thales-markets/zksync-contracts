const path = require('path');
const { ethers, upgrades } = require('hardhat');
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
	let mainnetNetwork = 'mainnet';
	let PaymentToken;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}
	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
		proxySUSD = getTargetAddress('BUSD', network);
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


	const SpeedMarketsAMMAddress = getTargetAddress('SpeedMarketsAMM', network);

	if (network == 'zkTestnet') {
		const zkSyncProvider = new Provider('https://testnet.era.zksync.dev/');
		const ethereumProvider = ethers.getDefaultProvider('goerli');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('SpeedMarketsAMM');

		const SpeedMarketsAMM = await hre.zkUpgrades.upgradeProxy(
			deployer.zkWallet,
			SpeedMarketsAMMAddress,
			contract
		);

		// await SpeedMarketsAMM.deployed();
		// console.log(contract.contractName + ' deployed to:', SpeedMarketsAMM.address);
		// setTargetAddress('SpeedMarketsAMM', network, SpeedMarketsAMM.address);
		// await delay(5000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketsAMMAddress,
				contract: 'contracts/SpeedMarkets/SpeedMarketsAMM.sol:SpeedMarketsAMM',
			});
		} catch (e) {
			console.log(e);
		}
	} else if (network == 'zkSyncNetwork') {
		const zkSyncProvider = new Provider('https://mainnet.era.zksync.io');
		const ethereumProvider = ethers.getDefaultProvider('mainnet');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);

		const contract = await deployer.loadArtifact('SpeedMarketsAMM');

		const SpeedMarketsAMM = await hre.zkUpgrades.upgradeProxy(
			deployer.zkWallet,
			SpeedMarketsAMMAddress,
			contract
		);

		// await SpeedMarketsAMM.deployed();
		// console.log(contract.contractName + ' deployed to:', SpeedMarketsAMM.address);
		// setTargetAddress('SpeedMarketsAMM', network, SpeedMarketsAMM.address);
		// await delay(5000);

		try {
			const verificationId = await hre.run('verify:verify', {
				address: SpeedMarketsAMMAddress,
				contract: 'contracts/SpeedMarkets/SpeedMarketsAMM.sol:SpeedMarketsAMM',
			});
		} catch (e) {
			console.log(e);
		}
	} else {
		const SpeedMarketsAMM = await ethers.getContractFactory('SpeedMarketsAMM');

		if (networkObj.chainId == 42 || networkObj.chainId == 5 || networkObj.chainId == 420) {
			await upgrades.upgradeProxy(SpeedMarketsAMMAddress, SpeedMarketsAMM);
			await delay(15000);

			const SpeedMarketsAMMImplementation = await getImplementationAddress(
				ethers.provider,
				SpeedMarketsAMMAddress
			);
			console.log('SpeedMarketsAMM upgraded');

			console.log('Implementation SpeedMarketsAMM: ', SpeedMarketsAMMImplementation);
			setTargetAddress('SpeedMarketsAMMImplementation', network, SpeedMarketsAMMImplementation);

			try {
				await hre.run('verify:verify', {
					address: SpeedMarketsAMMImplementation,
				});
			} catch (e) {
				console.log(e);
			}
		}

		if (
			networkObj.chainId == 10 ||
			networkObj.chainId == 42161 ||
			networkObj.chainId == 137 ||
			networkObj.chainId == 56 ||
			networkObj.chainId == 8453
		) {
			const implementation = await upgrades.prepareUpgrade(SpeedMarketsAMMAddress, SpeedMarketsAMM);
			await delay(5000);

			console.log('SpeedMarketsAMM upgraded');

			console.log('Implementation SpeedMarketsAMM: ', implementation);
			setTargetAddress('SpeedMarketsAMMImplementation', network, implementation);
			try {
				await hre.run('verify:verify', {
					address: implementation,
				});
			} catch (e) {
				console.log(e);
			}
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
