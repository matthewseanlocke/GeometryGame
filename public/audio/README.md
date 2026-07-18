# Geometry Game sound sprite

All game sounds live in one replaceable file:

public/audio/geometry-game-sfx.wav

The readable cue names and timestamps are in:

src/audio/soundManifest.ts

| Cue | Purpose |
| --- | --- |
| correctPlacement | A shape is placed correctly |
| lifeLost | An invalid placement removes a heart |
| levelComplete | A level finishes while lives are already full |
| heartEarned | Level completion awards a heart |
| gameOver | The final heart is lost |

To replace the sounds, keep the WAV filename and update each cue's start and
duration values in the manifest. Leave a little silence between cues so the
timestamps remain easy to edit.

Correct placements use four synthesized stage notes defined by the stageNotes block in src/audio/soundManifest.ts. Their frequencies rise from Stage 1 through Stage 4 and can be edited directly.
