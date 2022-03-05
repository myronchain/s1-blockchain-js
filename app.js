import express from 'express'
import bodyParser from 'body-parser'
import _ from 'lodash'
import rp from 'request'
import minimist from 'minimist'
import BlockChain from './blockchain.js';

const defaultPort = 3002;

let nodeDiscovery = async function (thisNode, neighborNode) {
    if (_.isEqual(thisNode, neighborNode) || _.some(neighbors, neighborNode) || neighbors.length >= 4) {
        // 如果这个节点与neighborNode相同或已经有足够的邻居，则不需要被发现
        return;
    }
    let options = {
        uri: 'http://${neighborNode.ip}:${neighborNode.port}Zapi/nodes/register',
        method: 'POST',
        body: {
            ip: thisNode.ip,
            port: thisNode.port
        },
        json: true
    };
    try {
        await rp(options);
        neighbors.push(neighborNode);
        if (neighbors.length < 4) {
            let res = await rp('http://${neighborNode.ip}:${neighborNode.port}/api/nodes/neighbors');
            let neighborOfNeighbors = JSON.parse(res)['content'];
            for (let i of neighborOfNeighbors) {
                await nodeDiscovery(thisNode, i);
            }
        }
    } catch (error) {
        console.log(error);
    }
};

// 启动 node app.js --port 3002
const listenIp = '127.0.0.1';
const argv = minimist(process.argv.slice(2));
const port = argv.port || defaultPort;
const listenPort = port;
// 实例化我们的区块链
const myChain = new BlockChain();
const bootstrapNode = {
    ip: listenIp,
    port: listenPort
};
const neighbors = [];
//实例化我们的节点
const _app = express();
// 处理body的中间件
_app.use(bodyParser.json());
_app.listen(listenPort, () => console.log('app listening on ' + listenPort));
nodeDiscovery({ip: listenIp, port: listenPort}, bootstrapNode).then(() => {
    console.log('node discovery complete, neighbors: ' + JSON.stringify(neighbors, null, 2))
});

_app.get('/api/mine', (req, res) => {
    // 挖矿
    myChain.createBlock();
    let p = new Promise((resolve) => resolve());
    for (let i of neighbors) {
        let resolveUri = 'http://' + i.ip + ':' + i.port + '/api/nodes/resolve';
        console.log("send resolve to: " + resolveUri);
        p.then(() => rp({
            uri: resolveUri,
            method: 'POST',
            json: true,
            body: {'chain': myChain}
        })).then((res) => {
            // 同步最长链
            myChain.resolveChain(JSON.parse(res.body)["chain"]);
        });
    }
    p.then(() => {
        res.send({
            message: 'A new block is mined, and conflict is resolved',
            content: myChain.lastBlock()
        });
    });
});

_app.post('/api/transactions/new', (req, res) => {
    // 产生新的transaction
    let newTransaction = _.pick(req.body, ['sender', 'receiver', 'value']);
    myChain.newTransaction(newTransaction);
    res.send({
        message: 'A new transaction is appended to the blockchain',
        content: newTransaction
    });
});

_app.get('/api/chain', (req, res) => {
    // 返回区块链
    res.send({
        message: 'This is my chain',
        content: myChain
    });
});

_app.get('/api/nodes/neighbors', (req, res) => {
    res.send({
        message: 'This is my neighbors',
        content: neighbors
    });
});

_app.post('/api/nodes/register', (req, res) => {
    // 注册节点
    let newNode = _.pick(req.body, ['ip', 'port']);
    neighbors.push(newNode);
    console.log('new node detected');
    console.log(newNode);
    res.send({
        message: 'Node ' + newNode.ip + ':' + newNode.port + ' is added to my network'
    });
});

_app.post('/api/nodes/resolve', (req, res) => {
    // 其他节点向这个端点post以解决冲突
    let chain = req.body.chain;
    if (myChain.resolveChain(chain)) {
        res.send({
            message: 'Chain resolved, your chain is longer',
            content: myChain
        });
    } else {
        res.send({
            message: 'Chain resolved, I\'11 keep my chain',
            content: myChain
        });
    }
});


