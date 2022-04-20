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
 *     Ref [node_index] [block_index] [exit_block]
 *     Wall [node_index]
 *     Floor [node_index] [type]
 * Block ...
 */

// TODO also support facingNeighborIndex for refs and PlayerButton

function serialize(gameMap) {
    const { blocks, refs, buttons, playerButton } = gameMap;
    let serialized = 'version 1\n#\n';
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const { max_r, minRadius, hue, sat, val, fillWithWalls, player, nodes } = blocks[blockIndex];
        serialized += `Block ${max_r} ${minRadius} ${hue} ${sat} ${val} ${fillWithWalls ? 1 : 0} ${player ? 1 : 0}\n`;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            const { contents } = nodes[nodeIndex];
            if (contents.type === 'Ref') {
                const { blockIndex, exitBlock } = refs[contents.index];
                serialized += `    Ref ${nodeIndex} ${blockIndex} ${exitBlock ? 1 : 0}\n`;
            } else if (contents.type === 'Wall') {
                serialized += `    Wall ${nodeIndex}\n`;
            } else if (buttons.find(b => sameCoordinate({ blockIndex, nodeIndex }, b))) {
                serialized += `    Floor ${nodeIndex} Button\n`;
            } else if (playerButton !== undefined && sameCoordinate({ blockIndex, nodeIndex }, playerButton)) {
                serialized += `    Floor ${nodeIndex} PlayerButton\n`;
            }
        }
    }
    return serialized;
}

function deserialize(serialized) {
    // TODO
}
