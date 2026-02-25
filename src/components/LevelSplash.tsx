import { type ShapeType } from '../utils/geometry';
import { ModeVisual } from './ModeVisual';

interface LevelSplashProps {
    level?: number;
    title?: string;
    mode: 'INSIDE' | 'OUTSIDE';
    shapeType: ShapeType;
    shapesRemaining: number;
}

export function LevelSplash({ level, title, mode, shapeType, shapesRemaining }: LevelSplashProps) {

    // Timings (ms)
    // Animation duration is now 1.25s (1250ms).

    const levelDelay = 0;
    // Show shape immediately if no text (mid-game), or after text if present
    const displayText = title || (level ? `LEVEL ${level}` : null);
    const shapeDelay = displayText ? 1200 : 0;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 100
            }}
        >

            {/* Title Text */}
            {displayText && (
                <div
                    className="animate-sequence"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animationDelay: `${levelDelay}ms`,
                    }}
                >
                    <h1
                        className="font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] text-center"
                        style={{
                            fontSize: '12vw', // Also reduced slightly from 15vw
                            lineHeight: 0.8
                        }}
                    >
                        {displayText}
                    </h1>
                </div>
            )}

            {/* Shape Visuals */}
            <div
                className="animate-sequence"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animationDelay: `${shapeDelay}ms`
                }}
            >
                <div style={{ width: '60vmin', height: '60vmin' }}>
                    <ModeVisual
                        mode={mode}
                        shapeType={shapeType}
                        shapesRemaining={shapesRemaining}
                        size="100%"
                    />
                </div>
            </div>
        </div>
    );
}
