const WIDTH = 1200;
const HEIGHT = 800;
const SCALE = 100;
const NUM_STEPS = 10;

function equidistantProjection(r, θ) {
    return [WIDTH / 2 + SCALE * r * cos(θ), HEIGHT / 2 - SCALE * r * sin(θ)];
}

function beltramiKleinProjection(r, θ) {
    return [WIDTH / 2 + HEIGHT / 2 * tanh(r) * cos(θ), HEIGHT / 2 - HEIGHT / 2 * tanh(r) * sin(θ)];
}

function drawLine(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function render(ctx, gameMap) {
    const { p, blocks } = gameMap;
    const { q, parent } = blocks.find(block => block.player);
    const { D, R, S } = getParameters(p, q);

    const [blockIndex, nodeIndex] = parent;
    const parentBlock = gameMap.blocks[blockIndex];

    function drawPolygon(center_r, center_θ, heading, contents, contentsType) {
        ctx.strokeStyle = 'black';
        ctx.fillStyle = { Block: 'brown', Empty: 'transparent' }[contentsType];
        ctx.beginPath();
        for (let i = 0; i < p; i++) {
            const [r, θ, localHeading] = move(center_r, center_θ, R, heading + 2 * π * (i + .5) / p);
            for (let step = 0; step <= NUM_STEPS; step++) {
                ctx.lineTo(...equidistantProjection(...move(r, θ, S * step / NUM_STEPS, localHeading + π - π / q)));
            }
        }
        ctx.stroke();
        ctx.fill();
    }

    function helper(nodeIndex, r, θ, heading, returnNeighborIndex, prevNodeIndex) {
        const { neighbors, contents, contentsType } = parentBlock.nodes[nodeIndex];
        drawPolygon(r, θ, heading, contents, contentsType);
        for (let i = 0; i < p; i++) {
            if (neighbors[i]?.isMainEdge) {
                const { nodeIndex: newNodeIndex, returnNeighborIndex: newReturnNeighborIndex } = neighbors[i];
                if (newNodeIndex !== prevNodeIndex) {
                    const [new_r, new_θ, newHeading] = move(r, θ, D, heading + 2 * π * (i - returnNeighborIndex) / P);
                    drawLine(ctx, ...equidistantProjection(r, θ), ...equidistantProjection(new_r, new_θ), 'red');
                    helper(newNodeIndex, new_r, new_θ, newHeading + π, newReturnNeighborIndex, nodeIndex);
                }
            }
        }
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    helper(nodeIndex, 0, 0, 0, p);
}
