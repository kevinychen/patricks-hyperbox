
function newBlock(p, q, max_r, minRadius, fillWithWalls, player) {
    return getBoundedTessellation(p, q, max_r, minRadius)
        .map(polygon => ({
            nodes: [{
                neighbors: polygon.neighbors,
                facingNeighborIndex: 0,
                contents: fillWithWalls ? 'Wall' : 'Empty',
            }],
            player,
        }));
}

function getNode(block, path) {
    let node = block.nodes[0];
    for (let neighborIndex of path) {
        const neighbor = node.neighbors[neighborIndex];
        if (neighbor === undefined) {
            return undefined;
        }
        node = block.nodes[neighbor.nodeIndex];
    }
    return node;
}

function addBlockToGameMap(gameMap, parentBlock, path, block) {
    const blockIndex = gameMap.blocks.length;
    gameMap.blocks.push(block);
    if (parentBlock !== undefined) {
        getNode(parentBlock, path).contents = blockIndex;
    }
}

function addRefToGameMap(gameMap, parentBlock, path, ref) {
    const refIndex = gameMap.refs.length;
    gameMap.refs.push(ref);
    if (parentBlock !== undefined) {
        getNode(parentBlock, path).contents = refIndex;
    }
}

function addWallToGameMap(gameMap, parentBlock, path) {
    if (parentBlock !== undefined) {
        getNode(parentBlock, path).contents = 'Wall';
    }
}

function moveContents(gameMap, startNode, newNode, returnNeighborIndex, nodeMoveMap) {
    const { contents, contentsType } = newNode;
    if (contentsType === 'Wall') {
        return 'CannotPush';
    }
    if (contentsType === 'Floor' || contentsType === 'Empty') {
        nodeMoveMap.set(startNode, newNode);
        return 'CanPush';
    }
    if (newNode === startNode || nodeMoveMap.has(newNode)) {
        nodeMoveMap.set(startNode, newNode);
        return 'Cycle';
    }
    const pushResult = pushContents(gameMap, newNode, returnNeighborIndex + gameMap.p / 2, nodeMoveMap);
    if (pushResult === 'CanPush') {
        nodeMoveMap.set(startNode, newNode);
    }
    return pushResult;
}

function pushContents(gameMap, startNode, neighborIndex, nodeMoveMap) {
    const { nodeIndex, returnNeighborIndex, externalNeighborIndex } = startNode.neighbors[neighborIndex];

    // TODO handle external neighbor
    const newNode = gameMap.blocks[startNode.coordinate.blockIndex].nodes[nodeIndex];
    const result = moveContents(gameMap, startNode, newNode, returnNeighborIndex, nodeMoveMap);
    if (result === 'CanPush' || result === 'Cycle') {
        return result;
    }

    // TODO try entering
    // TODO try eating

    return 'CannotPush';
}

function movePlayer(gameMap, dir) {
    for (const block of gameMap.blocks) {
        if (block.player) {
            const [blockIndex, nodeIndex] = block.parent;
            const playerNode = gameMap.blocks[blockIndex].nodes[nodeIndex];
            const nodeMoveMap = new Map();
            pushContents(gameMap, playerNode, (playerNode.facingNeighborIndex + dir) % gameMap.p, nodeMoveMap);
            // TODO do something with nodeMoveMap
        }
    }
}
