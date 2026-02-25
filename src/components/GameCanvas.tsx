import { useRef, useEffect, useState, useCallback } from 'react';
import {
    getPolygonVertices,
    checkPlacementType,
    getSides
} from '../utils/geometry';
import type { Shape, Point, ShapeType, PlacementResult } from '../utils/geometry';
import { cn } from '../utils/cn';

interface GameCanvasProps {
    className?: string;
    currentLevelShape: ShapeType; // The shape type the user needs to place
    onPlaceShape?: (result: PlacementResult) => void;
    transitioning?: boolean;
    onTransitionEnd?: () => void;
    fixedRadius?: number;
    targetMode?: 'inside' | 'outside';
    transitionMode?: 'success' | 'failure';
}

export const GameCanvas = ({
    className,
    currentLevelShape,
    onPlaceShape,
    transitioning,
    onTransitionEnd,
    fixedRadius = 50,
    targetMode = 'outside',
    transitionMode = 'success'
}: GameCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Game State
    const [shapes, setShapes] = useState<Shape[]>([]);

    // Mutable Game State (Refs for performance/loop access)
    const shapesRef = useRef<Shape[]>([]);
    const isHoldingRef = useRef(false);
    const holdStartTimeRef = useRef(0);
    const cursorPosRef = useRef<Point>({ x: 0, y: 0 });
    const transitioningRef = useRef(transitioning);

    // Sync refs
    useEffect(() => { shapesRef.current = shapes; }, [shapes]);
    useEffect(() => { transitioningRef.current = transitioning; }, [transitioning]);

    // Resize Handler
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            const canvas = canvasRef.current;
            if (canvas && container) {
                const { clientWidth, clientHeight } = container;
                // Guard against invalid dimensions (e.g. during display:none or transform hiccups)
                if (clientWidth === 0 || clientHeight === 0) return;

                const dpr = window.devicePixelRatio || 1;
                canvas.width = clientWidth * dpr;
                canvas.height = clientHeight * dpr;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.scale(dpr, dpr);
                console.log(`Resized: client=${clientWidth}x${clientHeight}, dpr=${dpr}, canvas=${canvas.width}x${canvas.height}`);
                canvas.style.width = `${clientWidth}px`;
                canvas.style.height = `${clientHeight}px`;
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // Key handler
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                // Determine if this is a "cheat" reset or a gameplay reset. 
                // The App.tsx handles gameplay reset. We'll leave this for debug only if needed, 
                // but usually better to let App control state. 
                // We'll keep it silent here or remove it? User asked to remove debugging buttons/text.
                // Let's remove the internal reset to avoid conflict with App logic.
                // setShapes([]); 
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Capture pointer to track even outside canvas
        e.currentTarget.setPointerCapture(e.pointerId);

        const rect = canvas.getBoundingClientRect();
        // Update ref directly
        cursorPosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        isHoldingRef.current = true;
        holdStartTimeRef.current = Date.now();
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // If we lost capture for some reason, maybe re-assert or just proceed?
        // Standard moves are fine.

        const rect = canvas.getBoundingClientRect();
        cursorPosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }, []);

    // Helper (Memoized, but relies on props. safe to use in loop if props are stable or ref'd)
    const getShapeFromInteraction = useCallback((_durationMs: number, center: Point, type: ShapeType, radius: number, existingCount: number) => {
        let rotation = 0;
        if (type === 'triangle') {
            // Alternate orientation: Up (0) -> Down (PI) -> Up
            // Use existingCount to determine parity
            if (existingCount % 2 !== 0) {
                rotation = Math.PI;
            }
        }
        return { radius, rotation, center, type };
    }, []);

    // Logic to add shape
    const tryPlaceShape = useCallback(() => {
        if (!isHoldingRef.current || transitioningRef.current) return;
        isHoldingRef.current = false;

        const duration = Date.now() - holdStartTimeRef.current;
        const cursorPos = cursorPosRef.current;

        const { radius, rotation, center, type } = getShapeFromInteraction(duration, cursorPos, currentLevelShape, fixedRadius, shapesRef.current.length);

        const id = Math.random().toString(36).substr(2, 9);
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 70%, 60%)`;
        // @ts-ignore 
        const newShape: Shape = { id, type, radius, center, rotation, color };

        const existingPolys = shapesRef.current.map(s =>
            getPolygonVertices(getSides(s.type), s.radius, s.center, s.rotation)
        );
        const sides = getSides(type);
        const newPoly = getPolygonVertices(sides, radius, center, rotation);

        const result = checkPlacementType(newPoly, existingPolys);

        onPlaceShape?.(result);

        if (result === targetMode) {
            setShapes(prev => [...prev, newShape]);
        }

    }, [currentLevelShape, fixedRadius, getShapeFromInteraction, onPlaceShape, targetMode]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        tryPlaceShape();
        isHoldingRef.current = false;
    }, [tryPlaceShape]);


    // Animation Loop
    const transitionProgressRef = useRef(0);
    const transitionStartTimeRef = useRef(0);

    // External trigger for transition
    useEffect(() => {
        if (transitioning) {
            transitionStartTimeRef.current = Date.now();
        }
    }, [transitioning]);

    // External Trigger to clear shapes (e.g. from App)
    useEffect(() => {
        // If shapes is empty in parent, we might want to ensure it's empty here?
        // Actually, this component manages shapes state internally mainly.
        // If we want App to reset "Level", App should signal us.
        // We use 'transitioning' for visual reset.
        if (transitioningRef.current === false && transitionProgressRef.current >= 1) {
            // Reset internal if transition just finished? Handled in existing loop logic.
        }
    }, []);

    // Allow parent to force clear (e.g. Game Over)
    useEffect(() => {
        // We can use a ref or prop method.
        // For now, if transitioning goes true, we persist. 
        // If we need a hard reset:
    }, []);

    // Expose a clear function? Or just depend on key prop?
    // Let's use a key prop in App.tsx to force re-mount if needed, or add a clear prop. 
    // Actually, simply adding a prop `resetTrigger` would work.
    // Or just rely on `transitioning` effectively clearing it.

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            // Handle DPI scaling for clear
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            // Canvas Logical Size
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;
            const centerScreen = { x: width / 2, y: height / 2 };

            // Handle Transition Logic
            let tProgress = 0;
            if (transitioningRef.current) {
                const elapsed = Date.now() - transitionStartTimeRef.current;

                // Slow down failure animation significantly (e.g. 4000ms total)
                // For success, add 500ms for the pulse phase (3500 -> 4000)
                const duration = transitionMode === 'failure' ? 4000 : 4000;

                tProgress = Math.min(1, elapsed / duration);
                transitionProgressRef.current = tProgress;

                if (tProgress >= 1) {
                    if (shapesRef.current.length > 0) {
                        setShapes([]);
                        onTransitionEnd?.();
                    }
                }
            } else {
                transitionProgressRef.current = 0;
            }



            // Draw Shapes
            shapesRef.current.forEach(shape => {
                let renderRadius = shape.radius;
                let renderCenter = shape.center;
                let opacity = 1;

                if (transitioningRef.current) {
                    const elapsed = Date.now() - transitionStartTimeRef.current;

                    let flyElapsed = elapsed;

                    // Pre-Transition Pulse (Success Only)
                    if (transitionMode === 'success') {
                        const pulseDuration = 500;
                        if (elapsed < pulseDuration) {
                            const p = elapsed / pulseDuration;
                            // Sine wave 0 -> 1 -> 0. Scales 1.0 -> 1.1 -> 1.0
                            const pulseScale = 1 + Math.sin(p * Math.PI) * 0.15;
                            renderRadius *= pulseScale;
                        }
                        // Delay the fly-away logic
                        flyElapsed = elapsed - pulseDuration;
                    }

                    if (flyElapsed > 0) {
                        // Stagger logic: Larger shapes (120px) start immediately. Smaller shapes wait.
                        // Delay max ~600ms for smallest shapes
                        const staggerDelay = (120 - shape.radius) * 6;

                        // Individual progress for this shape
                        // Slower individual shape expansion for failure
                        const shapeDuration = transitionMode === 'failure' ? 2500 : 2000;

                        let localP = Math.max(0, (flyElapsed - staggerDelay) / shapeDuration);
                        localP = Math.min(1, localP);

                        if (localP > 0) {
                            // Cubic ease in
                            const t = localP * localP * localP;
                            const scale = 1 + t * 40; // Expand aggressively into camera

                            renderRadius = shape.radius * scale;

                            // Move away from vanishing point (Center Screen)
                            const dx = shape.center.x - centerScreen.x;
                            const dy = shape.center.y - centerScreen.y;

                            renderCenter = {
                                x: centerScreen.x + dx * scale,
                                y: centerScreen.y + dy * scale
                            };

                            // Fade out as it gets close to camera (high scale)
                            opacity = 1 - Math.pow(localP, 2);
                        }
                    }
                }

                // Override coloring for transition
                if (transitioningRef.current && opacity > 0 && transitionMode === 'failure') {
                    // Add a global red overlay that increases with T
                    // (We do this per shape loop which is inefficient but acceptable for small N)
                    // Actually better to do this ONCE outside loop, but let's just color the shapes red here.
                }

                if (transitioningRef.current && transitionMode === 'failure' && transitionProgressRef.current > 0.1) {
                    ctx.fillStyle = `rgba(239, 68, 68, 0.05)`; // Subtle red buildup
                    ctx.fillRect(0, 0, width, height);
                }

                if (opacity <= 0.01) return;

                const sides = getSides(shape.type);
                const poly = getPolygonVertices(sides, renderRadius, renderCenter, shape.rotation);

                ctx.beginPath();
                poly.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();

                // @ts-ignore
                let shapeColor = shape.color || `rgba(34, 211, 238, 1)`;

                // Dynamic Transition Color
                if (transitioningRef.current) {
                    if (transitionMode === 'failure') shapeColor = '#ef4444';
                    // For success, keep original shapeColor (don't override to white)
                }

                ctx.strokeStyle = shapeColor;
                ctx.lineWidth = 2 + (transitioningRef.current ? 5 : 0);
                ctx.globalAlpha = opacity;
                ctx.stroke();
                ctx.globalAlpha = opacity * 0.2;
                ctx.fillStyle = shapeColor;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            });

            // Draw Ghost
            if (isHoldingRef.current && !transitioningRef.current) {
                const duration = Date.now() - holdStartTimeRef.current;
                const cursorPos = cursorPosRef.current;

                const { radius, rotation } = getShapeFromInteraction(duration, cursorPos, currentLevelShape, fixedRadius, shapesRef.current.length);
                const sides = getSides(currentLevelShape);
                const poly = getPolygonVertices(sides, radius, cursorPos, rotation);

                const existingPolys = shapesRef.current.map(s =>
                    getPolygonVertices(getSides(s.type), s.radius, s.center, s.rotation)
                );
                const result = checkPlacementType(poly, existingPolys);
                const isValid = result === targetMode;

                ctx.beginPath();
                poly.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();

                // Colors: Success = Purple/Green, Failure = Red
                const validColor = `rgba(168, 85, 247, 0.8)`; // Purple
                const errorColor = `rgba(239, 68, 68, 0.8)`;  // Red

                ctx.strokeStyle = isValid ? validColor : errorColor;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = isValid ? validColor.replace('0.8', '0.2') : errorColor.replace('0.8', '0.2');
                ctx.fill();

                // Debug Dot
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(cursorPos.x, cursorPos.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [currentLevelShape, fixedRadius, getShapeFromInteraction, onTransitionEnd, targetMode, transitionMode]);

    const handlePointerCancel = useCallback((e: React.PointerEvent) => {
        // If the interaction is cancelled (e.g. palm rejection, scroll takeover, context menu),
        // we should ABORT the placement, not execute it.
        if (isHoldingRef.current) {
            isHoldingRef.current = false;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore capture errors if already released
            }
        }
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn("relative w-full h-full touch-none", className)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, touchAction: 'none' }}
        >
            <canvas
                ref={canvasRef}
                className="block w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(e) => e.preventDefault()}
            />
        </div>
    );
};
