export type Point = { x: number; y: number };

export type ShapeType = 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon' | 'circle';

export interface Shape {
    id: string;
    type: ShapeType;
    radius: number;
    center: Point;
    rotation: number; // in radians
}

/**
 * Returns the vertices of a regular polygon.
 * @param sides Number of sides
 * @param radius Radius (circumradius)
 * @param center Center point
 * @param rotation Rotation in radians
 */
export function getPolygonVertices(
    sides: number,
    radius: number,
    center: Point,
    rotation: number = 0
): Point[] {
    const vertices: Point[] = [];
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2 + rotation;
        vertices.push({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
        });
    }
    return vertices;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm.
 */
export function isPointInPolygon(point: Point, vertices: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Check if two line segments intersect.
 */
function doSegmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
    const ccw = (a: Point, b: Point, c: Point) =>
        (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);

    return ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
}

/**
 * Check if two polygons intersect (edges cross).
 * Note: This checks for *edge intersection*. For full overlap (one inside another),
 * you also need to check if one vertex of A is inside B.
 */
export function doPolygonsIntersect(poly1: Point[], poly2: Point[]): boolean {
    // Check every edge of poly1 against every edge of poly2
    for (let i = 0; i < poly1.length; i++) {
        const p1 = poly1[i];
        const p2 = poly1[(i + 1) % poly1.length];

        for (let j = 0; j < poly2.length; j++) {
            const q1 = poly2[j];
            const q2 = poly2[(j + 1) % poly2.length];

            if (doSegmentsIntersect(p1, p2, q1, q2)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Check if innerPoly is completely container within outerPoly.
 * This assumes they are simple convex polygons (which regular shapes are).
 */
export function isPolygonContained(innerPoly: Point[], outerPoly: Point[]): boolean {
    // 1. If any edge intersects, it's not fully contained (it's crossing).
    if (doPolygonsIntersect(innerPoly, outerPoly)) return false;

    // 2. If no edges intersect, it's either fully inside or fully outside.
    // Check if one vertex of inner is inside outer.
    return isPointInPolygon(innerPoly[0], outerPoly);
}

/**
 * Result of a placement check.
 */
export type PlacementResult = 'collision' | 'inside' | 'outside';

/**
 * Checks the type of placement for a new polygon against existing ones.
 */
export function checkPlacementType(newPoly: Point[], existingPolys: Point[][]): PlacementResult {
    // 1. Check for edge overlapping (Collision)
    for (const existing of existingPolys) {
        if (doPolygonsIntersect(newPoly, existing)) {
            return 'collision';
        }
    }

    // 2. Check strict containment
    // If we are not colliding, we are either fully inside one, or fully outside all.
    // (Assuming simple convex polygons)
    let isInsideInfo = false;
    for (const existing of existingPolys) {
        if (isPointInPolygon(newPoly[0], existing)) {
            isInsideInfo = true;
            break;
        }
    }

    if (isInsideInfo) return 'inside';

    // 3. Check if we are covering someone else (Anti-nesting check?)
    // If I place a giant shape over a small one, my center might be valid, but I contain the small one.
    // Technically that's still "no collision", but it might be considered 'outside' usage or invalid depending on rules.
    // For now, let's treat "Enveloping" as 'outside' (disjoint borders), unless we want to block it.
    // Ideally "Inside" means "I am inside X". "Outside" means "I am outside X".
    // If "X is inside Me", I am technically "Outside X". 

    return 'outside';
}

export function getSides(type: ShapeType): number {
    switch (type) {
        case 'triangle': return 3;
        case 'square': return 4;
        case 'pentagon': return 5;
        case 'hexagon': return 6;
        case 'heptagon': return 7;
        case 'octagon': return 8;
        case 'circle': return 32; // Approximate circle with 32 sides for collision
    }
}
