/**
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
        if (this.down.length === 0 && this.up[0] === coordinate) {
            return new TreePath(this.up.slice(1), this.down);
        } else {
            return new TreePath(this.up, [...this.down, coordinate]);
        }
    }

    /**
     * @param {number} nodeKey
     * @returns {number}
     */
    hash(nodeKey) {
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
        hash1 = Math.imul(hash1, 89726) + nodeKey + 1;
        hash2 = Math.imul(hash2, 76493) + nodeKey + 1;
        return hash1 % 0x1000000 * 0x1000000 + hash2 % 0x1000000 + 4;
    }
}

/**
 * A node in the rendered tree.
 * The parent is a 2-element array [coordinate of node, parent node].
 * children is a map from the child's coordinate to that child node.
 * polygons is a map from the node key (an identifier that must be distinct within each node) to a Polygon object.
 */
class TreeNode {
    constructor() {
        this.parent = undefined;
        this.children = new Map();
        this.polygons = new Map();
    }

    /**
     * @param {TreePath} treePath
     * @returns {[TreeNode, TreeNode, NodeCoordinate]?} This node, the new parent node, and the new coordinate
     * if this node can be moved by the given tree path.
     */
    tryMove(treePath) {
        let node = this;
        for (let i = treePath.up.length - 1; i >= 0; i--) {
            if (node.parent !== undefined && node.parent[0] === treePath.up[i]) {
                node = node.parent[1];
            } else {
                return undefined;
            }
        }
        for (let i = 0; i < treePath.down.length - 1; i++) {
            if (node.children.has(treePath.down[i])) {
                node = node.children.get(treePath.down[i]);
            } else {
                return undefined;
            }
        }
        const lastUp = treePath.up[treePath.up.length - 1];
        const lastDown = treePath.down[treePath.down.length - 1];
        this.parent[1].children.delete(lastUp);
        return [this, node, lastDown];
    }

    getPolygons() {
        const polygons = [];
        this._recurse(undefined, TreePath.empty(), (node, treePath) => node.polygons.forEach((polygon, nodeKey) => {
            polygons.push({
                ...polygon,
                animationKey: treePath.hash(nodeKey),
            });
        }));
        return polygons.sort(({ depth: depth1 }, { depth: depth2 }) => depth1 - depth2);
    }

    /**
     * @param {TreePath[]} moves
     */
    executeMoves(moves) {
        const renderTreeChanges = [];
        this._getRoot()._recurse(undefined, TreePath.empty(), node => {
            for (const move of moves) {
                const link = node.tryMove(move);
                if (link !== undefined) {
                    renderTreeChanges.push(link);
                    break;
                }
            }
        });
        for (const [node, newParent, coordinate] of renderTreeChanges) {
            node.parent = [coordinate, newParent];
            newParent.children.set(coordinate, node);
        }
    }

    _getRoot() {
        return this.parent === undefined ? this : this.parent[1]._getRoot();
    }

    _recurse(prev, treePath, func) {
        if (this.parent !== undefined && this.parent[1] !== prev) {
            this.parent[1]._recurse(this, treePath.moveUp(this.parent[0]), func);
        }
        this.children.forEach((child, coordinate) => {
            if (child !== prev) {
                child._recurse(this, treePath.moveDown(coordinate), func);
            }
        });
        func(this, treePath);
    }
}
