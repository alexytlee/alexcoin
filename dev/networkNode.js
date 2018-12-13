const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1'); // Unique string
const port = process.argv[2];
const rp = require('request-promise');

const nodeAddress = uuid()
	.split('-')
	.join('');

const alexcoin = new Blockchain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/blockchain', function(req, res) {
	res.send(alexcoin);
});

app.post('/transaction', function(req, res) {
	const newTransaction = req.body;
	const blockIndex = alexcoin.addTransactionsToPendingTransactions(newTransaction);
	res.json({ note: `Transaction will be added in block ${blockIndex}.` });
});

app.post('/transaction/broadcast', function(req, res) {
	const newTransaction = alexcoin.createNewTransaction(
		req.body.amount,
		req.body.sender,
		req.body.recipient
	);
	alexcoin.addTransactionsToPendingTransactions(newTransaction);

	const requestPromises = [];
	// Broadcast to all other nodes
	alexcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: newTransaction,
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});
	Promise.all(requestPromises).then(data => {
		res.json({ note: 'Transaction created and broadcasted successfully.' });
	});
});

app.get('/mine', function(req, res) {
	const lastBlock = alexcoin.getLastBlock();
	const previousBlockHash = lastBlock['hash'];
	const currentBlockData = {
		transactions: alexcoin.pendingTransactions,
		index: lastBlock['index'] + 1
	};
	const nonce = alexcoin.proofOfWork(previousBlockHash, currentBlockData);
	const blockHash = alexcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

	const newBlock = alexcoin.createNewBlock(nonce, previousBlockHash, blockHash);

	const requestPromises = [];
	// Broadcast newBlock
	alexcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: {
				newBlock: newBlock
			},
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises).then(data => {
		const requestOptions = {
			uri: alexcoin.currentNodeUrl + '/transaction/broadcost',
			method: 'POST',
			body: {
				amount: 12.5,
				sender: '00',
				recipient: nodeAddress
			},
			json: true
		};

		return rp(requestOptions);
	});

	res.json({
		note: 'New block mined successfully',
		block: newBlock
	});
});

app.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = alexcoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash;
	const correctIndex = lastBlock['index'] + 1 === newBlock0['index'];

	if (correctHash && correctIndex) {
		alexcoin.chain.push(newBlock);
		alexcoin.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		});
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		});
	}
});

// Register a node and broadcast it to the network
app.post('/register-and-broadcast-node', function(req, res) {
	const newNodeUrl = req.body.newNodeUrl;
	if (alexcoin.networkNodes.indexOf(newNodeUrl) == -1) {
		alexcoin.networkNodes.push(newNodeUrl);
	}

	const registerNodesPromises = [];

	alexcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/register-node',
			method: 'POST',
			body: { newNodeUrl: newNodeUrl },
			json: true
		};

		registerNodesPromises.push(rp(requestOptions));
	});

	Promise.all(registerNodesPromises)
		.then(data => {
			const bulkRegisterOptions = {
				uri: newNodeUrl + '/register-nodes-bulk',
				method: 'POST',
				body: { allNetworkNodes: [...alexcoin.networkNodes, alexcoin.currentNodeUrl] },
				json: true
			};
			return rp(bulkRegisterOptions);
		})
		.then(data => {
			res.json({ note: 'New node registered with network successfully.' });
		});
});

// Register a node with the network
app.post('/register-node', function(req, res) {
	const newNodeUrl = req.body.newNodeUrl;
	alexcoin.networkNodes.push(newNodeUrl);
	const nodeNotAlreadyPresent = alexcoin.networkNodes.indexOf(newNodeUrl) == -1;
	const notCurrentNode = alexcoin.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode) {
		bitcoin.networkNodes.push(newNodeUrl);
	}
	res.json({ note: 'New node registered successfully.' });
});

// Register multiple nodes at once into the new node
app.post('/register-nodes-bulk', function(req, res) {
	const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(networkNodeUrl => {
		const nodeNotAlreadyPresent = alexcoin.networkNodes.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = alexcoin.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode) {
			alexcoin.networkNodes.push(networkNodeUrl);
		}
	});
	res.json({ note: 'Bulk registration successful.' });
});

// Used to validate the chain
app.get('/consensus', function(req, res) {
	const requestPromises = [];
	alexcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises).then(blockchains => {
		const currentChainLength = bitcoin.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;
		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				// Reset the values if there's a longer chain
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
			}
		});
		if (!newLongestChain || (newLongestChain && !alexcoin.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not bee replaced.',
				chain: bitcoin.chain
			});
		} else {
			alexcoin.chain = newLongestChain;
			alexcoin.pendingTransactions = newPendingTransactions;
			res.json({
				note: 'This chain has been replaced',
				chain: alexcoin.chain
			});
		}
	});
});

app.get('/block/:blockHash', function(req, res) {
	// localhost:3001/block/09128301928309128, so we need to access after the block/
	const blockHash = req.params.blockHash;
	const correctBlock = alexcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});

app.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const transactionData = alexcoin.getTransAction(transactionId);
	res.json({
		transaction: transactionData.transaction,
		block: transactionData.transaction
	});
});

app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = alexcoin.getAddressData(address);
	res.json({
		addressData: addressData
	});
});

app.get('/alex-explorer', function(req, res) {
	res.sendFile('./alex-explorer/index.html', { root: __dirname });
});

app.listen(port, function() {
	console.log(`Listening on port ${port}...`);
});
