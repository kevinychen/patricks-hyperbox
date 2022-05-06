const WIDTH = 1200;
const HEIGHT = 800;
const NUM_STEPS = 20;
const NUM_ANIMATION_STEPS = 5;
const VOID_COLOR = 'rgb(70,70,70)';

function poincareProjection(r, θ) {
    return [
        WIDTH / 2 + HEIGHT / 2 * sinh(r) * cos(θ) / (cosh(r) + 1),
        HEIGHT / 2 - HEIGHT / 2 * sinh(r) * sin(θ) / (cosh(r) + 1),
    ];
}

// Given (r, θ, heading) for the given node of a block, return (r, θ, heading) for the center node of the block
function centerNodePosition(node, r, θ, heading) {
    const [new_r, new_θ, newHeading] = move(r, θ, node.r, node.θ + π + heading - node.heading);
    return [new_r, new_θ, newHeading + π - node.θ];
}

function toRenderTree(gameMap, currDir, startBlockIndex) {
    const { p, blocks, refs, buttons, playerButton } = gameMap;

    /**
     * Adds all polygons in each node of the given block.
     *
     * @param {Block} block The block
     * @param {number} nodeIndex The index of the node at (0, 0)
     * @param {number} heading The heading of the (center of the) first neighbor of the node at (0, 0)
     * @param {number} depth The depth of the current block (starts at 0; smaller blocks have higher depth)
     * @param {TreeNode} treeNode The current node in the tree graph
     * @param {function} transformPointFunc Transforms (r, θ) in the coordinate space of this block into (r, θ) in the
     * coordinate space of the original block
     */
    function processBlock(block, nodeIndex, heading, depth, treeNode, transformPointFunc) {
        const { q, hue, sat, val, nodes } = block;
        const node = nodes[nodeIndex];
        const { D, S } = getParameters(p, q);

        if (depth < -2 || depth > 3) {
            return;
        }

        function getPolygon(center_r, center_θ, heading, scale = 1) {
            const points = [];
            for (let i = 0; i < p; i++) {
                const [r, θ, localHeading] = move(center_r, center_θ, scale * D / 2, heading + 2 * π * i / p);
                for (let step = -NUM_STEPS / 2; step <= NUM_STEPS / 2; step++) {
                    const d = scale * S * Math.abs(step / NUM_STEPS);
                    points.push(poincareProjection(
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
                points.push(poincareProjection(
                    ...transformPointFunc(...move(r, θ, .09 * D, 2 * π * i / NUM_STEPS))));
            }
            return points;
        }

        function processNode(center_r, center_θ, heading, node) {
            if (hue !== -1) {
                treeNode.polygons.set(node.coordinate.nodeIndex, {
                    animate: true,
                    depth,
                    points: getPolygon(center_r, center_θ, heading),
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
                if (!treeNode.children.has(node.coordinate)) {
                    const childTreeNode = new TreeNode();
                    childTreeNode.parent = [node.coordinate, treeNode];
                    treeNode.children.set(node.coordinate, childTreeNode);
                    processBlock(block, 0, heading, depth + 1, childTreeNode, (r, θ) => transformPointFunc(
                        ...move(center_r, center_θ, atanh(tanh(r) / R_0), θ + headingAdjustment)));
                }
                treeNode.children.get(node.coordinate).polygons.set(-2, {
                    animate: true,
                    depth: depth + .5,
                    points: getPolygon(center_r, center_θ, heading + headingAdjustment),
                    strokeStyle: VOID_COLOR,
                    fillStyle: VOID_COLOR,
                });
                if (block.player) {
                    for (const whichEye of [-1, 1]) {
                        treeNode.children.get(node.coordinate).polygons.set(-2 + whichEye, {
                            animate: depth !== 0,
                            depth: depth + 1,
                            points: getPlayerEye(center_r, center_θ, heading + headingAdjustment, whichEye, currDir),
                            strokeStyle: 'black',
                            fillStyle: 'black',
                        });
                    }
                }
            }

            const button = buttons.find(b => b === node.coordinate);
            if (button !== undefined) {
                treeNode.polygons.set(block.nodes.length + node.coordinate.nodeIndex, {
                    animate: true,
                    depth,
                    points: getPolygon(center_r, center_θ, heading, .8),
                    strokeStyle: 'gray',
                    fillStyle: 'transparent',
                });
            }
            if (playerButton === node.coordinate) {
                treeNode.polygons.set(-5, {
                    animate: true,
                    depth,
                    points: getPolygon(center_r, center_θ, heading, .8),
                    strokeStyle: 'gray',
                    fillStyle: 'transparent',
                });
                for (const whichEye of [-1, 1]) {
                    treeNode.polygons.set(-5 + whichEye, {
                        animate: true,
                        depth,
                        points: getPlayerEye(center_r, center_θ, heading, whichEye),
                        strokeStyle: 'gray',
                        fillStyle: 'gray',
                    });
                }
            }
        }

        // recurse to all nodes in the block
        function processNodes(nodeIndex, r, θ, heading, prevNodeIndex) {
            const node = nodes[nodeIndex];
            processNode(r, θ, heading, node);
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
                processNodes(newNodeIndex, new_r, new_θ, newHeading - 2 * π * newReturnNeighborIndex / p + π, nodeIndex);
            }
        }
        processNodes(nodeIndex, 0, 0, heading, -1);

        // recurse to parent block
        if (treeNode.parent === undefined) {
            // ensure there is a parent
            addBlockToGameMap(gameMap, { q: block.q, max_r: 0, minRadius: 0, hue: -1 });
            updateContents(gameMap, blocks.length - 1, 0, 'Ref', blocks.findIndex(b => b === block));

            const coordinate = refs.find(ref => blocks[ref.blockIndex] === block && ref.exitBlock).parentNode;
            const { blockIndex, nodeIndex } = coordinate;
            const parentBlock = blocks[blockIndex];
            const parentHeading = -2 * π * parentBlock.nodes[nodeIndex].facingNeighborIndex / p;
            const [center_r, center_θ, centerHeading] = centerNodePosition(node, 0, 0, heading);
            const { D } = getParameters(p, block.q);
            const R_0 = tanh((block.minRadius + .5) * D) / tanh(D / 2);
            const parentTreeNode = new TreeNode();
            parentTreeNode.children.set(coordinate, treeNode);
            treeNode.parent = [coordinate, parentTreeNode];
            processBlock(parentBlock, nodeIndex, parentHeading, depth - 1, parentTreeNode,
                (r, θ) => move(center_r, center_θ, atanh(Math.min(R_0 * tanh(r), 1 - ɛ)), centerHeading + θ));

            blocks.pop();
            refs.pop();
        }
    }

    if (blocks.length === 0) {
        return new TreeNode();
    }
    const playerRef = refs.find(ref => blocks[ref.blockIndex].player);
    const startCoordinate = startBlockIndex !== undefined
        ? blocks[startBlockIndex].nodes[0].coordinate
        : (playerRef !== undefined ? playerRef.parentNode : blocks[0].nodes[0].coordinate);
    const { blockIndex, nodeIndex } = startCoordinate;
    const parentBlock = blocks[blockIndex];
    const node = parentBlock.nodes[nodeIndex];
    const startHeading = -2 * π * node.facingNeighborIndex / p;
    const startTreeNode = new TreeNode();
    processBlock(parentBlock, nodeIndex, startHeading, 0, startTreeNode, (r, θ) => [r, θ]);
    return startTreeNode.children.get(startCoordinate) || startTreeNode;
}

function findContainingNode(polygons, x, y, targetDepth) {
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

    for (let i = polygons.length - 1; i >= 0; i--) {
        const { depth, points, coordinate } = polygons[i];
        if (coordinate !== undefined && depth === targetDepth && isInsidePolygon(points)) {
            return coordinate;
        }
    }
    return undefined;
}

function render(canvas, polygons, animationMap, animatingStep) {
    function interpolate(animationKey, points) {
        const prevPoints = animationMap.get(animationKey) || points;
        const interpolatedPoints = [];
        for (let i = 0; i < points.length; i++) {
            interpolatedPoints.push([
                points[i][0] + (prevPoints[i][0] - points[i][0]) * animatingStep / NUM_ANIMATION_STEPS,
                points[i][1] + (prevPoints[i][1] - points[i][1]) * animatingStep / NUM_ANIMATION_STEPS,
            ]);
        }
        return interpolatedPoints;
    }

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = VOID_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (const { animate, animationKey, points, strokeStyle, fillStyle } of polygons) {
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        const actualPoints = animate && animationMap !== undefined
            ? interpolate(animationKey, points)
            : points;
        for (const [x, y] of actualPoints) {
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fill();
    }
}
