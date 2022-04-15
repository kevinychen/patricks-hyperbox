
function getNodeIndex(block, path) {
    let nodeIndex = 0;
    for (let neighborIndex of path) {
        const neighbor = block.nodes[nodeIndex].neighbors[neighborIndex];
        if (neighbor === undefined) {
            return undefined;
        }
        nodeIndex = neighbor.nodeIndex;
    }
    return nodeIndex;
}

function newGameMap(p) {
    return { p, blocks: [], refs: [] };
}

function addBlockToGameMap(gameMap, parentBlock, path, q, max_r, minRadius, fillWithWalls, player) {
    const blockIndex = gameMap.blocks.length;
    const block = {
        q,
        nodes: getBoundedTessellation(gameMap.p, q, max_r, minRadius)
            .map((polygon, i) => ({
                neighbors: polygon.neighbors,
                coordinate: { blockIndex, nodeIndex: i },
                contents: { type: fillWithWalls ? 'Wall' : 'Empty' },
                facingNeighborIndex: 0,
            })),
        parentNode: undefined,
        player,
    };
    gameMap.blocks.push(block);
    if (parentBlock !== undefined) {
        const nodeIndex = getNodeIndex(parentBlock, path);
        block.parentNode = { blockIndex: gameMap.blocks.findIndex(block => block === parentBlock), nodeIndex };
        parentBlock.nodes[nodeIndex].contents = { index: blockIndex, type: 'Block' };
    }
    return block;
}

function addRefToGameMap(gameMap, parentBlock, path, ref) {
    const refIndex = gameMap.refs.length;
    gameMap.refs.push(ref);
    if (parentBlock !== undefined) {
        getNode(parentBlock, path).contents = { index: refIndex, type: 'Ref' };
    }
}

function addWallToGameMap(gameMap, parentBlock, path) {
    if (parentBlock !== undefined) {
        getNode(parentBlock, path).contents = { type: 'Wall' };
    }
}

function moveContents(gameMap, startNode, newNode, neighborIndex, returnNeighborIndex, nodeMoveMap) {
    const { p } = gameMap;
    const { contents } = newNode;
    if (contents.type === 'Wall') {
        return 'CannotPush';
    }
    if (contents.type === 'Floor' || contents.type === 'Empty') {
        nodeMoveMap.set(startNode, [newNode, neighborIndex, returnNeighborIndex]);
        return 'CanPush';
    }
    if (newNode === startNode || nodeMoveMap.has(newNode)) {
        nodeMoveMap.set(startNode, [newNode, neighborIndex, returnNeighborIndex]);
        return 'Cycle';
    }
    const pushResult = pushContents(gameMap, newNode, (returnNeighborIndex + p / 2) % p, nodeMoveMap);
    if (pushResult === 'CanPush') {
        nodeMoveMap.set(startNode, [newNode, neighborIndex, returnNeighborIndex]);
    }
    return pushResult;
}

function pushContents(gameMap, startNode, neighborIndex, nodeMoveMap) {
    const { nodeIndex, returnNeighborIndex, externalNeighborIndex } = startNode.neighbors[neighborIndex];

    // TODO handle external neighbor
    const newNode = gameMap.blocks[startNode.coordinate.blockIndex].nodes[nodeIndex];
    const result = moveContents(gameMap, startNode, newNode, neighborIndex, returnNeighborIndex, nodeMoveMap);
    if (result === 'CanPush' || result === 'Cycle') {
        return result;
    }

    // TODO try entering
    // TODO try eating

    return 'CannotPush';
}

function movePlayer(gameMap, dir) {
    const { p, blocks } = gameMap;
    for (const block of blocks) {
        if (block.player) {
            const { blockIndex, nodeIndex } = block.parentNode;
            const playerNode = blocks[blockIndex].nodes[nodeIndex];
            const nodeMoveMap = new Map();
            pushContents(gameMap, playerNode, (playerNode.facingNeighborIndex + dir) % p, nodeMoveMap);

            const newNodes = new Map();
            nodeMoveMap.forEach(([newNode, neighborIndex, returnNeighborIndex], startNode) => {
                newNodes.set(newNode, [
                    startNode.contents,
                    (startNode.facingNeighborIndex + returnNeighborIndex - neighborIndex + p + p / 2) % p,
                ]);
                startNode.contents = { type: 'Empty' };
                startNode.facingNeighborIndex = 0;
            });
            newNodes.forEach(([contents, facingNeighborIndex], node) => {
                node.contents = contents;
                node.facingNeighborIndex = facingNeighborIndex;
                if (contents.type === 'Block') {
                    blocks[contents.index].parentNode = node.coordinate;
                }
            });
        }
    }
}
