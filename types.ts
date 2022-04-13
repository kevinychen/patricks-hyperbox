
interface GameMap {

    p: number;
    blocks: Block[];
    refs: Ref[];
}

interface Block {

    nodes: Node[];
    parent: [BlockIndex, NodeIndex];
    player: boolean;
}

interface Ref {

    blockId: number;
    exitBlock: boolean;
}

interface Node {

    neighbors: (Neighbor | ExternalNeighbor)[];
    coordinate: [BlockIndex, NodeIndex];

    contents: BlockIndex | RefIndex | Floor | {};
    contentsType: 'Block' | 'Ref' | 'Wall' | 'Floor' | 'Empty';
    facingNeighborIndex: number;
}

interface Neighbor {

    nodeIndex: number;
    returnNeighborIndex: number;
}

interface ExternalNeighbor {

    externalNeighborIndex: number;
}

type BlockIndex = number;

type RefIndex = number;

type NodeIndex = number;

interface Floor {

    type: 'Button' | 'PlayerButton',
}
