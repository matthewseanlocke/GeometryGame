import type { ShapeType } from '../utils/geometry'
import type { LevelBlueprint, StageBlueprint } from './levelBlueprints'

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

type RawStudioDraft = {
  updatedAt?: number
  settings?: {
    shape?: ShapeType
    radius?: number
    colorMode?: 'random' | 'fixed' | 'palette'
    color?: string
    palette?: string[]
  }
  shapes?: Array<{ type?: ShapeType }>
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

function pathToLevelId(path: string): string {
  const fileName = path.split('/').pop() ?? 'potential-level'
  return fileName.replace('.json', '')
}

function convertStudioDraftToLevel(rawDraft: RawStudioDraft, path: string): RawLevelBlueprint | null {
  if (!rawDraft?.settings) return null

  const levelId = pathToLevelId(path)
  const shapeType = rawDraft.settings.shape
  const colorMode = rawDraft.settings.colorMode ?? 'random'
  const shapeCount = Math.max(1, rawDraft.shapes?.length ?? 6)
  const radius = rawDraft.settings.radius ?? 58

  return {
    id: levelId,
    name: levelId.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
    description: 'Converted from Studio draft format',
    tags: ['potential', 'converted-draft'],
    stages: [
      {
        mode: 'outside',
        targetCount: shapeCount,
        sizeScale: Math.max(0.2, Math.min(1.4, radius / 140)),
        shapeType,
        colorMode,
        color: colorMode === 'fixed' ? rawDraft.settings.color : undefined,
        palette: colorMode === 'palette' ? rawDraft.settings.palette : undefined,
      },
    ],
  }
}

export function loadPotentialLevelBlueprints(): LevelBlueprint[] {
  const levelModules = import.meta.glob('./potential-levels/*.json', { eager: true, import: 'default' }) as Record<string, unknown>
  const indexFile = levelModules['./potential-levels/index.json'] as LevelsIndexFile | undefined

  const byId = new Map<string, LevelBlueprint>()

  Object.entries(levelModules).forEach(([path, rawValue], fileIndex) => {
    if (path.endsWith('/index.json')) return
    let rawLevel = rawValue as RawLevelBlueprint

    if (!rawLevel?.id || !Array.isArray(rawLevel.stages) || rawLevel.stages.length === 0) {
      const converted = convertStudioDraftToLevel(rawValue as RawStudioDraft, path)
      if (!converted) return
      rawLevel = converted
    }

    byId.set(rawLevel.id, normalizeLevel(rawLevel, fileIndex))
  })

  const orderedIds = indexFile?.order ?? []
  const orderedSet = new Set(orderedIds)

  const ordered = orderedIds
    .map(levelId => byId.get(levelId))
    .filter((level): level is LevelBlueprint => Boolean(level))

  const extra = Array.from(byId.values())
    .filter(level => !orderedSet.has(level.id))
    .sort((a, b) => a.id.localeCompare(b.id))

  return [...ordered, ...extra]
}

export const POTENTIAL_LEVEL_BLUEPRINTS = loadPotentialLevelBlueprints()
