/*
 * Logic related to game bootstrapping and play mechanics. See types.ts for typings.
 */

function sameCoordinate(coordinate1, coordinate2) {
    return coordinate1.blockIndex === coordinate2.blockIndex && coordinate1.nodeIndex === coordinate2.nodeIndex;
}

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

function addBlockToGameMap(gameMap, properties) {
    const { q = 5, max_r = 1, minRadius = 0, hue = 120, sat = 1, val = .5, fillWithWalls = false, player = false } = properties;
    const block = {};
    gameMap.blocks.push(block);
    updateBlockInGameMap(gameMap, block, { q, max_r, minRadius, hue, sat, val, fillWithWalls, player });
    return block;
}

function updateBlockInGameMap(gameMap, block, newProperties) {
    const { p, blocks } = gameMap;
    const { q, max_r, minRadius, hue, sat, val, fillWithWalls, player } = newProperties;
    const blockIndex = blocks.findIndex(b => b === block);
    if (q !== undefined) { block.q = q }
    if (max_r !== undefined) { block.max_r = max_r }
    if (minRadius !== undefined) { block.minRadius = minRadius }
    if (hue !== undefined) { block.hue = hue }
    if (sat !== undefined) { block.sat = sat }
    if (val !== undefined) { block.val = val }
    if (fillWithWalls !== undefined) { block.fillWithWalls = fillWithWalls }
    if (player !== undefined) { block.player = player }
    if (q !== undefined || max_r !== undefined || minRadius !== undefined || fillWithWalls !== undefined) {
        // TODO delete block refs and button refs in old block.nodes,
        // and even better: keep existing nodes if their path is still present in the new block
        block.nodes = getBoundedTessellation(p, block.q, block.max_r, block.minRadius)
            .map((polygon, i) => ({
                neighbors: polygon.neighbors,
                coordinate: { blockIndex, nodeIndex: i },
                contents: { type: block.fillWithWalls ? 'Wall' : 'Empty' },
                facingNeighborIndex: 0,
            }));
    }
}

function updateContents(gameMap, blockIndex, nodeIndex, type, childBlock) {
    const { blocks, refs, buttons, playerButton } = gameMap;
    const node = blocks[blockIndex].nodes[nodeIndex];

    // Delete whatever is currently in the node
    if (node.contents.type === 'Ref') {
        const lastRef = refs.pop();
        if (node.contents.index < refs.length) {
            const { blockIndex, nodeIndex } = lastRef.parentNode;
            refs[node.contents.index] = lastRef;
            blocks[blockIndex].nodes[nodeIndex].contents.index = node.contents.index;
        }
    }
    const buttonIndex = buttons.findIndex(b => sameCoordinate(node.coordinate, b));
    if (buttonIndex >= 0) {
        buttons.splice(buttonIndex, 1);
    }
    if (playerButton !== undefined && sameCoordinate(node.coordinate, playerButton)) {
        playerButton = undefined;
    }

    // Add the new contents
    if (type === 'Ref') {
        const refIndex = refs.length;
        const ref = {
            blockIndex: blocks.findIndex(block => block === childBlock),
            parentNode: node.coordinate,
            exitBlock: true,
        };
        refs.push(ref);
        node.contents = { index: refIndex, type: 'Ref' };
    } else if (type === 'Wall') {
        node.contents = { type: 'Wall' };
    } else if (type === 'Button') {
        node.contents = { type: 'Empty' };
        // TODO animations depend on this being a clone, not the same object (ditto for PlayerButton below)
        buttons.push({ ...node.coordinate });
    } else if (type === 'PlayerButton') {
        node.contents = { type: 'Empty' };
        gameMap.playerButton = { ...node.coordinate };
    } else {
        node.contents = { type: 'Empty' };
    }
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
    const { p, blocks, refs } = gameMap;

    if (startNode.neighbors[neighborIndex] === undefined) {
        return 'CannotPush';
    }

    // TODO this needs to be a while loop to handle going up multiple levels of blocks
    let blockIndex = startNode.coordinate.blockIndex;
    let { nodeIndex, returnNeighborIndex, externalNeighborIndex } = startNode.neighbors[neighborIndex];
    if (externalNeighborIndex !== undefined) {
        const parentRef = refs.find(ref => ref.blockIndex === blockIndex && ref.exitBlock);
        const { blockIndex: parentBlockIndex, nodeIndex: parentNodeIndex } = parentRef.parentNode;
        const { neighbors, facingNeighborIndex } = blocks[parentBlockIndex].nodes[parentNodeIndex];
        blockIndex = parentBlockIndex;
        ({ nodeIndex, returnNeighborIndex, externalNeighborIndex } =
            neighbors[(facingNeighborIndex + externalNeighborIndex) % p]);
    }

    const newNode = blocks[blockIndex].nodes[nodeIndex];
    const result = moveContents(gameMap, startNode, newNode, neighborIndex, returnNeighborIndex, nodeMoveMap);
    if (result === 'CanPush' || result === 'Cycle') {
        return result;
    }

    if (newNode.contents.type === 'Ref') {
        // try entering the new block
        const block = blocks[refs[newNode.contents.index].blockIndex];
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
    const { p, blocks, refs } = gameMap;
    for (const ref of refs) {
        if (blocks[ref.blockIndex].player) {
            const { blockIndex, nodeIndex } = ref.parentNode;
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
                if (contents.type === 'Ref') {
                    refs[contents.index].parentNode = node.coordinate;
                }
            });
        }
    }
}

function isWin(gameMap) {
    const { blocks, refs, buttons, playerButton } = gameMap;
    if (playerButton === undefined) {
        return false;
    }
    const { blockIndex, nodeIndex } = playerButton;
    const node = blocks[blockIndex].nodes[nodeIndex];
    return (node.contents.type === 'Ref' && blocks[refs[node.contents.index].blockIndex].player)
        && buttons.every(({ blockIndex, nodeIndex }) => {
            const node = blocks[blockIndex].nodes[nodeIndex];
            return node.contents.type === 'Ref' && !blocks[refs[node.contents.index].blockIndex].player;
        });
}
