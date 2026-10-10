# Custom Audio Assets Inventory (M4A / AAC)

This document catalogues all custom audio assets housed under `custom/assets/audio/`. These files are utilized by the `AudioArchitecture.js` incident and signal audio engines for authentic event playback, audio synthesis blending, and development inspection.

> **Notice on Version Control & Testing**:
> - These audio clips are designated as non-critical assets. Missing audio files trigger diagnostic console warnings or graceful fallbacks without terminating the game loop.
> - Gitignore includes `custom/assets/audio/**/*.m4a` to prevent untracked local waveform recordings or debug dumps from bloating the repository.
> - All required audio assets are validated via `tests/audio_architecture.test.js`. No additional unit tests are necessary for these files.

---

## 1. Ball Impact & Roll Sound Effects (`custom/assets/audio/ball_hit/`)

| File Path | Event / Subsystem | Description |
|---|---|---|
| `custom/assets/audio/ball_hit/vehicle-body-01.m4a` | `BALL_GROUND_HIT` (Soft/Medium) | Floor impact sound, low-to-medium impulse |
| `custom/assets/audio/ball_hit/vehicle-body-02.m4a` | `BALL_GROUND_HIT` (Medium/Hard) | Floor impact sound, medium-to-hard impulse |
| `custom/assets/audio/ball_hit/vehicle-body-03.m4a` | `BALL_GROUND_HIT` (Heavy) | Floor impact sound, high impulse |
| `custom/assets/audio/ball_hit/vehicle-body-04.m4a` | `CAR_BALL_HIT` / Car body hit | Ball to car chassis impact |
| `custom/assets/audio/ballrolling.m4a` | `BALL_SURFACE_ROLL` | Ball rolling loop on arena surface |
| `custom/assets/audio/ballflying.m4a` | `BALL_AERIAL_WHOOSH` | High-speed aerial ball flight whoosh |

---

## 2. Arena Boundary & Sidewall Impacts (`custom/assets/audio/sidewallhit/`)

| File Path | Event / Subsystem | Description |
|---|---|---|
| `custom/assets/audio/sidewallhit/SFX_Impacts_0200.m4a` | `BALL_WALL_HIT` / Sidewall | Wall impact sound variant 0 |
| `custom/assets/audio/sidewallhit/SFX_Impacts_0216.m4a` | `BALL_WALL_HIT` / Sidewall | Wall impact sound variant 1 |
| `custom/assets/audio/sidewallhit/SFX_Impacts_0259.m4a` | `BALL_WALL_HIT` / Sidewall | Wall impact sound variant 2 |
| `custom/assets/audio/sidewallhit/SFX_Impacts_0378.m4a` | `BALL_WALL_HIT` / Sidewall | Wall impact sound variant 3 |
| `custom/assets/audio/sidewallhit/SFX_Impacts_0627.m4a` | `BALL_WALL_HIT` / Sidewall | Wall impact sound variant 4 |

---

## 3. Vehicle & Gameplay State SFX (`custom/assets/audio/`)

| File Path | Event / Subsystem | Description |
|---|---|---|
| `custom/assets/audio/sfx_car_collision.m4a` | `CAR_CAR_COLLISION` | Vehicular collision impact sound |
| `custom/assets/audio/boost_collect.m4a` | `BOOST_PAD_PICKUP` | Boost pad pickup confirmation tone |
| `custom/assets/audio/sfx_error_no_boost.m4a` | `BOOST_EMPTY` | Empty boost warning chirp |
| `custom/assets/audio/sfx_state_supersonic.m4a` | `SUPERSONIC_ENTER` / State | Supersonic threshold sonic boom / state loop |
| `custom/assets/audio/sfx_goal_poof.m4a` | `GOAL_SCORED` | Goal explosion and score chime |

---

## 4. Match Signals & Whistles (`custom/assets/audio/`)

| File Path | Event / Subsystem | Description |
|---|---|---|
| `custom/assets/audio/match_countdown_321.m4a` | `MATCH_COUNTDOWN` | Pre-match countdown tick (3, 2, 1) |
| `custom/assets/audio/match_start_go.m4a` | `MATCH_KICKOFF` | Kickoff horn / start signal |
| `custom/assets/audio/match_30_seconds_left.m4a` | `MATCH_30S_ALERT` | Match warning tone at 30 seconds remaining |
| `custom/assets/audio/match_entering_overtime.m4a` | `MATCH_OVERTIME` | Overtime announcement signal |
