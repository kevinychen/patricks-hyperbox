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

function render(ctx, gameMap, locationMap, animatingStep, currDir) {
    const { p, blocks } = gameMap;

    function animate(key, points) {
        if (animatingStep === 0) {
            locationMap.set(key, points);
        }
        const prevPoints = locationMap.get(key) || points;
        const interpolatedPoints = [];
        for (let i = 0; i < points.length; i++) {
            interpolatedPoints.push([
                points[i][0] + (prevPoints[i][0] - points[i][0]) * animatingStep / NUM_ANIMATION_STEPS,
                points[i][1] + (prevPoints[i][1] - points[i][1]) * animatingStep / NUM_ANIMATION_STEPS,
            ]);
        }
        return interpolatedPoints;
    }

    const polygons = [];
    const processedBlocks = new Set();

    // heading is toward the first neighbor of node
    function processBlock(block, nodeIndex, heading, transformPointFunc) {
        const { q, nodes } = block;
        const { D, S } = getParameters(p, q);

        let centerPosition = undefined;

        if (processedBlocks.has(block)) {
            return;
        }
        processedBlocks.add(block);

        function getPolygon(center_r, center_θ, heading) {
            const points = [];
            for (let i = 0; i < p; i++) {
                const [r, θ, localHeading] = move(center_r, center_θ, D / 2, heading + 2 * π * i / p);

                const sideIsFar = transformPointFunc(r, θ)[0] > 10;
                const cornerIsFar = transformPointFunc(...move(r, θ, S / 2, localHeading + π / 2))[0] > 10;
                for (let step = -NUM_STEPS / 2; step <= NUM_STEPS / 2; step++) {
                    let d = S * Math.abs(step / NUM_STEPS);
                    if (sideIsFar) {
                        d = 0;
                    }
                    // render more points near the valid parts, for a better interpolated curve
                    else if (cornerIsFar) {
                        d /= 7;
                    }
                    points.push(equidistantProjection(
                        ...transformPointFunc(...move(r, θ, d, localHeading + π / 2 * Math.sign(step)))));
                }
            }
            return points;
        }

        function getPlayerEye(center_r, center_θ, heading, whichEye) {
            const eyeAngle = π / 2 + .41 * π * whichEye;
            let [r, θ, localHeading] = move(center_r, center_θ, .3 * D, heading + eyeAngle);
            if (currDir !== undefined) {
                [r, θ, localHeading] = move(r, θ, .07 * D, localHeading - eyeAngle + currDir * π / 2);
            }
            const points = [];
            for (let i = 0; i < NUM_STEPS; i++) {
                points.push(equidistantProjection(
                    ...transformPointFunc(...move(r, θ, .09 * D, 2 * π * i / NUM_STEPS))));
            }
            return points;
        }

        // heading is toward the first neighbor of node
        function processNode(center_r, center_θ, heading, node) {
            polygons.push({
                points: animate(node.coordinate, getPolygon(center_r, center_θ, heading)),
                strokeStyle: block.color,
                fillStyle: node.contents.type === 'Wall' ? block.color : 'transparent',
            });

            if (node.contents.type === 'Block') {
                const block = blocks[node.contents.index];
                const headingAdjustment = 2 * π * node.facingNeighborIndex / p;
                // R_0 is the ratio of length of a square in the Beltrami-Klein projection of this block,
                // to the length of the smallest square containing the projection of the entire block.
                const R_0 = tanh((block.minRadius + .5) * D) / tanh(D / 2);
                processBlock(block, 0, heading, (r, θ) => transformPointFunc(
                    ...move(center_r, center_θ, atanh(tanh(r) / R_0), θ + headingAdjustment)));
                if (block.player) {
                    for (const whichEye of [-1, 1]) {
                        polygons.push({
                            points: getPlayerEye(center_r, center_θ, heading + headingAdjustment, whichEye, 0),
                            strokeStyle: 'black',
                            fillStyle: 'black',
                        });
                    }
                }
            }
        }

        function helper(nodeIndex, r, θ, heading, prevNodeIndex) {
            if (nodeIndex === 0) {
                centerPosition = [r, θ, heading];
            }
            processNode(r, θ, heading, nodes[nodeIndex]);
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
                helper(newNodeIndex, new_r, new_θ, newHeading - 2 * π * newReturnNeighborIndex / p + π, nodeIndex);
            }
        }
        helper(nodeIndex, 0, 0, heading, -1);
        return centerPosition;
    }

    const { blockIndex, nodeIndex } = blocks.find(block => block.player).parentNode;
    const parentBlock = blocks[blockIndex];

    // player block 0 always faces east on the screen
    const [center_r, center_θ, centerHeading] = processBlock(
        parentBlock, nodeIndex, -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p, (r, θ) => [r, θ]);

    if (parentBlock.parentNode !== undefined) {
        // TODO this might require taking an arbitrarily high ancestor block
        const { blockIndex, nodeIndex } = parentBlock.parentNode;
        const grandparentBlock = blocks[blockIndex];
        const { D } = getParameters(p, parentBlock.q);
        const R_0 = tanh((parentBlock.minRadius + .5) * D) / tanh(D / 2);
        processBlock(grandparentBlock, nodeIndex, -2 * π * grandparentBlock.nodes[nodeIndex].facingNeighborIndex / p,
            (r, θ) => move(center_r, center_θ, atanh(Math.min(R_0 * tanh(r), 1 - ɛ)), centerHeading + θ));
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const { points, strokeStyle, fillStyle } of polygons) {
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        for (const [x, y] of points) {
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fill();
    }
}
