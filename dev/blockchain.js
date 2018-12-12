const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];
const uuid = require('uuid/v1'); // Unique string

function Blockchain() {
	this.chain = []; // Where all blockchains are stored
	this.pendingTransactions = []; // Where the new items are waiting to be stored
	this.currentNodeUrl = currentNodeUrl;
	this.networkNodes = []; // Other nodes in the network so they are aware of each other

	this.createNewBlock(100, '0', '0'); // Gensis block, the first block of the chain
}

// Creates new block
Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
	const newBlock = {
		index: this.chain.length + 1,
		timestamp: Date.now(),
		transactions: this.pendingTransactions,
		nonce: nonce,
		hash: hash,
		previousBlockHash: previousBlockHash
	};

	this.pendingTransactions = [];
	this.chain.push(newBlock);

	return newBlock;
};

Blockchain.prototype.getLastBlock = function() {
	return this.chain[this.chain.length - 1];
};

Blockchain.prototype.createNewTransaction = function(amount, sender, recipient) {
	const newTransaction = {
		amount: amount,
		sender: sender,
		recipient: recipient,
		transactionId: uuid()
			.split('-')
			.join('')
	};

	return newTransaction;
};

Blockchain.prototype.addTransactionsToPendingTransactions = function(transactionObj) {
	this.pendingTransactions.push(transactionObj);
	return this.getLastBlock()['index'] + 1;
};

// nonce is a number, prevoiusBlockHash is a string, currentBlockData is an array
Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
	const dataString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
	const hash = sha256(dataString);
	return hash;
};

Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
	let nonce = 0;
	let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
	while (hash.substring(0, 4) != '0000') {
		nonce++;
		hash = this.hashBlock(previousBlockHash, currentBlockData, nonce); // Run code until matches
		// console.log(hash);
	}
	return nonce;
};

module.exports = Blockchain;
