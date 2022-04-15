const WIDTH = 1200;
const HEIGHT = 800;
const SCALE = 100;
const NUM_STEPS = 10;
const NUM_ANIMATION_STEPS = 10;

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

function render(ctx, gameMap, locationMap, animatingStep) {
    const { p, blocks } = gameMap;
    const { q, parentNode } = blocks.find(block => block.player);
    const { D, R, S } = getParameters(p, q);

    const { blockIndex, nodeIndex } = parentNode;
    const parentBlock = gameMap.blocks[blockIndex];

    function getPolygon(center_r, center_θ, heading) {
        const points = [];
        for (let i = 0; i < p; i++) {
            const [r, θ, localHeading] = move(center_r, center_θ, R, heading + 2 * π * (i + .5) / p);
            for (let step = 0; step <= NUM_STEPS; step++) {
                points.push(equidistantProjection(...move(r, θ, S * step / NUM_STEPS, localHeading + π - π / q)));
            }
        }
        return points;
    }

    function interpolate(point, prevPoint) {
        const x = point[0] + (prevPoint[0] - point[0]) * animatingStep / NUM_ANIMATION_STEPS;
        const y = point[1] + (prevPoint[1] - point[1]) * animatingStep / NUM_ANIMATION_STEPS;
        return [x, y];
    }

    function drawNode(center_r, center_θ, heading, node) {
        const points = getPolygon(center_r, center_θ, heading);
        if (animatingStep === 0) {
            locationMap.set(node.coordinate, points);
        }
        const prevPoints = locationMap.get(node.coordinate);
        ctx.strokeStyle = 'black';
        ctx.fillStyle = 'transparent';
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            ctx.lineTo(...interpolate(points[i], prevPoints[i]));
        }
        ctx.stroke();
        ctx.fill();

        if (node.contents.type === 'Block') {
            const points = getPolygon(center_r, center_θ, heading + 2 * π * node.facingNeighborIndex / p);
            if (animatingStep === 0) {
                locationMap.set(node.contents, points);
            }
            const prevPoints = locationMap.get(node.contents);
            ctx.fillStyle = 'brown';
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                ctx.lineTo(...interpolate(points[i], prevPoints[i]));
            }
            ctx.stroke();
            ctx.fill();
        }
    }

    function helper(nodeIndex, r, θ, heading, returnNeighborIndex, prevNodeIndex) {
        const node = parentBlock.nodes[nodeIndex];
        drawNode(r, θ, heading - 2 * π * returnNeighborIndex / p, node);
        for (let i = 0; i < p; i++) {
            const neighbor = node.neighbors[i];
            if (neighbor?.isMainEdge) {
                const { nodeIndex: newNodeIndex, returnNeighborIndex: newReturnNeighborIndex } = neighbor;
                if (newNodeIndex !== prevNodeIndex) {
                    const [new_r, new_θ, newHeading] = move(r, θ, D, heading + 2 * π * (i - returnNeighborIndex) / p);
                    drawLine(ctx, ...equidistantProjection(r, θ), ...equidistantProjection(new_r, new_θ), 'red');
                    helper(newNodeIndex, new_r, new_θ, newHeading + π, newReturnNeighborIndex, nodeIndex);
                }
            }
        }
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    helper(nodeIndex, 0, 0, -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p, p);
}
