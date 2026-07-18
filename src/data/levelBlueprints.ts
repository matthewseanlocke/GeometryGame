import type { ShapeType } from '../utils/geometry'

type LevelsIndexFile = {
  order: string[]
}

type RawStageBlueprint = {
  mode: 'inside' | 'outside'
  targetCount: number
  sizeScale: number
  shapeType?: ShapeType
  colorMode?: 'random' | 'fixed' | 'palette'
  color?: string
  palette?: string[]
}

type RawLevelBlueprint = {
  id: string
  name: string
  description?: string
  tags?: string[]
  stages: RawStageBlueprint[]
}

export type StageBlueprint = {
  mode: 'inside' | 'outside'
  targetCount: number
  sizeScale: number
  shapeType: ShapeType
  colorMode: 'random' | 'fixed' | 'palette'
  color?: string
  palette?: string[]
}

export type LevelBlueprint = {
  id: string
  name: string
  description?: string
  tags: string[]
  stages: StageBlueprint[]
}

const DEFAULT_SHAPES: ShapeType[] = ['circle', 'hexagon', 'triangle', 'square', 'heart']

function normalizeStage(stage: RawStageBlueprint, levelIndex: number): StageBlueprint {
  return {
    mode: stage.mode,
    targetCount: Math.max(1, Math.round(stage.targetCount)),
    sizeScale: Math.max(0.2, stage.sizeScale),
    shapeType: stage.shapeType ?? DEFAULT_SHAPES[levelIndex % DEFAULT_SHAPES.length],
    colorMode: stage.colorMode ?? 'random',
    color: stage.color,
    palette: stage.palette,
  }
}

function normalizeLevel(level: RawLevelBlueprint, levelIndex: number): LevelBlueprint {
  return {
    id: level.id,
    name: level.name,
    description: level.description,
    tags: level.tags ?? [],
    stages: (level.stages ?? []).map(stage => normalizeStage(stage, levelIndex)),
  }
}

export function loadLevelBlueprints(): LevelBlueprint[] {
  const levelModules = import.meta.glob('./levels/*.json', { eager: true, import: 'default' }) as Record<string, unknown>
  const indexFile = levelModules['./levels/index.json'] as LevelsIndexFile | undefined

  const byId = new Map<string, LevelBlueprint>()

  Object.entries(levelModules).forEach(([path, rawValue], fileIndex) => {
    if (path.endsWith('/index.json')) return
    const rawLevel = rawValue as RawLevelBlueprint
    if (!rawLevel?.id || !Array.isArray(rawLevel.stages) || rawLevel.stages.length === 0) return
    byId.set(rawLevel.id, normalizeLevel(rawLevel, fileIndex))
  })

  const orderedLevels = (indexFile?.order ?? [])
    .map(levelId => byId.get(levelId))
    .filter((level): level is LevelBlueprint => Boolean(level))

  if (orderedLevels.length > 0) return orderedLevels

  return Array.from(byId.values())
}

export const LEVEL_BLUEPRINTS = loadLevelBlueprints()
