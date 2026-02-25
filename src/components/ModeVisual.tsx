import { cn } from '../utils/cn';
import { getSides, getPolygonVertices, type ShapeType } from '../utils/geometry';

interface ModeVisualProps {
    mode: 'INSIDE' | 'OUTSIDE';
    shapeType: ShapeType;
    shapesRemaining: number; // Used for rotation if needed? Actually LevelSplash uses it for triangle rotation.
    className?: string;
    size?: string; // CSS size string e.g. "60vmin" or "32px"
}

export function ModeVisual({ mode, shapeType, shapesRemaining, className, size = "100%" }: ModeVisualProps) {
    const isNest = mode === 'INSIDE';
    const sides = getSides(shapeType);
    const baseRotation = shapeType === 'triangle' && (shapesRemaining % 2 !== 0) ? Math.PI : 0;

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" className={cn("overflow-visible", className)}>
            {[0, 1, 2].map(i => {
                let scale = 1.0;
                let centerX = 50;
                let centerY = 50;
                let opacity = 0.1;

                if (isNest) {
                    // INSIDE: 3 shapes within each other (Concentric)
                    // Scales: 1.0 (Outer), 0.6 (Mid), 0.2 (Inner)
                    scale = 1.0 - (i * 0.4);
                    opacity = 0.15 - (i * 0.04);
                } else {
                    // OUTSIDE: Honeycomb Cluster

                    // To match the reference (flat-to-flat touching for hexagons), we need to:
                    // 1. Rotate hexagons by 30deg (PI/6) so flats align with neighbor vectors.
                    // 2. Set clusterRadius equal to shape radius (mathematically packs honeycomb).

                    scale = 0.28;
                    opacity = 0.15;

                    // Tighter cluster matching shape radius for touching
                    // Tighter cluster matching shape radius for touching
                    // 1.15 multiplier to match reference whitespace
                    const clusterRadius = 45 * scale * 1.18;
                    const clusterCenters = getPolygonVertices(3, clusterRadius, { x: 50, y: 50 }, -Math.PI / 2);

                    centerX = clusterCenters[i].x;
                    centerY = clusterCenters[i].y;
                }

                // Adjust rotation for hexagons in cluster mode to flat-pack
                let rotation = baseRotation;
                if (!isNest) {
                    if (sides === 6) {
                        rotation += 0; // 0 deg for Hexagons (Pointy top matching game)
                    } else if (sides === 8) {
                        rotation += Math.PI / 8; // 22.5 deg for Octagons
                    } else if (sides === 4) {
                        rotation += Math.PI / 4; // 45 deg for Squares
                    } else if (sides === 4) {
                        rotation += Math.PI / 4; // 45 deg for Squares
                    }
                    // Circles (32 sides) don't need rotation adjustment
                }

                // Adjust cluster radius specific for Octagons to avoid overlap
                // The circumradius math for octagons touching flat-to-flat is different.
                if (!isNest) {
                    if (sides === 8) {
                        // Octagons need more space + distinct gap (1.25 -> 1.35)
                        const clusterRadius = 45 * scale * 1.35;
                        const clusterCenters = getPolygonVertices(3, clusterRadius, { x: 50, y: 50 }, -Math.PI / 2);
                        centerX = clusterCenters[i].x;
                        centerY = clusterCenters[i].y;
                    } else if (sides === 4) {
                        // Squares (Level 4)
                        // Need distinct spacing and rotation
                        const clusterRadius = 45 * scale * 1.25;
                        const clusterCenters = getPolygonVertices(3, clusterRadius, { x: 50, y: 50 }, -Math.PI / 2);
                        centerX = clusterCenters[i].x;
                        centerY = clusterCenters[i].y;
                    }
                }

                return (
                    <polygon
                        key={i}
                        points={getPolygonVertices(
                            sides,
                            45 * scale,
                            { x: centerX, y: centerY },
                            rotation
                        ).map(p => `${p.x},${p.y}`).join(' ')}
                        fill="currentColor"
                        fillOpacity={opacity}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={cn(isNest ? "text-purple-400" : "text-cyan-400")}
                    />
                );
            })}
        </svg>
    );
}
