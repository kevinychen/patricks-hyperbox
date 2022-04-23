const WIDTH = 1200;
const HEIGHT = 800;
const SCALE = 100;
const NUM_STEPS = 20;
const NUM_ANIMATION_STEPS = 5;
const VOID_COLOR = 'rgb(70,70,70)';

function equidistantProjection(r, θ) {
    return [WIDTH / 2 + SCALE * r * cos(θ), HEIGHT / 2 - SCALE * r * sin(θ)];
}

function beltramiKleinProjection(r, θ) {
    return [WIDTH / 2 + HEIGHT / 2 * tanh(r) * cos(θ), HEIGHT / 2 - HEIGHT / 2 * tanh(r) * sin(θ)];
}

function getPolygons(gameMap, locationMap, animatingStep, currDir, startBlockIndex) {
    const { p, blocks, refs, buttons, playerButton } = gameMap;

    function animate(key, points) {
        if (animatingStep === 0) {
            locationMap.set(key, points);
            return points;
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
    const processedBlocks = new Map();

    // heading is toward the first neighbor of node
    function processBlock(block, nodeIndex, heading, depth, transformPointFunc) {
        const { q, hue, sat, val, nodes } = block;
        const { D, S } = getParameters(p, q);

        let centerPosition = undefined;

        // TODO this isn't correct, only return early if we're rendering the same ref
        if (processedBlocks.has(block)) {
            return processedBlocks.get(block);
        }
        processedBlocks.set(block, []);

        function getPolygon(center_r, center_θ, heading, scale = 1) {
            const points = [];
            for (let i = 0; i < p; i++) {
                const [r, θ, localHeading] = move(center_r, center_θ, scale * D / 2, heading + 2 * π * i / p);

                const sideIsFar = transformPointFunc(r, θ)[0] > 10;
                const cornerIsFar = transformPointFunc(...move(r, θ, scale * S / 2, localHeading + π / 2))[0] > 10;
                for (let step = -NUM_STEPS / 2; step <= NUM_STEPS / 2; step++) {
                    let d = scale * S * Math.abs(step / NUM_STEPS);
                    if (sideIsFar) {
                        d = 0;
                    }
                    // render more points near the valid parts, for a better interpolated curve
                    else if (cornerIsFar) {
                        d /= 1.5;
                    }
                    points.push(equidistantProjection(
                        ...transformPointFunc(...move(r, θ, d, localHeading + π / 2 * Math.sign(step)))));
                }
            }
            return points;
        }

        function getPlayerEye(center_r, center_θ, heading, whichEye, dir) {
            const eyeAngle = π / 2 + .41 * π * whichEye;
            let [r, θ, localHeading] = move(center_r, center_θ, .3 * D, heading + eyeAngle);
            if (dir !== undefined) {
                [r, θ, localHeading] = move(r, θ, .07 * D, localHeading - eyeAngle + dir * π / 2);
            }
            const points = [];
            for (let i = 0; i < NUM_STEPS; i++) {
                points.push(equidistantProjection(
                    ...transformPointFunc(...move(r, θ, .09 * D, 2 * π * i / NUM_STEPS))));
            }
            return points;
        }

        function processNode(center_r, center_θ, heading, node) {
            if (hue !== -1) {
                polygons.push({
                    depth,
                    points: animate(node.coordinate, getPolygon(center_r, center_θ, heading)),
                    strokeStyle: `hsl(${hue},${100 * sat}%,50%)`,
                    fillStyle: `hsl(${hue},${100 * sat}%,${100 * val * (node.contents.type === 'Wall' ? 1 : 1.7)}%)`,
                    coordinate: node.coordinate,
                });
            }

            if (node.contents.type === 'Ref') {
                const block = blocks[refs[node.contents.index].blockIndex];
                const headingAdjustment = 2 * π * node.facingNeighborIndex / p;
                // R_0 is the ratio of length of a square in the Beltrami-Klein projection of this block,
                // to the length of the smallest square containing the projection of the entire block.
                const R_0 = tanh((block.minRadius + .5) * D) / tanh(D / 2);
                processBlock(block, 0, heading, depth + 1, (r, θ) => transformPointFunc(
                    ...move(center_r, center_θ, atanh(tanh(r) / R_0), θ + headingAdjustment)));
                polygons.push({
                    depth,
                    points: animate(block, getPolygon(center_r, center_θ, heading + headingAdjustment)),
                    strokeStyle: VOID_COLOR,
                    fillStyle: VOID_COLOR,
                });
                if (block.player) {
                    for (const whichEye of [-1, 1]) {
                        polygons.push({
                            depth: depth + 1,
                            points: getPlayerEye(center_r, center_θ, heading + headingAdjustment, whichEye, currDir),
                            strokeStyle: 'black',
                            fillStyle: 'black',
                        });
                    }
                }
            }

            const button = buttons.find(b => sameCoordinate(node.coordinate, b));
            if (button !== undefined) {
                polygons.push({
                    depth,
                    points: animate(button, getPolygon(center_r, center_θ, heading, .8)),
                    strokeStyle: 'gray',
                    fillStyle: 'transparent',
                });
            }
            if (playerButton !== undefined && sameCoordinate(node.coordinate, playerButton)) {
                polygons.push({
                    depth,
                    points: animate(playerButton, getPolygon(center_r, center_θ, heading, .8)),
                    strokeStyle: 'gray',
                    fillStyle: 'transparent',
                });
                for (const whichEye of [-1, 1]) {
                    polygons.push({
                        depth,
                        points: animate(whichEye, getPlayerEye(center_r, center_θ, heading, whichEye)),
                        strokeStyle: 'gray',
                        fillStyle: 'gray',
                    });
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
        processedBlocks.set(block, centerPosition);
        return centerPosition;
    }

    if (blocks.length === 0) {
        return [];
    }
    const playerRef = refs.find(ref => blocks[ref.blockIndex].player);
    const { blockIndex, nodeIndex } = startBlockIndex !== undefined
        ? blocks[startBlockIndex].nodes[0].coordinate
        : (playerRef !== undefined ? playerRef.parentNode : blocks[0].nodes[0].coordinate);
    const parentBlock = blocks[blockIndex];

    // player block 0 always faces east on the screen
    const [center_r, center_θ, centerHeading] = processBlock(
        parentBlock, nodeIndex, -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p, 0, (r, θ) => [r, θ]);

    // ensure there is a parent
    addBlockToGameMap(gameMap, { q: parentBlock.q, max_r: 0, minRadius: 0, hue: -1 });
    updateContents(gameMap, blocks.length - 1, 0, 'Ref', blockIndex);
    const parentRef = refs.find(ref => ref.exitBlock && ref.blockIndex === blockIndex);
    {
        // TODO this might require taking an arbitrarily high ancestor block
        const { blockIndex, nodeIndex } = parentRef.parentNode;
        const grandparentBlock = blocks[blockIndex];
        const { D } = getParameters(p, parentBlock.q);
        const R_0 = tanh((parentBlock.minRadius + .5) * D) / tanh(D / 2);
        processBlock(grandparentBlock, nodeIndex, -2 * π * grandparentBlock.nodes[nodeIndex].facingNeighborIndex / p, -1,
            (r, θ) => move(center_r, center_θ, atanh(Math.min(R_0 * tanh(r), 1 - ɛ)), centerHeading + θ));
    }
    blocks.pop();
    refs.pop();

    polygons.sort(({ depth: depth1 }, { depth: depth2 }) => depth1 - depth2);
    return polygons;
}

function findContainingNode(polygons, x, y) {
    const crossProduct = (x1, y1, x2, y2) => x1 * y2 - x2 * y1;

    // Returns 1 or -1, depending on the side that (x, y) is on relative to the line through (x1, y1) and (x2, y2).
    const whichSide = (x1, y1, x2, y2, x, y) => Math.sign(crossProduct(x2 - x1, y2 - y1, x - x1, y - y1));

    // whether the line segment from (x1, y1) to (x2, y2) intersects the segment from (x3, y3) to (x4, y4)
    const intersects = (x1, y1, x2, y2, x3, y3, x4, y4) =>
        (whichSide(x1, y1, x2, y2, x3, y3) != whichSide(x1, y1, x2, y2, x4, y4))
        && (whichSide(x3, y3, x4, y4, x1, y1) != whichSide(x3, y3, x4, y4, x2, y2));

    // use a random exterior point to avoid edge cases
    const external_x = Math.random() * WIDTH, external_y = -100;

    function isInsidePolygon(points) {
        let inside = false;
        for (let i = 0; i < points.length; i++) {
            if (intersects(...points[i], ...points[(i + 1) % points.length], x, y, external_x, external_y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // TODO only filter to blocks at the current depth, so that you can change a block's containing node
    for (let i = polygons.length - 1; i >= 0; i--) {
        const { points, coordinate } = polygons[i];
        if (coordinate !== undefined && isInsidePolygon(points)) {
            return coordinate;
        }
    }
    return undefined;
}

function render(canvas, polygons) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = VOID_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
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
