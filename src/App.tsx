import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { LevelSplash } from './components/LevelSplash';
import { ModeVisual } from './components/ModeVisual';
import { AudioSpritePlayer } from './audio/AudioSpritePlayer';
import { soundManifest } from './audio/soundManifest';
import { LEVEL_BLUEPRINTS } from './data/levelBlueprints';
import { POTENTIAL_LEVEL_BLUEPRINTS } from './data/potentialLevelBlueprints';
import type { LevelBlueprint } from './data/levelBlueprints';
import type { PlacementResult, Shape, ShapeType } from './utils/geometry';
import { Coffee, Heart, Volume2, VolumeX } from 'lucide-react';
import { cn } from './utils/cn';

const TOTAL_PHASES = 6;
const PHASE_RADII = [140, 115, 95, 75, 55, 40];
const SHAPES: ShapeType[] = ['circle', 'hexagon', 'triangle', 'square', 'heart'];
const STUDIO_DRAFT_KEY = 'geometry-game-studio-draft-v1';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/matthewseanwallace';

type AppMode = 'menu' | 'game' | 'test-loader' | 'studio-config' | 'studio-canvas';

type StudioDraft = {
  updatedAt: number;
  settings: {
    shape: ShapeType;
    radius: number;
    colorMode: 'random' | 'fixed' | 'palette';
    color: string;
    palette: string[];
  };
  shapes: Shape[];
};

function getStartingLevelFromQuery(): number {
  if (typeof window === 'undefined') return 1;
  const rawLevel = new URLSearchParams(window.location.search).get('level');
  const parsedLevel = Number(rawLevel);
  if (!Number.isInteger(parsedLevel) || parsedLevel < 1) return 1;
  return parsedLevel;
}

function getInitialAppModeFromQuery(): AppMode {
  return 'menu';
}

function readStudioDraftFromStorage(): StudioDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STUDIO_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudioDraft;
  } catch {
    return null;
  }
}

function buildStudioUrl(view: 'config' | 'canvas'): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('studio', view);
  return url.toString();
}

function sanitizeFileBaseName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'potential-level-draft';
}

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getFallbackStage(level: number, phaseIndex: number) {
  return {
    mode: phaseIndex % 2 === 0 ? ('outside' as const) : ('inside' as const),
    targetCount: 6,
    sizeScale: 1,
    shapeType: SHAPES[(level - 1) % SHAPES.length],
    colorMode: 'random' as const,
    color: undefined,
    palette: undefined,
  };
}

function getLevelBlueprintFor(level: number) {
  return LEVEL_BLUEPRINTS[(level - 1) % Math.max(1, LEVEL_BLUEPRINTS.length)];
}

function getStageFor(level: number, phaseIndex: number) {
  return getLevelBlueprintFor(level)?.stages[phaseIndex] ?? getFallbackStage(level, phaseIndex);
}

function getCircuitNumber(level: number): number {
  return Math.floor((level - 1) / SHAPES.length) + 1;
}

function getPlacementsPerStage(level: number): number {
  return getCircuitNumber(level) + 2;
}

function App() {
  const startingLevel = useMemo(() => getStartingLevelFromQuery(), []);
  const initialAppMode = useMemo(() => getInitialAppModeFromQuery(), []);
  const audioPlayer = useMemo(() => new AudioSpritePlayer(soundManifest), []);

  const [appMode, setAppMode] = useState<AppMode>(initialAppMode);
  const [level, setLevel] = useState(startingLevel);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [testLevelId, setTestLevelId] = useState<string | null>(null);
  const [testSelectedLevelId, setTestSelectedLevelId] = useState<string>('');
  const [shapesRemaining, setShapesRemaining] = useState(() => getPlacementsPerStage(startingLevel));
  const [phaseTargetCount, setPhaseTargetCount] = useState(() => getPlacementsPerStage(startingLevel));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMode, setTransitionMode] = useState<'success' | 'failure'>('success');
  const [shake, setShake] = useState(false);
  const [heartRewardKey, setHeartRewardKey] = useState(0);
  const [isHeartRewardVisible, setIsHeartRewardVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedIntroKey, setDismissedIntroKey] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [isShortScreen, setIsShortScreen] = useState(false);
  const [viewportMin, setViewportMin] = useState(900);
  const completedStageRef = useRef<string | null>(null);

  const [studioShape, setStudioShape] = useState<ShapeType>('hexagon');
  const [studioRadius, setStudioRadius] = useState(58);
  const [studioColorMode, setStudioColorMode] = useState<'random' | 'fixed' | 'palette'>('random');
  const [studioColor, setStudioColor] = useState('#22d3ee');
  const [studioPaletteInput, setStudioPaletteInput] = useState('#22d3ee, #a78bfa, #f43f5e');
  const [studioShapes, setStudioShapes] = useState<Shape[]>([]);
  const [studioClearSignal, setStudioClearSignal] = useState(0);
  const [studioUndoSignal, setStudioUndoSignal] = useState(0);
  const [studioLoadSignal, setStudioLoadSignal] = useState(0);
  const [studioLoadedShapes, setStudioLoadedShapes] = useState<Shape[]>([]);
  const [studioExportJson, setStudioExportJson] = useState('');
  const [studioDraftName, setStudioDraftName] = useState('my-potential-level');
  const [studioSaveMessage, setStudioSaveMessage] = useState('');

  const testLevelBlueprint = useMemo(() => {
    if (!testLevelId) return null;
    return POTENTIAL_LEVEL_BLUEPRINTS.find(levelItem => levelItem.id === testLevelId) ?? null;
  }, [testLevelId]);

  const isTestRun = appMode === 'game' && Boolean(testLevelBlueprint);
  const activeLevelBlueprint: LevelBlueprint | undefined = testLevelBlueprint ?? getLevelBlueprintFor(level);
  const activeStage = activeLevelBlueprint?.stages[phaseIndex] ?? getStageFor(level, phaseIndex);
  const targetMode = activeStage.mode;
  const isNestPhase = targetMode === 'inside';
  const currentShape = activeStage.shapeType;
  const stageSizeScale = activeStage.sizeScale ?? 1;
  const phaseCount = activeLevelBlueprint?.stages.length ?? TOTAL_PHASES;
  const circuitNumber = getCircuitNumber(level);
  const circuitPosition = ((level - 1) % SHAPES.length) + 1;
  const placementsPerStage = isTestRun ? activeStage.targetCount : getPlacementsPerStage(level);
  const introKey = level + ':' + phaseIndex + ':' + gameId;
  const effectiveTestSelectedLevelId = POTENTIAL_LEVEL_BLUEPRINTS.some(levelItem => levelItem.id === testSelectedLevelId)
    ? testSelectedLevelId
    : (POTENTIAL_LEVEL_BLUEPRINTS[0]?.id ?? '');

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const minDim = Math.min(w, h);
      setViewportMin(minDim);
      setIsShortScreen(h < 500 && w > h);

      if (minDim < 380) setScaleFactor(0.35);
      else if (minDim < 430) setScaleFactor(0.45);
      else if (minDim < 520) setScaleFactor(0.58);
      else if (minDim < 700) setScaleFactor(0.72);
      else if (minDim < 900) setScaleFactor(1.0);
      else if (minDim < 1200) setScaleFactor(1.1);
      else setScaleFactor(1.2);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLifeLost = useCallback(() => {
    audioPlayer.play(lives <= 1 ? 'gameOver' : 'lifeLost');
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setTransitionMode('failure');
        setIsTransitioning(true);
      }
      return newLives;
    });
    setShake(false);
    setTimeout(() => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }, 10);
  }, [audioPlayer, lives]);

  const completePhase = useCallback(() => {
    if (phaseIndex < phaseCount - 1) {
      const nextPhase = phaseIndex + 1;
      const nextStage = activeLevelBlueprint?.stages[nextPhase] ?? getStageFor(level, nextPhase);
      const nextTargetCount = isTestRun ? nextStage.targetCount : placementsPerStage;
      setShapesRemaining(nextTargetCount);
      setPhaseTargetCount(nextTargetCount);
      setPhaseIndex(nextPhase);
      return;
    }

    audioPlayer.play('levelComplete');

    if (lives < 3) {
      setTimeout(() => {
        setLives(prev => Math.min(3, prev + 1));
        setHeartRewardKey(prev => prev + 1);
        setIsHeartRewardVisible(true);
        audioPlayer.play('heartEarned');
        setTimeout(() => setIsHeartRewardVisible(false), 1800);
      }, 1000);
    }

    setTransitionMode('success');
    setTimeout(() => setIsTransitioning(true), 10);
  }, [activeLevelBlueprint, audioPlayer, isTestRun, level, lives, phaseCount, phaseIndex, placementsPerStage]);

  const handlePlaceShape = useCallback((result: PlacementResult) => {
    setDismissedIntroKey(introKey);
    if (isTransitioning) return;

    if (result === targetMode) {
      audioPlayer.playStageNote(phaseIndex);
      const points = isNestPhase ? 50 : 20;
      setScore(s => s + points);
      setShapesRemaining(prev => Math.max(0, prev - 1));
      return;
    }

    handleLifeLost();
  }, [audioPlayer, handleLifeLost, introKey, isNestPhase, isTransitioning, phaseIndex, targetMode]);

  useEffect(() => {
    if (shapesRemaining > 0 || isTransitioning) return;

    const stageKey = `${gameId}:${isTestRun ? testLevelId : level}:${phaseIndex}`;
    if (completedStageRef.current === stageKey) return;

    completedStageRef.current = stageKey;
    queueMicrotask(completePhase);
  }, [completePhase, gameId, isTestRun, isTransitioning, level, phaseIndex, shapesRemaining, testLevelId]);
  const onTransitionEnd = useCallback(() => {
    setIsTransitioning(false);

    if (isTestRun) {
      setAppMode('test-loader');
      setTestLevelId(null);
      setPhaseIndex(0);
      setShapesRemaining(activeLevelBlueprint?.stages[0]?.targetCount ?? 6);
      setPhaseTargetCount(activeLevelBlueprint?.stages[0]?.targetCount ?? 6);
      setGameId(prev => prev + 1);
      return;
    }

    if (transitionMode === 'failure') {
      setAppMode('menu');
      setIsHeartRewardVisible(false);
      setLevel(1);
      setPhaseIndex(0);
      setScore(0);
      setLives(3);
      const startingTargetCount = getPlacementsPerStage(1);
      setShapesRemaining(startingTargetCount);
      setPhaseTargetCount(startingTargetCount);
      setGameId(prev => prev + 1);
      return;
    }

    const nextLevel = level + 1;
    setLevel(nextLevel);
    setPhaseIndex(0);
    const nextTargetCount = getPlacementsPerStage(nextLevel);
    setShapesRemaining(nextTargetCount);
    setPhaseTargetCount(nextTargetCount);
    setGameId(prev => prev + 1);
  }, [activeLevelBlueprint, isTestRun, level, transitionMode]);

  const startGame = () => {
    void audioPlayer.unlock();
    setTestLevelId(null);
    setAppMode('game');
    setIsTransitioning(false);
    const targetCount = getPlacementsPerStage(level);
    setShapesRemaining(targetCount);
    setPhaseTargetCount(targetCount);
  };


  const startPotentialTestLevel = (levelId: string) => {
    const blueprint = POTENTIAL_LEVEL_BLUEPRINTS.find(levelItem => levelItem.id === levelId);
    if (!blueprint) return;

    setTestLevelId(levelId);
    setLevel(1);
    setPhaseIndex(0);
    setLives(3);
    setScore(0);
    setIsTransitioning(false);
    setShapesRemaining(blueprint.stages[0]?.targetCount ?? 6);
    setPhaseTargetCount(blueprint.stages[0]?.targetCount ?? 6);
    setGameId(prev => prev + 1);
    setAppMode('game');
  };

  const openStudioCanvas = () => {
    if (typeof window !== 'undefined') {
      window.open(buildStudioUrl('canvas'), '_blank', 'noopener,noreferrer');
    }
  };

  const backToMenu = () => {
    setAppMode('menu');
    setTestLevelId(null);
    setIsTransitioning(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };


  const studioPalette = studioPaletteInput
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const applyStudioDraft = useCallback((draft: StudioDraft) => {
    setStudioShape(draft.settings.shape);
    setStudioRadius(draft.settings.radius);
    setStudioColorMode(draft.settings.colorMode);
    setStudioColor(draft.settings.color);
    setStudioPaletteInput((draft.settings.palette ?? []).join(', '));
    setStudioLoadedShapes(draft.shapes ?? []);
    setStudioLoadSignal(prev => prev + 1);
    setStudioShapes(draft.shapes ?? []);
  }, []);

  useEffect(() => {
    if (appMode !== 'studio-config' && appMode !== 'studio-canvas') return;
    const draft = readStudioDraftFromStorage();
    if (draft) {
      queueMicrotask(() => applyStudioDraft(draft));
    }
  }, [appMode, applyStudioDraft]);

  useEffect(() => {
    if (appMode !== 'studio-config' && appMode !== 'studio-canvas') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STUDIO_DRAFT_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as StudioDraft;
        applyStudioDraft(parsed);
      } catch {
        // Ignore malformed storage payloads
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [appMode, applyStudioDraft]);

  useEffect(() => {
    if (appMode !== 'studio-config') return;
    const existing = readStudioDraftFromStorage();
    const draft: StudioDraft = {
      updatedAt: Date.now(),
      settings: {
        shape: studioShape,
        radius: studioRadius,
        colorMode: studioColorMode,
        color: studioColor,
        palette: studioPalette,
      },
      shapes: existing?.shapes ?? [],
    };
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
  }, [appMode, studioColor, studioColorMode, studioPalette, studioRadius, studioShape]);

  useEffect(() => {
    if (appMode !== 'studio-canvas') return;
    const existing = readStudioDraftFromStorage();
    const draft: StudioDraft = {
      updatedAt: Date.now(),
      settings: {
        shape: studioShape,
        radius: studioRadius,
        colorMode: studioColorMode,
        color: studioColor,
        palette: studioPalette,
      },
      shapes: studioShapes,
    };

    if (existing && JSON.stringify(existing.shapes) === JSON.stringify(studioShapes)) return;
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
  }, [appMode, studioColor, studioColorMode, studioPalette, studioRadius, studioShape, studioShapes]);

  const buildStudioDraft = useCallback((shapesOverride?: Shape[]): StudioDraft => {
    return {
      updatedAt: Date.now(),
      settings: {
        shape: studioShape,
        radius: studioRadius,
        colorMode: studioColorMode,
        color: studioColor,
        palette: studioPalette,
      },
      shapes: shapesOverride ?? studioShapes,
    };
  }, [studioColor, studioColorMode, studioPalette, studioRadius, studioShape, studioShapes]);

  const saveStudioDraft = () => {
    const draft = buildStudioDraft();
    const serializedDraft = JSON.stringify(draft, null, 2);
    localStorage.setItem(STUDIO_DRAFT_KEY, serializedDraft);
    setStudioExportJson(JSON.stringify(draft, null, 2));

    downloadTextFile(`${sanitizeFileBaseName(studioDraftName)}.json`, serializedDraft);
    setStudioSaveMessage(`Downloaded file: ${sanitizeFileBaseName(studioDraftName)}.json`);
  };

  const loadStudioDraft = () => {
    const parsed = readStudioDraftFromStorage();
    if (!parsed) return;
    applyStudioDraft(parsed);
    setStudioExportJson(JSON.stringify(parsed, null, 2));
  };

  const exportStudioLayout = () => {
    const exportPayload = {
      version: 1,
      type: 'geometry-layout',
      settings: {
        shape: studioShape,
        radius: studioRadius,
        colorMode: studioColorMode,
        color: studioColor,
        palette: studioPalette,
      },
      shapes: studioShapes,
    };
    setStudioExportJson(JSON.stringify(exportPayload, null, 2));
  };

  const downloadPotentialLevelJson = () => {
    const levelId = sanitizeFileBaseName(studioDraftName);
    const generatedLevel = {
      id: levelId,
      name: studioDraftName.trim() || 'Potential Level',
      description: 'Generated from Studio settings',
      tags: ['potential', 'generated'],
      stages: [
        {
          mode: 'outside' as const,
          targetCount: Math.max(1, studioShapes.length || 6),
          sizeScale: Math.max(0.2, Math.min(1.4, studioRadius / PHASE_RADII[0])),
          shapeType: studioShape,
          colorMode: studioColorMode,
          color: studioColorMode === 'fixed' ? studioColor : undefined,
          palette: studioColorMode === 'palette' ? studioPalette : undefined,
        },
      ],
    };

    const serialized = JSON.stringify(generatedLevel, null, 2);
    downloadTextFile(`${levelId}.json`, serialized);
    setStudioExportJson(serialized);
    setStudioSaveMessage(`Downloaded test level file: ${levelId}.json`);
  };

  const clearStudio = () => {
    const nextShapes: Shape[] = [];
    setStudioShapes(nextShapes);
    setStudioLoadedShapes(nextShapes);
    setStudioLoadSignal(prev => prev + 1);
    setStudioClearSignal(prev => prev + 1);
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(buildStudioDraft(nextShapes)));
  };

  const undoStudio = () => {
    const nextShapes = studioShapes.slice(0, -1);
    setStudioShapes(nextShapes);
    setStudioLoadedShapes(nextShapes);
    setStudioLoadSignal(prev => prev + 1);
    setStudioUndoSignal(prev => prev + 1);
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(buildStudioDraft(nextShapes)));
  };

  const startOverStudio = () => {
    setStudioShape('hexagon');
    setStudioRadius(58);
    setStudioColorMode('random');
    setStudioColor('#22d3ee');
    setStudioPaletteInput('#22d3ee, #a78bfa, #f43f5e');
    const nextShapes: Shape[] = [];
    setStudioShapes(nextShapes);
    setStudioLoadedShapes(nextShapes);
    setStudioLoadSignal(prev => prev + 1);
    setStudioExportJson('');
    setStudioClearSignal(prev => prev + 1);
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(buildStudioDraft(nextShapes)));
  };

  const progressPercentage = phaseTargetCount > 0
    ? ((phaseTargetCount - shapesRemaining) / phaseTargetCount) * 100
    : 0;
  const meterRadius = 24;
  const circumference = 2 * Math.PI * meterRadius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  const scaledRadius = (PHASE_RADII[phaseIndex] || 20) * scaleFactor * stageSizeScale;
  const mobileRadiusCap = viewportMin * 0.20;
  const currentRadius = Math.round(Math.min(scaledRadius, mobileRadiusCap));

  if (appMode === 'menu') {
    return (
      <main className="geometry-splash" aria-label="Geometry Game start screen">
        <div className="geometry-rain" aria-hidden="true">
          {['circle', 'triangle', 'square', 'hexagon', 'circle', 'square', 'triangle', 'hexagon'].map((shape, index) => (
            <span key={`${shape}-${index}`} className={`geometry-rain-shape geometry-rain-shape--${shape}`} />
          ))}
        </div>

        <button type="button" className="geometry-logo-button" onClick={startGame} aria-label="Play Geometry Game">
          <span className="geometry-logo-mark" aria-hidden="true">
            <span className="geometry-logo-orbit geometry-logo-orbit--outer" />
            <span className="geometry-logo-orbit geometry-logo-orbit--middle" />
            <span className="geometry-logo-orbit geometry-logo-orbit--inner" />
          </span>
          <span className="geometry-logo-title">GEOMETRY</span>
          <span className="geometry-logo-subtitle">GAME</span>
          <span className="geometry-logo-prompt">CLICK TO PLAY</span>
        </button>

        <a
          className="geometry-coffee-button"
          href={BUY_ME_A_COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy me a coffee"
          title="Buy me a coffee"
        >
          <Coffee aria-hidden="true" />
        </a>

        <button
          type="button"
          className="geometry-mute-button"
          onClick={() => {
            const nextMuted = !isMuted;
            audioPlayer.setMuted(nextMuted);
            setIsMuted(nextMuted);
          }}
          aria-label={isMuted ? 'Unmute game audio' : 'Mute game audio'}
          title={isMuted ? 'Unmute game audio' : 'Mute game audio'}
          aria-pressed={isMuted}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      </main>
    );
  }

  if (appMode === 'studio-config') {
    return (
      <div className="w-full h-screen bg-geo-dark text-white overflow-hidden p-4 md:p-8">
        <div className="max-w-2xl mx-auto rounded-2xl border border-slate-700 bg-slate-900/90 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={backToMenu} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Menu</button>
            <button onClick={openStudioCanvas} className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600">Open Canvas</button>
            <button onClick={saveStudioDraft} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Save Draft</button>
            <button onClick={downloadPotentialLevelJson} className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600">Download Test Level JSON</button>
            <button onClick={loadStudioDraft} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Load Draft</button>
            <button onClick={undoStudio} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Undo Last</button>
            <button onClick={clearStudio} className="px-3 py-2 rounded bg-rose-700 hover:bg-rose-600">Clear</button>
            <button onClick={startOverStudio} className="px-3 py-2 rounded bg-rose-700 hover:bg-rose-600">Start Over</button>
            <button onClick={exportStudioLayout} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Export JSON</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Draft file name</label>
              <input
                value={studioDraftName}
                onChange={e => setStudioDraftName(e.target.value)}
                className="w-full bg-slate-800 rounded px-2 py-2 text-sm"
                placeholder="potential-level-draft"
              />
            </div>
            <div className="text-xs text-slate-300 self-end pb-2">
              Use Save Draft for studio snapshots. Use Download Test Level JSON for playable test files.
            </div>
          </div>

          {studioSaveMessage && (
            <div className="text-xs text-slate-300 bg-slate-800/60 rounded px-2 py-2">{studioSaveMessage}</div>
          )}

          <div className="text-sm font-bold text-slate-300">Design Setup</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Shape</label>
              <select value={studioShape} onChange={e => setStudioShape(e.target.value as ShapeType)} className="w-full bg-slate-800 rounded px-2 py-2">
                {SHAPES.map(shape => <option key={shape} value={shape}>{shape}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Color mode</label>
              <select value={studioColorMode} onChange={e => setStudioColorMode(e.target.value as 'random' | 'fixed' | 'palette')} className="w-full bg-slate-800 rounded px-2 py-2">
                <option value="random">random</option>
                <option value="fixed">fixed</option>
                <option value="palette">palette</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Size ({studioRadius})</label>
            <input type="range" min={18} max={120} value={studioRadius} onChange={e => setStudioRadius(Number(e.target.value))} className="w-full" />
          </div>

          {studioColorMode === 'fixed' && (
            <div>
              <label className="block text-xs text-slate-300 mb-1">Fixed color</label>
              <input type="color" value={studioColor} onChange={e => setStudioColor(e.target.value)} className="w-full h-10 bg-slate-800 rounded" />
            </div>
          )}

          {studioColorMode === 'palette' && (
            <div>
              <label className="block text-xs text-slate-300 mb-1">Palette (comma separated)</label>
              <input
                value={studioPaletteInput}
                onChange={e => setStudioPaletteInput(e.target.value)}
                className="w-full bg-slate-800 rounded px-2 py-2 text-sm"
                placeholder="#22d3ee, #a78bfa"
              />
            </div>
          )}

          <div className="text-sm text-slate-300">Placed on canvas: <span className="font-semibold text-white">{studioShapes.length}</span></div>

          {studioExportJson && (
            <textarea value={studioExportJson} readOnly className="w-full h-52 bg-slate-950 rounded p-2 text-[11px] font-mono border border-slate-700" />
          )}
        </div>
      </div>
    );
  }

  if (appMode === 'test-loader') {
    return (
      <div className="w-full h-screen bg-geo-dark text-white overflow-hidden p-4 md:p-8">
        <div className="max-w-2xl mx-auto rounded-2xl border border-slate-700 bg-slate-900/90 p-4 md:p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={backToMenu} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">Menu</button>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Test Potential Levels</h2>

          {POTENTIAL_LEVEL_BLUEPRINTS.length === 0 ? (
            <div className="text-slate-300">No potential levels found in `src/data/potential-levels/`.</div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs text-slate-300">Select potential level</label>
              <select
                value={effectiveTestSelectedLevelId}
                onChange={e => setTestSelectedLevelId(e.target.value)}
                className="w-full bg-slate-800 rounded px-3 py-2"
              >
                {POTENTIAL_LEVEL_BLUEPRINTS.map(levelItem => (
                  <option key={levelItem.id} value={levelItem.id}>
                    {levelItem.name} ({levelItem.id})
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-400">
                Files are loaded from `src/data/potential-levels/`. If a file is not listed, verify it has `id`, `name`, and `stages`.
              </div>

              <button
                onClick={() => startPotentialTestLevel(effectiveTestSelectedLevelId)}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold"
              >
                Play Selected Level
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appMode === 'studio-canvas') {
    return (
      <div className="w-full h-screen bg-geo-dark text-white select-none overflow-hidden relative">
        <div className="relative w-full h-full">
          <GameCanvas
            className="absolute inset-0 w-full h-full"
            currentLevelShape={studioShape}
            fixedRadius={studioRadius}
            editorMode
            colorMode={studioColorMode}
            fixedColor={studioColor}
            palette={studioPalette}
            onShapesChange={setStudioShapes}
            clearSignal={studioClearSignal}
            undoSignal={studioUndoSignal}
            loadSignal={studioLoadSignal}
            loadedShapes={studioLoadedShapes}
          />
        </div>

      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-geo-dark overflow-hidden text-white font-sans select-none">
      <div className={cn('absolute inset-0 w-full h-full', shake && 'animate-shake')}>
        <GameCanvas
          key={gameId}
          className="absolute top-0 left-0 w-full h-full"
          currentLevelShape={currentShape}
          onPlaceShape={handlePlaceShape}
          transitioning={isTransitioning}
          transitionMode={transitionMode}
          onTransitionEnd={onTransitionEnd}
          fixedRadius={currentRadius}
          targetMode={targetMode}
          colorMode={activeStage.colorMode}
          fixedColor={activeStage.color}
          palette={activeStage.palette}
        />

        <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 50, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div className={cn('font-black tracking-tighter text-white', isShortScreen ? 'text-xl' : 'text-4xl')}>LEVEL {level}</div>
          <div className={cn('font-bold text-purple-300 tracking-wider', isShortScreen ? 'text-[10px]' : 'text-sm')}>CIRCUIT {circuitNumber}</div>
          <div className={cn('font-bold text-cyan-400/80 tracking-wider', isShortScreen ? 'text-[10px]' : 'text-sm')}>TYPE {circuitPosition} / {SHAPES.length}</div>
          <div className={cn('font-bold text-emerald-300/80 tracking-wider', isShortScreen ? 'text-[10px]' : 'text-sm')}>PER STAGE {placementsPerStage}</div>
          <div className={cn('font-bold text-slate-400 tracking-wider', isShortScreen ? 'text-[10px]' : 'text-sm')}>STAGE {phaseIndex + 1} / {phaseCount}</div>
        </div>

        <div style={{ position: 'absolute', bottom: '32px', left: '32px', zIndex: 50, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: isShortScreen ? '64px' : '96px', height: isShortScreen ? '64px' : '96px' }}>
            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 60 60" style={{ top: 0, left: 0 }}>
              <circle cx="30" cy="30" r={meterRadius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle
                cx="30"
                cy="30"
                r={meterRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={cn('transition-all duration-300 drop-shadow-[0_0_10px_currentColor]', isNestPhase ? 'text-purple-400' : 'text-cyan-400')}
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span className={cn('font-black text-white', isShortScreen ? 'text-xl' : 'text-3xl')}>{shapesRemaining}</span>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 50, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div className={cn('font-mono text-cyan-400 opacity-90 whitespace-nowrap', isShortScreen ? 'text-lg' : 'text-2xl md:text-3xl')}>
            {score.toString().padStart(6, '0')}
          </div>
          <div className="flex gap-1.5 align-middle items-center">
            {[...Array(lives)].map((_, i) => (
              <Heart
                key={`life-${i}`}
                aria-hidden="true"
                className="transition-all drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                size={isShortScreen ? 36 : 48}
                fill="#ef4444"
                color="#ffffff"
                strokeWidth={2.4}
              />
            ))}
            {[...Array(3 - lives)].map((_, i) => (
              <Heart
                key={`lost-${i}`}
                aria-hidden="true"
                className="transition-all"
                size={isShortScreen ? 36 : 48}
                fill="transparent"
                color="#334155"
                strokeWidth={2.4}
              />
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '8px', right: '8px', zIndex: 40, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{ width: '120px', height: '120px', opacity: 0.8 }}>
            <ModeVisual mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'} shapeType={currentShape} shapesRemaining={shapesRemaining} size="100%" />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '14px', color: 'rgba(148, 163, 184, 0.5)' }}>v1.21.3</div>
        </div>
      </div>


      {isHeartRewardVisible && (
        <div key={heartRewardKey} className="heart-reward" aria-live="polite">
          <Heart aria-hidden="true" className="heart-reward-icon" fill="#ef4444" color="#ffffff" strokeWidth={2.4} />
          <span>+1 LIFE</span>
        </div>
      )}
      {phaseIndex === 0 && dismissedIntroKey !== introKey && (
        <LevelSplash key={level + '-' + gameId} level={level} leadTitle={circuitPosition === 1 ? 'CIRCUIT ' + circuitNumber : undefined} mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'} shapeType={currentShape} shapesRemaining={shapesRemaining} />
      )}

      {phaseIndex > 0 && dismissedIntroKey !== introKey && shapesRemaining === phaseTargetCount && !isTransitioning && (
        <LevelSplash key={'mode-switch-' + level + '-' + phaseIndex} mode={isNestPhase ? 'INSIDE' : 'OUTSIDE'} shapeType={currentShape} shapesRemaining={shapesRemaining} />
      )}

      {isTransitioning && transitionMode === 'failure' && (
        <div style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, pointerEvents: 'none' }}>
          <div style={{ animation: 'fade-in 1.5s ease-out forwards' }}>
            <h1 className="font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]" style={{ fontSize: '10vw', lineHeight: 1, margin: 0, textAlign: 'center' }}>
              GAME OVER!
            </h1>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
