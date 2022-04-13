
interface GameMap {

    items: Item[];
}

interface Block {

    path: string;
    id: string;

    max_r: number;
    minRadius: number;

    hue: number;
    sat: number;
    val: number;

    fillWithWalls: boolean;
    player: boolean;

    items: Item[];
}

interface Ref {

    path: string;
    id: string;

    exitBlock: boolean;
}

interface Wall {

    path: string;
}

interface Floor {

    path: string;
    type: 'Button' | 'PlayerButton';
}

type Item = Block | Ref | Wall | Floor;
