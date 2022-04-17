
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
    nodes: Node[];
    parentNode: NodeCoordinate;
    player: boolean;
}

interface Ref {

    blockId: number;
    exitBlock: boolean;
}

interface Node {

    neighbors: (Neighbor | ExternalNeighbor)[];
    coordinate: NodeCoordinate;

    contents: { index: BlockIndex, type: 'Block' }
        | { index: RefIndex, type: 'Ref' }
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
