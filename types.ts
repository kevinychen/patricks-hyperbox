/*
 * This file is for reference only. Types are not enforced in the code.
 */

interface GameMap {

    p: number;
    blocks: Block[];
    refs: Ref[];
    buttons: NodeCoordinate[];
    playerButton: NodeCoordinate;
}

interface Block {

    q: number;
    max_r: number;
    minRadius: number;
    hue: number;
    sat: number;
    val: number;
    player: boolean;
    nodes: Node[];
}

interface Ref {

    blockIndex: number;
    exitBlock: boolean;
    parentNode: NodeCoordinate;
}

interface Node {

    neighbors: (Neighbor | ExternalNeighbor)[];
    coordinate: NodeCoordinate;

    contents: { index: RefIndex, type: 'Ref' }
        | { type: 'Wall' }
        | { type: 'Empty' }
    facingNeighborIndex: number;
}

interface Neighbor {

    nodeIndex: number;
    returnNeighborIndex: number;
    isMainEdge: boolean;
}

interface ExternalNeighbor {

    externalNeighborIndex: number;
}

interface NodeCoordinate {

    blockIndex: BlockIndex;
    nodeIndex: NodeIndex;
}

type BlockIndex = number;

type RefIndex = number;

type NodeIndex = number;
