import { type ShapeType } from '../utils/geometry';
import { ModeVisual } from './ModeVisual';

interface LevelSplashProps {
    level?: number;
    title?: string;
    leadTitle?: string;
    mode: 'INSIDE' | 'OUTSIDE';
    shapeType: ShapeType;
    shapesRemaining: number;
}

export function LevelSplash({ level, title, leadTitle, mode, shapeType, shapesRemaining }: LevelSplashProps) {
    const displayText = title || (level ? 'LEVEL ' + level : null);
    const levelDelay = leadTitle ? 1250 : 0;
    const shapeDelay = displayText ? (leadTitle ? 2450 : 1200) : 0;

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
            {leadTitle && (
                <div
                    className="animate-sequence"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <h1
                        className="font-black text-purple-300 tracking-tighter drop-shadow-[0_0_30px_rgba(168,85,247,0.85)] text-center"
                        style={{ fontSize: '11vw', lineHeight: 0.8 }}
                    >
                        {leadTitle}
                    </h1>
                </div>
            )}

            {displayText && (
                <div
                    className="animate-sequence"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animationDelay: levelDelay + 'ms',
                    }}
                >
                    <h1
                        className="font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] text-center"
                        style={{ fontSize: '12vw', lineHeight: 0.8 }}
                    >
                        {displayText}
                    </h1>
                </div>
            )}

            <div
                className="animate-sequence"
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animationDelay: shapeDelay + 'ms'
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
