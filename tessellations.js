/*
 * Generic math related to transformations and tessellations in hyperbolic space.
 */

const ɛ = 1e-12;
const { PI: π, abs, max, sin, cos, acos, sinh, cosh, tanh, asinh, acosh, atanh } = Math;

/*
 * Returns relevant lengths for the tessellation with Schlafli symbol {p,q}
 * (p-sided polygons, q meeting at each vertex).
 */
function getParameters(p, q) {
    // distance between centers of adjacent polygons
    const D = acosh((cos(2 * π / q) + 1) / (sin(π / p) * sin(π / p)) - 1);

    // distance from center of polygon to vertex
    const R = asinh(Math.sqrt((cosh(D) - 1) / (1 - cos(2 * π / q))));

    // distance between adjacent vertices
    const S = acosh(cosh(R) * cosh(R) - sinh(R) * sinh(R) * cos(2 * π / p));

    return { D, R, S };
}

/*
 * Translates the point (r, θ) in hyperbolic space (curvature -1) a distance d in the given heading, and returns the new point and (local) heading.
 * A heading is defined as: if you move radially outwards at angle θ from the origin, your heading is always θ.
 *
 * To derive the implementation, draw a triangle between the origin, source, and destination points, and use the Hyperbolic Law of Cosines.
 * This is a bit ad-hoc compared to the standard approach with rotation matrices, but requires less code.
 */
function move(r, θ, d, heading) {
    if (r === 0) {
        return [d, heading, heading];
    }
    const ϕ = (θ + π - heading) % (2 * π);
    const crossProductSignum = ϕ < -π || (ϕ > 0 && ϕ < π) ? 1 : -1;
    const new_r = acosh(cosh(d) * cosh(r) - sinh(d) * sinh(r) * cos(ϕ));
    const new_θ = acos((cosh(new_r) * cosh(r) - cosh(d)) / (sinh(new_r) * sinh(r) * (1 + ɛ)))
        * crossProductSignum
        + θ;
    const newHeading = acos((cosh(new_r) * cosh(d) - cosh(r)) / (sinh(new_r) * sinh(d) * (1 + ɛ)))
        * crossProductSignum
        + new_θ;
    return [new_r, new_θ, newHeading];
}

/*
 * In the tree structure for a tessellation with Schlafli symbol {p,q}, each node/polygon has a "state".
 * Nodes with the same state have the same subtree.
 * The j'th neighbor (starting from the parent and going counterclockwise) of a node with state i is a node with state CONNECTION_RULES[{p,q}][i][j].
 * 'P' stands for 'parent', and 'L' and 'R' stand for left and right siblings (without a direct edge connection) in the tree.
 *
 *  | |
 *  . B_._      This example is a tree for the square tessellation {4,4} in Euclidean space.
 *  | |         The tree is rooted at (*), which has state 0.
 *  . A_C-  <-- The child A has only three connections, so it has a different state, state 1.
 *  | |         The subtrees of A and B are identical, so B also has state 1. C is different, so has state 2.
 *  ._*_._      The connection rules are therefore [1, 1, 1, 1], [P, L, 1, 1], [P, R, 2, L].
 *    | |
 *  ._. .
 *
 * For more details, see "Generating Tree Structures for Hyperbolic Tessellations" by D Celińska-Kopczyńska, https://arxiv.org/pdf/2111.12040.pdf.
 */
const CONNECTION_RULES = {
    '{4,5}': [[1, 1, 1, 1], ['P', 3, 1, 2], ['P', 3, 1, 'L'], ['P', 'R', 3, 2]],
    '{4,6}': [[1, 1, 1, 1], ['P', 3, 1, 2], ['P', 3, 1, 4], ['P', 'R', 1, 2], ['P', 3, 2, 'L']],
    '{7,3}': [[1, 1, 1, 1, 1, 1, 1], ['P', 'R', 'R', 1, 1, 2, 'L'], ['P', 'R', 'R', 1, 2, 'L', 'L']],
    '{8,3}': [[1, 1, 1, 1, 1, 1, 1, 1], ['P', 'R', 'R', 1, 1, 1, 2, 'L'], ['P', 'R', 'R', 1, 1, 2, 'L', 'L']],
};

/*
 * Returns the polygons in the tessellation with Schlafli symbol {p,q}, subject to the restrictions:
 *
 * 1. The center of the polygon is at most max_r from the origin
 * 2. For each 0≤i<p, consider the line through (r=minRadius, θ=2πi/p) perpendicular to the line through that point and the origin.
 *    The center of the polygon lies on the same side of this line as the origin.
 *    (In other words, the center of the polygon lies in an appropriately sized regular polygon in the Beltrami-Klein projection.)
 */
function getBoundedTessellation(p, q, max_r, minRadius) {
    const { D } = getParameters(p, q);

    // An array of all polygon nodes. Pointers to nodes are indices into this array. The heading is the heading to the parent node.
    const polygons = [{ state: 0, neighbors: new Array(p), r: 0, θ: 0, heading: 0 }];

    function connect(nodeIndex1, returnNeighborIndex1, nodeIndex2, returnNeighborIndex2, isMainEdge) {
        polygons[nodeIndex1].neighbors[returnNeighborIndex1] = { nodeIndex: nodeIndex2, returnNeighborIndex: returnNeighborIndex2, isMainEdge };
        polygons[nodeIndex2].neighbors[returnNeighborIndex2] = { nodeIndex: nodeIndex1, returnNeighborIndex: returnNeighborIndex1, isMainEdge };
    }

    function helper(nodeIndex, neighborIndex) {
        const { state, neighbors, r, θ, heading } = polygons[nodeIndex];
        if (neighbors[neighborIndex] !== undefined) {
            return;
        }
        const nextState = CONNECTION_RULES[`{${p},${q}}`][state][neighborIndex];
        if (typeof (nextState) === 'number') {
            const [new_r, new_θ, newHeading] = move(r, θ, D, heading + 2 * π * neighborIndex / p);
            if (new_r <= max_r) {
                if (tanh(new_r) * max(abs(cos(new_θ)), abs(sin(new_θ))) < tanh((minRadius + .5) * D)) {
                    const node = { state: nextState, neighbors: new Array(p), r: new_r, θ: new_θ, heading: newHeading + π };
                    const newNodeIndex = polygons.length;
                    polygons.push(node);
                    connect(nodeIndex, neighborIndex, newNodeIndex, 0, true);
                    for (let i = 0; i < p; i++) {
                        helper(newNodeIndex, i);
                    }
                } else {
                    const externalNeighborIndex = (Math.round(new_θ * p / (2 * π)) % p + p) % p;
                    polygons[nodeIndex].neighbors[neighborIndex] = { externalNeighborIndex };
                }
            }
        }
        const d = { 'L': 1, 'R': p - 1 }[nextState];
        if (d !== undefined) {
            let edge = { nodeIndex, returnNeighborIndex: neighborIndex };
            for (let k = 0; k < q - 1; k++) {
                const neighborIndex = (edge.returnNeighborIndex + d) % p;
                helper(edge.nodeIndex, neighborIndex);
                edge = polygons[edge.nodeIndex].neighbors[neighborIndex];
                if (edge?.nodeIndex === undefined) {
                    return;
                }
            }
            connect(nodeIndex, neighborIndex, edge.nodeIndex, (edge.returnNeighborIndex + d) % p, false);
        }
    }

    for (let i = 0; i < p; i++) {
        helper(0, i);
    }
    return polygons;
}
