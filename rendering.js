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

    function interpolate(point, prevPoint) {
        const x = point[0] + (prevPoint[0] - point[0]) * animatingStep / NUM_ANIMATION_STEPS;
        const y = point[1] + (prevPoint[1] - point[1]) * animatingStep / NUM_ANIMATION_STEPS;
        return [x, y];
    }

    // heading is toward the first neighbor of node
    function drawBlock(block, nodeIndex, heading, transformPointFunc) {
        const { q, nodes } = block;
        const { D, R, S } = getParameters(p, q);

        function getPolygon(center_r, center_θ, heading) {
            const points = [];
            for (let i = 0; i < p; i++) {
                const [r, θ, localHeading] = move(center_r, center_θ, R, heading + 2 * π * (i + .5) / p);
                for (let step = 0; step <= NUM_STEPS; step++) {
                    points.push(equidistantProjection(...transformPointFunc(
                        ...move(r, θ, S * step / NUM_STEPS, localHeading + π - π / q))));
                }
            }
            return points;
        }

        // heading is toward the first neighbor of node
        function drawNode(center_r, center_θ, heading, node) {
            const points = getPolygon(center_r, center_θ, heading);
            if (animatingStep === 0) {
                locationMap.set(node.coordinate, points);
            }
            const prevPoints = locationMap.get(node.coordinate);
            ctx.strokeStyle = block.color;
            ctx.fillStyle = node.contents.type === 'Wall' ? block.color : 'transparent';
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                ctx.lineTo(...interpolate(points[i], prevPoints[i]));
            }
            ctx.stroke();
            ctx.fill();

            if (node.contents.type === 'Block') {
                const block = blocks[node.contents.index];
                // R_0 is the ratio of length of a square in the Beltrami-Klein projection of this block,
                // to the length of the smallest square containing the projection of the entire block.
                const R_0 = tanh((block.minRadius + .5) * D) / tanh(D / 2);
                drawBlock(block, 0, heading, (r, θ) => transformPointFunc(
                    ...move(center_r, center_θ, atanh(tanh(r) / R_0), θ + 2 * π * node.facingNeighborIndex / p)));
            }
        }

        function helper(nodeIndex, r, θ, heading, prevNodeIndex) {
            drawNode(r, θ, heading, nodes[nodeIndex]);
            for (let i = 0; i < p; i++) {
                const neighbor = nodes[nodeIndex].neighbors[i];
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

    const { blockIndex, nodeIndex } = blocks.find(block => block.player).parentNode;
    const parentBlock = blocks[blockIndex];

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // player block 0 always faces east on the screen
    drawBlock(parentBlock, nodeIndex, -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p, (r, θ) => [r, θ]);
}
