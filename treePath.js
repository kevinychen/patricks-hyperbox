/*
 * The nodes of the map can be thought of as a rooted tree, with each child node "contained" in its parent.
 * The root is the outer-most block that's rendered.
 *
 * In this model, there is a single path from any node to any other node.
 * This path consists of zero or more "up"-ward movements, then zero or more "down"-ward movements.
 * Both lists of movements are ordered from the top of the tree to the bottom.
 * For example, in the following tree, the path from C to D is {up: [B, C], down: [D]}.
 *
 *     A
 *    / \
 *   B   D
 *  /
 * C
 */

/**
 * @param {NodeCoordinate} coordinate1
 * @param {NodeCoordinate} coordinate2
 * @returns {boolean}
 */
// TODO is this still needed? Shouldn't there be at most one of any node coordinate?
function sameCoordinate(coordinate1, coordinate2) {
    return coordinate1 !== undefined && coordinate2 !== undefined
        && coordinate1.blockIndex === coordinate2.blockIndex && coordinate1.nodeIndex === coordinate2.nodeIndex;
}

class TreePath {
    /**
     * @param {NodeCoordinate[]} up
     * @param {NodeCoordinate[]} down
     */
    constructor(up, down) {
        this.up = up;
        this.down = down;
    }

    static empty() {
        return new TreePath([], []);
    }

    /**
     * @param {NodeCoordinate} coordinate
     * @returns {TreePath}
     */
    moveUp(coordinate) {
        if (this.down.length > 0) {
            return new TreePath(this.up, this.down.slice(0, -1));
        } else {
            return new TreePath([coordinate, ...this.up], this.down);
        }
    }

    /**
     * @param {NodeCoordinate} coordinate
     * @returns {TreePath}
     */
    moveDown(coordinate) {
        if (this.down.length === 0 && sameCoordinate(this.up[0], coordinate)) {
            return new TreePath(this.up.slice(1), this.down);
        } else {
            return new TreePath(this.up, [...this.down, coordinate]);
        }
    }

    /**
     * @param {TreePath} otherTreePath
     * @returns {TreePath}
     */
    concat(otherTreePath) {
        let newTreePath = this;
        for (let i = otherTreePath.up.length - 1; i >= 0; i--) {
            newTreePath = newTreePath.moveUp(otherTreePath.up[i]);
        }
        for (let i = 0; i < otherTreePath.down.length; i++) {
            newTreePath = newTreePath.moveDown(otherTreePath.down[i]);
        }
        return newTreePath;
    }

    /**
     * @returns {TreePath}
     */
    reverse() {
        return new TreePath(this.down, this.up);
    }

    /**
     * @param {number} extraValue
     * @returns {number}
     */
    hash(extraValue) {
        let hash1 = 0, hash2 = 0;
        for (const { blockIndex, nodeIndex } of this.up) {
            hash1 = Math.imul(hash1, 10185) + blockIndex + 1;
            hash1 = Math.imul(hash2, 74064) + nodeIndex + 1;
            hash2 = Math.imul(hash1, 48299) + blockIndex + 1;
            hash2 = Math.imul(hash2, 63014) + nodeIndex + 1;
        }
        for (const { blockIndex, nodeIndex } of this.down) {
            hash1 = Math.imul(hash1, 35483) + blockIndex + 1;
            hash1 = Math.imul(hash2, 64871) + nodeIndex + 1;
            hash2 = Math.imul(hash1, 13027) + blockIndex + 1;
            hash2 = Math.imul(hash2, 12735) + nodeIndex + 1;
        }
        hash1 = Math.imul(hash1, 89726) + extraValue + 1;
        hash2 = Math.imul(hash2, 76493) + extraValue + 1;
        return hash1 % 0x1000000 * 0x1000000 + hash2 % 0x1000000 + 4;
    }
}
