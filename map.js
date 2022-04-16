/*
 * Logic related to game bootstrapping and play mechanics. See types.ts for typings.
 */

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

function getNode(block, path) {
    return block.nodes[getNodeIndex(block, path)];
}

function newGameMap(p) {
    return { p, blocks: [], refs: [], buttons: [] };
}

function addBlockToGameMap(gameMap, parentBlock, path, q, max_r, minRadius, color, fillWithWalls, player) {
    const blockIndex = gameMap.blocks.length;
    const block = {
        q,
        minRadius,
        color,
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

function addRefToGameMap(gameMap, block, path, ref) {
    const refIndex = gameMap.refs.length;
    gameMap.refs.push(ref);
    getNode(block, path).contents = { index: refIndex, type: 'Ref' };
}

function addWallToGameMap(block, path) {
    getNode(block, path).contents = { type: 'Wall' };
}

function addButtonToGameMap(gameMap, block, path) {
    gameMap.buttons.push({ ...getNode(block, path).coordinate });
}

function moveContents(gameMap, startNode, newNode, neighborIndex, returnNeighborIndex, nodeMoveMap) {
    const { p } = gameMap;
    const { contents } = newNode;
    if (contents.type === 'Wall') {
        return 'CannotPush';
    }
    if (contents.type === 'Empty') {
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
    const { p, blocks } = gameMap;
    let blockIndex = startNode.coordinate.blockIndex;
    let { nodeIndex, returnNeighborIndex, externalNeighborIndex } = startNode.neighbors[neighborIndex];

    // TODO this needs to be a while loop to handle going up multiple levels of blocks
    if (externalNeighborIndex !== undefined) {
        const parentBlock = blocks[blockIndex];
        const { blockIndex: parentBlockIndex, nodeIndex: parentNodeIndex } = parentBlock.parentNode;
        const { neighbors, facingNeighborIndex } = blocks[parentBlockIndex].nodes[parentNodeIndex];
        blockIndex = parentBlockIndex;
        ({ nodeIndex, returnNeighborIndex, externalNeighborIndex } =
            neighbors[(facingNeighborIndex + externalNeighborIndex)]);
    }

    const newNode = blocks[blockIndex].nodes[nodeIndex];
    const result = moveContents(gameMap, startNode, newNode, neighborIndex, returnNeighborIndex, nodeMoveMap);
    if (result === 'CanPush' || result === 'Cycle') {
        return result;
    }

    // TODO also handle ref
    if (newNode.contents.type === 'Block') {
        // try entering the block
        const block = blocks[newNode.contents.index];
        const enterPath = block.minRadius === 0
            ? []
            : [(returnNeighborIndex - newNode.facingNeighborIndex + p) % p]
                .concat(new Array(block.minRadius - 1).fill(p / 2));
        const result = moveContents(gameMap, startNode, getNode(block, enterPath), neighborIndex, p / 2, nodeMoveMap);
        if (result === 'CanPush' || result === 'Cycle') {
            return result;
        }
    }

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

function isWin(gameMap) {
    const { blocks, refs, buttons } = gameMap;
    return buttons.every(({ blockIndex, nodeIndex }) => {
        const node = blocks[blockIndex].nodes[nodeIndex];
        return (node.contents.type === 'Block' && !blocks[node.contents.index].player)
            || (node.contents.type === 'Ref' && !blocks[refs[node.contents.index].blockId].player);
    });
}
