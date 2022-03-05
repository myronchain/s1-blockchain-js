import crypto from 'crypto'
import fs from 'fs'

//定义一个class，叫BlockChain，每一个区块链都是这个class的实例
export default class BlockChain {
    constructor() {
        this.chain = []; // 储存所有区块
        this.difficulty = 4; // 挖矿的难度
        this.chain.push(this.getGenesisBlock()); // 创世区块
        this._packTransactions = []; // 当前需要打包的数据
    }

    getGenesisBlock() {
        const data = fs.readFileSync('./genesis_block.json', 'utf8');
        return JSON.parse(data)
    }

    isProofValid(tentativeBlock) {
        // 这里我们判断newProof是不是一个合法的proof的方法是
        // 将整个区块进行哈希
        // 如果得到的散列值指的最后n位都是0，那么这是一个valid proof
        // 其中，n = difficulty
        const result = this.constructor.hash(tentativeBlock);
        return result.substr(result.length - this.difficulty) === '0'.repeat(this.difficulty);
    }

    mineProof(tentativeBlock) {
        console.log("miner block start: " + JSON.stringify(tentativeBlock));
        while (!this.isProofValid(tentativeBlock)) {
            tentativeBlock.proof += 1; // 如果不是可用的proof，我们就接着枚举
        }
        const hash = this.constructor.hash(tentativeBlock);
        console.log("miner block success. Hash: " + hash);
        return hash;
    }

    miner() {
        // 挖矿程序
        if (this._packTransactions.length > 0) {
            const hash = this.createBlock([this._packTransactions[this._packTransactions.length - 1]]);
            if (hash) {
                this._packTransactions.pop();
                return hash
            }
        }
    }

    createBlock(transaction, previousHash = undefined) {
        // 创造一个新区块
        // 一开始的proof是0，不一定是有效的，所以我们需要mineProof来找到有效的proof
        let block = {
            timestamp: Date.now(),
            id: this.chain.length,
            proof: 0,
            previousBlockHash: previousHash || this.constructor.hash(this.lastBlock()),
            transactions: transaction
        };
        const hash = this.mineProof(block);
        this.chain.push(block);
        return hash;
    }

    createTransaction(sender, receiver, value) {
        // 创建一个交易
        // 根据提供的sender, receiver地址，以及转账的价值，建立一个交易
        // 并把它加入到我们的区块链里
        const transaction = {
            sender: sender,
            receiver: receiver,
            value: value
        };
        this._packTransactions.push(transaction);
        return this.miner();
    }

    newTransaction(transaction) {
        // 创建一个交易
        // 根据提供的sender, receiver地址，以及转账的价值，建立一个交易
        // 并把它加入到我们的区块链里
        this._packTransactions.push(transaction);
        return this.miner();
    }

    static hash(block) {
        // 对一个区块进行哈希:
        // 现将block 转换成base64
        // 将得到的结果进行SHA哈希
        const blockStr = JSON.stringify(block);
        const blockB64 = new Buffer(blockStr).toString("base64");
        const newHash = crypto.createHash("sha256");
        newHash.update(blockB64);
        return newHash.digest("hex");
    }

    resolveChain(chain) {
        // 如果传入的chain是有效的且它的长度比自己长，那么我们将替换我们现在的链, 并返回true
        // 否则返回false
        chain = chain.chain;
        if (!chain.length || chain.length <= this.chain.length) {
            return false;
        }
        for (let i = 1; i < chain.length; i++) {
            if (this.constructor.hash(chain[i - 1]) !== chain[i].previousBlockHash || this.isProofValid(chain[i - 1]) === false) {
                return false;
            }
        }
        if (this.isProofValid(chain[chain.length - 1])) {
            this.chain = chain;
            return true;
        }
        return false;
    }

    lastBlock() {
        // 取得链上的最后一个区块
        return this.chain[this.chain.length - 1];
    }

}

function testChain() {
    // 创建区块链对象
    const b = new BlockChain();
    let hash;
    // 提交事务
    hash = b.createTransaction("0xfF171DDfB3236940297808345f7e32C4b5BF097f", "0xF5054F94009B7E9999F6459f40d8EaB1A2ceA22D", "1000");
    console.log(hash);
    hash = b.createTransaction("0xfF171DDfB3236940297808345f7e32C4b5BF097f", "0xF5054F94009B7E9999F6459f40d8EaB1A2ceA22D", "3000");
    console.log(hash);
    hash = b.createTransaction("0xF5054F94009B7E9999F6459f40d8EaB1A2ceA22D", "0xfF171DDfB3236940297808345f7e32C4b5BF097f", "5000");
    console.log(hash);
    // 输出整条链信息
    console.log("\nBlockChain content:");
    console.log(JSON.stringify(b, null, 4));
}
