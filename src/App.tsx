import { useState, useCallback, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { LevelSplash } from './components/LevelSplash';
import { ModeVisual } from './components/ModeVisual';
import type { PlacementResult, ShapeType } from './utils/geometry';
import { cn } from './utils/cn';

// Game Configuration
const SHAPES_PER_PHASE = 6;
const TOTAL_PHASES = 6;
// Radii for each phase (6 sizes) - Must match TOTAL_PHASES length
const PHASE_RADII = [140, 115, 95, 75, 55, 40];

function App() {
  // Game State
  const [level, setLevel] = useState(1);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [gameId, setGameId] = useState(0); // Used to hard-reset canvas

  const [shapesRemaining, setShapesRemaining] = useState(SHAPES_PER_PHASE);
  const [phaseTargetCount, setPhaseTargetCount] = useState(SHAPES_PER_PHASE);

  // Visual State
  const [currentShape, setCurrentShape] = useState<ShapeType>('hexagon');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMode, setTransitionMode] = useState<'success' | 'failure'>('success');
  const [gameOver, setGameOver] = useState(false); // Legacy, effectively unused now if we transition immediately
  const [shake, setShake] = useState(false);

  // Responsive State
  const [scaleFactor, setScaleFactor] = useState(1);
  const [isShortScreen, setIsShortScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const minDim = Math.min(w, h);
      // Identify short landscape screens (e.g. mobile landscape) to hide non-critical UI
      setIsShortScreen(h < 500 && w > h);

      // Scale shapes based on the limiting screen dimension.
      // This keeps gameplay usable on short/narrow mobile viewports.
      if (minDim < 380) setScaleFactor(0.55);
      else if (minDim < 430) setScaleFactor(0.65);
      else if (minDim < 520) setScaleFactor(0.75);
      else if (minDim < 700) setScaleFactor(0.9);
      else if (minDim < 900) setScaleFactor(1.0);
      else if (minDim < 1200) setScaleFactor(1.1);
      else setScaleFactor(1.2);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Derived State
  // Phase 0, 2, 4 = Outside (Base/Expand). Phase 1, 3, 5 = Inside (Nest).
  // Mixed behavior: Odd stages are Nesting, Even stages are clustering/building.
  const isNestPhase = phaseIndex % 2 !== 0;
  const targetMode = isNestPhase ? 'inside' : 'outside';
  const currentRadius = Math.round((PHASE_RADII[phaseIndex] || 20) * scaleFactor);

  // Level Logic
  useEffect(() => {
    const shapes: ShapeType[] = ['circle', 'hexagon', 'triangle', 'octagon', 'square', 'pentagon'];
    setCurrentShape(shapes[(level - 1) % shapes.length]);
  }, [level]);

  const handlePlaceShape = useCallback((result: PlacementResult) => {
    if (gameOver || isTransitioning) return;

    console.log('Place Result:', result, 'Target:', targetMode);

    if (result === targetMode) {
      // Success
      const points = isNestPhase ? 50 : 20;
      setScore(s => s + points);

      // Just decrement. The effect will handle the phase change when it hits 0.
      setShapesRemaining(prev => prev - 1);
    } else {
      console.log('Life Lost Triggered');
      handleLifeLost();
    }
  }, [gameOver, isTransitioning, targetMode, isNestPhase]);

  // Phase Completion Effect
  useEffect(() => {
    if (shapesRemaining <= 0) {
      completePhase();
    }
  }, [shapesRemaining]);

  const handleLifeLost = useCallback(() => {
    setLives(prev => {
      console.log('Updating Lives. Prev:', prev, 'New:', prev - 1);
      const newLives = prev - 1;
      if (newLives <= 0) {
        // Trigger Game Over Transition
        setTransitionMode('failure');
        setIsTransitioning(true);
      }
      return newLives;
    });
    setShake(false);
    // Use a small timeout to allow React to process the state change (remove class)
    // before re-adding it. This acts as a manual visual reset.
    setTimeout(() => {
      setShake(true);
      // Clear after animation duration
      setTimeout(() => setShake(false), 500);
    }, 10);
  }, []);

  // REMOVED BAD EFFECT that caused infinite reset loops

  const completePhase = () => {
    // Check if valid before incrementing
    setPhaseIndex(prev => {
      // Check if we are already at max to prevent multiple increments if effect fires weirdly
      if (prev < TOTAL_PHASES - 1) {
        const nextPhase = prev + 1;
        const isNextNest = nextPhase % 2 !== 0;

        // Determine target for NEXT phase immediately
        if (isNextNest) {
          // Inside: Target = (Number of Preceding Outside Phases) * SHAPES_PER_PHASE
          // Preceding Outside Phases are 0, 2, 4...
          // For nextPhase=1 (Inside), precedes: 0. Count=1. Target=6.
          // For nextPhase=3 (Inside), precedes: 0, 2. Count=2. Target=12.
          // For nextPhase=5 (Inside), precedes: 0, 2, 4. Count=3. Target=18.
          // Formula: ceil(nextPhase / 2) * 6
          const outsidePhasesCount = Math.ceil(nextPhase / 2);
          const target = outsidePhasesCount * SHAPES_PER_PHASE;

          setShapesRemaining(target);
          setPhaseTargetCount(target);
        } else {
          // Outside: Fixed count
          setShapesRemaining(SHAPES_PER_PHASE);
          setPhaseTargetCount(SHAPES_PER_PHASE);
        }

        return nextPhase;
      } else {
        // Level Complete
        setTransitionMode('success');
        setTimeout(() => setIsTransitioning(true), 10);
        return prev;
      }
    });
  };

  const onTransitionEnd = useCallback(() => {
    setIsTransitioning(false);

    if (transitionMode === 'failure') {
      // Reset to Level 1
      setLevel(1);
      setPhaseIndex(0);
      setScore(0);
      setLives(3);
      setShapesRemaining(SHAPES_PER_PHASE);
      setPhaseTargetCount(SHAPES_PER_PHASE);

      // We don't need to increment gameId theoretically if we cleared shapes,
      // but if we want to be safe we can.
      setGameId(prev => prev + 1);
    } else {
      // Level Up
      setLevel(l => l + 1);
      setPhaseIndex(0);
      setShapesRemaining(SHAPES_PER_PHASE);
      setPhaseTargetCount(SHAPES_PER_PHASE);
      // Gain a life (max 3) for winning a level
      setLives(prev => Math.min(3, prev + 1));
    }
  }, [transitionMode]);

  // Handle Mount initialization
  useEffect(() => {
    // Just ensure we start fresh on boot
    setShapesRemaining(SHAPES_PER_PHASE);
    setPhaseTargetCount(SHAPES_PER_PHASE);
  }, []);

  const handleRestart = () => {
    setGameOver(false);
    setLives(3);
    setScore(0);
    setLevel(1);
    setPhaseIndex(0);
    setShapesRemaining(SHAPES_PER_PHASE);
    setIsTransitioning(false);
    setGameId(prev => prev + 1); // Hard reset canvas
  };

  // Progress Meter Calculation
  const progressPercentage = ((phaseTargetCount - shapesRemaining) / phaseTargetCount) * 100;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="relative w-full h-screen bg-geo-dark overflow-hidden text-white font-sans select-none">

      {/* SHAKE WRAPPER: Contains everything that should shake (Canvas + HUD) */}
      <div className={cn("absolute inset-0 w-full h-full", shake && "animate-shake")}>

        {/* Game Area */}
        <GameCanvas
          key={gameId} /* Force re-mount on hard reset */
          className="absolute top-0 left-0 w-full h-full"
          currentLevelShape={currentShape}
          onPlaceShape={handlePlaceShape}
          transitioning={isTransitioning}
          transitionMode={transitionMode}
          onTransitionEnd={onTransitionEnd}
          fixedRadius={currentRadius}
          targetMode={targetMode}
        />

        {/* HUD: Left (Info Stack) */}
        <div style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          zIndex: 50,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px'
        }}>
          {/* Line 1: Level */}
          <div className={cn("font-black tracking-tighter text-white", isShortScreen ? "text-xl" : "text-4xl")}>
            LEVEL {level}
          </div>

          {/* Line 2: Stage */}
          <div className={cn("font-bold text-slate-400 tracking-wider", isShortScreen ? "text-[10px]" : "text-sm")}>
            STAGE {phaseIndex + 1} / {TOTAL_PHASES}
          </div>

        </div>

        {/* HUD: Bottom Left (Meter) */}
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
          zIndex: 50,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* Large Radial Meter */}
          <div style={{
            position: 'relative',
            width: isShortScreen ? '64px' : '96px',
            height: isShortScreen ? '64px' : '96px',
            /* Removed display:flex here to rely purely on absolute positioning */
          }}>
            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 60 60" style={{ top: 0, left: 0 }}>
              {/* Track */}
              <circle
                cx="30" cy="30" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="4"
              />
              {/* Progress */}
              <circle
                cx="30" cy="30" r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={cn("transition-all duration-300 drop-shadow-[0_0_10px_currentColor]", isNestPhase ? "text-purple-400" : "text-cyan-400")}
              />
            </svg>
            {/* Counter inside meter */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <span className={cn("font-black text-white", isShortScreen ? "text-xl" : "text-3xl")}>{shapesRemaining}</span>
            </div>
          </div>
        </div>

        {/* HUD: Right (Lives, Score) */}
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '32px',
          zIndex: 50,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px'
        }}>
          <div className={cn("font-mono text-cyan-400 opacity-90 whitespace-nowrap", isShortScreen ? "text-lg" : "text-2xl md:text-3xl")}>
            {score.toString().padStart(6, '0')}
          </div>
          <div className="flex gap-1.5 align-middle items-center">
            {/* Render Full Hearts */}
            {[...Array(lives)].map((_, i) => (
              <span
                key={`life-${i}`}
                className="transition-all drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                style={{
                  fontSize: '56px',
                  color: '#ef4444',
                  lineHeight: 1,
                  WebkitTextStroke: '6px white',
                  paintOrder: 'stroke fill'
                }}
              >
                ♥
              </span>
            ))}
            {/* Render Lost Hearts */}
            {[...Array(3 - lives)].map((_, i) => (
              <span
                key={`lost-${i}`}
                className="transition-all"
                style={{ fontSize: '56px', color: '#334155', lineHeight: 1 }}
              >
                ♡
              </span>
            ))}
          </div>
        </div>

        {/* Mode Indicator & Version Number (Bottom Right) */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          zIndex: 40,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px'
        }}>
          {/* Visual Mode Indicator */}
          <div style={{ width: '120px', height: '120px', opacity: 0.8 }}>
            <ModeVisual
              mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'}
              shapeType={currentShape}
              shapesRemaining={shapesRemaining}
              size="100%"
            />
          </div>

          {/* Version */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            color: 'rgba(148, 163, 184, 0.5)'
          }}>
            v1.7.2
          </div>
        </div>
      </div> {/* End Shake Wrapper */}

      {/* STATIC OVERLAYS: These sit ON TOP and do NOT shake */}

      {/* Instructions / Context */}


      {/* Level Intro Animation */}
      <LevelSplash
        key={`${level}-${gameId}`}
        level={level}
        mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'}
        shapeType={currentShape}
        shapesRemaining={shapesRemaining}
      />

      {/* Mid-Level Mode Switch Splash */}
      {/* This triggers on every new phase (except 0 which has Level Intro), showing the Next Shape and Mode */}
      {
        phaseIndex > 0 && shapesRemaining === phaseTargetCount && !isTransitioning && (
          <LevelSplash
            key={`mode-switch-${level}-${phaseIndex}`}
            title={`STAGE ${phaseIndex + 1}`}
            mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'}
            shapeType={currentShape}
            shapesRemaining={shapesRemaining}
          />
        )
      }

      {/* Game Over Failure Overlay */}
      {isTransitioning && transitionMode === 'failure' && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          <div style={{ animation: 'fade-in 1.5s ease-out forwards' }}>
            <h1
              className="font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
              style={{ fontSize: '10vw', lineHeight: 1, margin: 0, textAlign: 'center' }}
            >
              GAME OVER!
            </h1>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {
        gameOver && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-8 animate-fade-in text-center">
            <h2 className="text-6xl font-black text-white mb-2 tracking-tighter">GAME OVER</h2>
            <p className="text-xl text-slate-400 mb-8">You reached Level {level}</p>

            <div className="text-4xl font-mono text-cyan-400 mb-12 border-b-2 border-cyan-400/30 pb-4 px-8">
              {score.toString().padStart(6, '0')}
            </div>

            <button
              onClick={handleRestart}
              className="bg-white text-black px-8 py-3 rounded font-bold hover:scale-105 active:scale-95 transition-transform pointer-events-auto"
            >
              TRY AGAIN
            </button>
          </div>
        )
      }

    </div >
  );
}

export default App;
