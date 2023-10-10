const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
// const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { toBytes32 } = require('../../../index');
const w3utils = require('web3-utils');

const { Wallet, Provider } = require('zksync-web3');
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

	// console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);
	if (network == 'zkTestnet') {
		const zkSyncProvider = new Provider('https://testnet.era.zksync.dev/');
		const ethereumProvider = ethers.getDefaultProvider('goerli');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);
		const artifact = await deployer.loadArtifact('SpeedMarketsAMM');

		const SpeedAMM = new ethers.Contract(getTargetAddress('SpeedMarketsAMM', network), artifact.abi, zkWallet);

		const salt = "0x5370aa65100d61726b65747346726f6d5468616c6573556e6971756553616c74";
		const owner = "0xf1E099b51B37669d3bB9AB60B8F9C9D0156E2aF0"

		const tx = await SpeedAMM.createJustProxyMarket(
			salt,
			{
				gasLimit: "20000000", 
			}
		);

		await tx.wait().then((e) => {
			console.log('\nSUCCESS!');
		});
	} else if (network == 'zkSyncNetwork') {
		const zkSyncProvider = new Provider('https://mainnet.era.zksync.io');
		const ethereumProvider = ethers.getDefaultProvider('mainnet');
		const zkWallet = new Wallet(process.env.PRIVATE_KEY, zkSyncProvider, ethereumProvider);
		const deployer = new Deployer(hre, zkWallet);
		const provider = new ethers.providers.WebSocketProvider(`wss://testnet.era.zksync.dev/ws`);
		const artifact = await deployer.loadArtifact('SpeedMarketsAMM');

		// console.log(artifact.abi);
  		const SpeedAMM = new ethers.Contract(getTargetAddress('SpeedMarketsAMM', network), artifact.abi, zkWallet);
		// const contract = await deployer.loadArtifact('SpeedMarketsAMM');
		// console.log(contract);

		// const SpeedAMM = await contract.attach(getTargetAddress('SpeedMarketsAMM', network));

		console.log("SpeedAMM: ", SpeedAMM.address);

		const asset = "0x4254430000000000000000000000000000000000000000000000000000000000";
		const delta = 3800;
		const position = 0;
		const buyInAmount = 5500000;
		const priceUpdateData = ["0x01000000030d00b068283090b211ddbf67bc10c5ec659a6d878f79f0bb6211a0b64b14b5f5cd0204860b47ac992248549b866684e1537d9a9ae4289c4dc25fbbe6a5a5d17fb1aa0002e242a79f2d05dd5646a76b4f85e9974c256a49dc405198578a730ce33acb174f119dd056c12fa2359966f47d203b0bf00a591bfaef5f2592cce35bc81f1a8f630003a7991275afe5c131f4ccc0d81c29a561b0d63e569a468d2a5371f623ca96ffe25de7fb9a24612f279b73b56e34ae755435452f0ebaa33b66cacf21d0ecfaa96501041a186144eaa6dce299fb0aa535b136eacdd09ee11a8eec4477c4506313be65be03aedafb87ef342f054d43dc04a886d790e6dee9a7e76ae2491edaf547813df60108f71f5f91c66ad3845ef7313e76e314266f8ef35c8a58fda8f9505623fafa492065ad476d9217f66ea7550f95e01daee3f97a85f7248b91063fb9e9b0627bb5c3010ad9f6d8f962e8a7e8da2e036e84fe822a60135bef870669cea2913784430031eb729d7376ec520a7d659ff2e6e2d9f5616ce3605e85d93e46d022159c44495302000b6251673b0d174e323ec2303942e903ec6fce265cde85468c262461d33c8dacfe1ec1c8305bdf98164a1f7c350d95f319993255663b0d9c80f1e8b4c768cc328e010d313f638d3fa362bbde4cac50207ac36c6565112cb4e19434959260f0523945971f90388f0f87b7dea1d4223ed21e9160e6c2c70350d86d2115bdd077d14d3648000e86bdbf3b7fd2e58636eddee8152c1f599800027f88fa0f0bfe96c957f0d06cf85b81145e33a91c6cb518b2a54c3942de23fa08ca0b831bb6eea8d178ae0e12c9010f477f5838eb5068967ffc4505037ba02ab67a94a516e409a336a9c34c8dc85c4e229d63de587f8faf6f0fbd21097cab19510ef1587e94467f594bcb8444a3519801108204a66239bade7c2aaad5d2465c68d4d37f7fec4663d11dd9d6cc5b5667b7d331bcce60c817d6b2feb0e67555879a0ac53e6e8b7c007552cdaeab866ad456980111c75ba6ff667a2615e19da12c9aa02621396217f0903b3cd72d5e86fc64c733403b51700b0aef759b4d124ffa0c651a58f3e79aeb256fb56cc4a6f9caa97d9409011290236398caa54f07272f48a2f3f864a3cd40b31a0e5129e9a4e474ecd3375c7673d01f3b9731f90df00d1b6a0dabafd87034f3f5d1850c707de5bf9230ae3d5601650c5baa00000000001af8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba00000000027f02d010150325748000300010001020005009d2efa1235ab86c0935cb424b102be4f217e74d1109df9e75dfa8338fc0f0908782f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f00000004e8141f300000000000f45950fffffff800000004e76260740000000000d013f3010000001b0000001f00000000650c5baa00000000650c5ba900000000650c5ba800000004e8141f300000000000f4595000000000650c5ba848d6033d733e27950c2e0351e2505491cd9154824f716d9513514c74b9f98f583dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a300000004d586aebd0000000000ad2cc9fffffff800000004d77a9aa00000000000ce14c3010000001c0000002000000000650c5baa00000000650c5baa00000000650c5ba900000004d5801a480000000000a129fd00000000650c5ba83515b3861e8fe93e5f540ba4077c216404782b86d5e78077b3cbfd27313ab3bce62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b430000026aaea48120000000002bfff460fffffff80000026a044a3100000000002b94064e010000001a0000002000000000650c5baa00000000650c5baa00000000650c5ba90000026aaea48120000000002bfff46000000000650c5ba89b5f73e0075e7d70376012180ddba94272f68d85eae4104e335561c982253d41a19d04ac696c7a6616d291c7e5d1377cc8be437c327b75adb5dc1bad745fcae80000000002a5c58e000000000000bd3efffffff80000000002a0c2bc000000000000b43301000000170000001900000000650c5baa00000000650c5ba900000000650c5ba80000000002a5c58e000000000000bd3e00000000650c5ba8e876fcd130add8984a33aab52af36bc1b9f822c9ebe376f3aa72d630974e15f0dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c00000000005e180b0000000000000c58fffffff800000000005e0df70000000000000b8e010000001c0000002000000000650c5baa00000000650c5baa00000000650c5ba900000000005e180b0000000000000c5800000000650c5ba8"];
		const referer = "0x0000000000000000000000000000000000000000";

		// console.log("Blocknumber: ", await zkSyncProvider.getBlockNumber());S
		// console.log("Timestamp: ", (await zkSyncProvider.getBlock(await zkSyncProvider.getBlockNumber())).timestamp);

		const tx = await SpeedAMM.createNewMarketWithDelta(
			asset,
			delta,
			position,
			buyInAmount,
			priceUpdateData,
			referer,
			{
				gasLimit: "20000000", 
				value: "1",
			}
		);

		await tx.wait().then((e) => {
			console.log('\nSUCCESS!');
		});
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
