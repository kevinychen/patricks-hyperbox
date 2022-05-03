/**
 * The serialized format of a game map is similar to that of Patrick's Parabox (see
 * https://www.patricksparabox.com/custom-levels/#file-format), with some simplifications:
 *
 * - All blocks must be top-level. Nested blocks must be refs.
 * - Blocks can't have arbitrary IDs. Each ref must specify the block index, starting from 0.
 * - Width and height don't make sense in hyperbolic space. Instead, the "max_r" and "min_radius"
 *   parameters specify a block's dimensions.
 * - Similarly, x and y coordinates aren't well defined. Instead, each item specifies a
 *   "node index", which is the index of the containing node in the ordering that the nodes are
 *   generated as part of the tessellation of the parent block.
 *
 * Here's our format:
 *
 * version 1
 * #
 * Block [max_r] [min_radius] [hue] [sat] [val] [fill_with_walls] [player]
 *     Ref [node_index] [block_index] [exit_block] [orientation]
 *     Wall [node_index]
 *     Floor [node_index] [type]
 * Block ...
 */

// TODO also support facingNeighborIndex for PlayerButton

function serialize(gameMap) {
    const { blocks, refs, buttons, playerButton } = gameMap;
    let serialized = 'version 1\n#\n';
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const { max_r, minRadius, hue, sat, val, fillWithWalls, player, nodes } = blocks[blockIndex];
        serialized += `Block ${max_r} ${minRadius} ${hue} ${sat} ${val} ${fillWithWalls ? 1 : 0} ${player ? 1 : 0}\n`;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const { coordinate, contents, facingNeighborIndex } = nodes[nodeIndex];
            if (contents.type === 'Ref') {
                const { blockIndex, exitBlock } = refs[contents.index];
                serialized += `    Ref ${nodeIndex} ${blockIndex} ${exitBlock ? 1 : 0} ${facingNeighborIndex}\n`;
            } else if (contents.type === 'Wall') {
                serialized += `    Wall ${nodeIndex}\n`;
            } else if (buttons.find(b => b === coordinate)) {
                serialized += `    Floor ${nodeIndex} Button\n`;
            } else if (playerButton === coordinate) {
                serialized += `    Floor ${nodeIndex} PlayerButton\n`;
            }
        }
    }
    return serialized;
}

function deserialize(serialized) {
    const tokens = serialized.split(/\s+/);
    const gameMap = newGameMap(4);
    let index = 3;
    let currentBlockIndex = -1;
    while (index < tokens.length) {
        if (tokens[index] === 'Block') {
            addBlockToGameMap(gameMap, {
                max_r: parseFloat(tokens[index + 1]),
                minRadius: parseInt(tokens[index + 2]),
                hue: parseInt(tokens[index + 3]),
                sat: parseFloat(tokens[index + 4]),
                val: parseFloat(tokens[index + 5]),
                fillWithWalls: tokens[index + 6] !== '0',
                player: tokens[index + 7] !== '0',
            });
            index += 8;
            currentBlockIndex++;
        } else if (tokens[index] === 'Ref') {
            const nodeIndex = parseInt(tokens[index + 1]);
            const blockIndex = parseInt(tokens[index + 2]);
            const exitBlock = tokens[index + 3] !== '0';
            const facingNeighborIndex = parseInt(tokens[index + 4]);
            updateContents(gameMap, currentBlockIndex, nodeIndex, 'Ref', blockIndex);
            gameMap.refs[gameMap.refs.length - 1].exitBlock = exitBlock;
            gameMap.blocks[currentBlockIndex].nodes[nodeIndex].facingNeighborIndex = facingNeighborIndex;
            index += 5;
        } else if (tokens[index] === 'Wall') {
            const nodeIndex = parseInt(tokens[index + 1]);
            updateContents(gameMap, currentBlockIndex, nodeIndex, 'Wall');
            index += 2;
        } else if (tokens[index] === 'Floor') {
            const nodeIndex = parseInt(tokens[index + 1]);
            const type = tokens[index + 2];
            if (type === 'Button') {
                gameMap.buttons.push(gameMap.blocks[currentBlockIndex].nodes[nodeIndex].coordinate);
            } else if (type === 'PlayerButton') {
                gameMap.playerButton = gameMap.blocks[currentBlockIndex].nodes[nodeIndex].coordinate;
            }
            index += 3;
        } else {
            break;
        }
    }
    return gameMap;
}
