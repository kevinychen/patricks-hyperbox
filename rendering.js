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

    function getPolygon(center_r, center_θ, heading, transformPointFunc) {
        const points = [];
        for (let i = 0; i < p; i++) {
            const [r, θ, localHeading] = move(center_r, center_θ, R, heading + 2 * π * (i + .5) / p);
            for (let step = 0; step <= NUM_STEPS; step++) {
                points.push(equidistantProjection(...transformPointFunc(...move(
                    r, θ, S * step / NUM_STEPS, localHeading + π - π / q))));
            }
        }
        return points;
    }

    function interpolate(point, prevPoint) {
        const x = point[0] + (prevPoint[0] - point[0]) * animatingStep / NUM_ANIMATION_STEPS;
        const y = point[1] + (prevPoint[1] - point[1]) * animatingStep / NUM_ANIMATION_STEPS;
        return [x, y];
    }

    // heading is toward the first neighbor of node
    function drawNode(center_r, center_θ, heading, node, transformPointFunc) {
        const points = getPolygon(center_r, center_θ, heading, transformPointFunc);
        if (animatingStep === 0) {
            locationMap.set(node.coordinate, points);
        }
        const prevPoints = locationMap.get(node.coordinate);
        ctx.strokeStyle = 'black';
        ctx.fillStyle = node.contents.type === 'Wall' ? 'brown' : 'transparent';
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            ctx.lineTo(...interpolate(points[i], prevPoints[i]));
        }
        ctx.stroke();
        ctx.fill();

        if (node.contents.type === 'Block') {
            const points = getPolygon(center_r, center_θ, heading + 2 * π * node.facingNeighborIndex / p, transformPointFunc);
            if (animatingStep === 0) {
                locationMap.set(node.contents, points);
            }
            const prevPoints = locationMap.get(node.contents);
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                ctx.lineTo(...interpolate(points[i], prevPoints[i]));
            }
            ctx.stroke();
            ctx.fill();

            const block = gameMap.blocks[node.contents.index];
            // R_0 is the ratio of length of a square in the Beltrami-Klein projection of this block,
            // to the length of the smallest square containing the projection of the entire block.
            const R_0 = tanh((block.minRadius + .5) * D) / tanh(D / 2);
            drawBlock(block, 0, heading, (r, θ) =>
                move(center_r, center_θ, atanh(tanh(r) / R_0), θ + 2 * π * node.facingNeighborIndex / p));
        }
    }

    // heading is toward the first neighbor of node
    function drawBlock(block, nodeIndex, heading, transformPointFunc) {
        function helper(nodeIndex, r, θ, heading, prevNodeIndex) {
            const node = block.nodes[nodeIndex];
            drawNode(r, θ, heading, node, transformPointFunc);
            for (let i = 0; i < p; i++) {
                const neighbor = node.neighbors[i];
                if (!neighbor?.isMainEdge) {
                    continue;
                }
                const { nodeIndex: newNodeIndex, returnNeighborIndex: newReturnNeighborIndex } = neighbor;
                if (newNodeIndex === prevNodeIndex) {
                    continue;
                }
                const [new_r, new_θ, newHeading] = move(r, θ, D, heading + 2 * π * i / p);
                // drawLine(ctx, ...equidistantProjection(r, θ), ...equidistantProjection(new_r, new_θ), 'red');
                helper(newNodeIndex, new_r, new_θ, newHeading - 2 * π * newReturnNeighborIndex / p + π, nodeIndex);
            }
        }
        helper(nodeIndex, 0, 0, heading, -1);
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // player block 0 always faces east on the screen
    drawBlock(parentBlock, nodeIndex, -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p, (r, θ) => [r, θ]);
}
