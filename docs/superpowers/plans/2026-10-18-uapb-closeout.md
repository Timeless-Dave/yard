# UAPB closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining high-impact UAPB audit items in one parallel pass: walkable arches, more documented interiors, map-aligned activity spots, obstruction-aware camera, and grouped HUD.

**Architecture:** Specialists own exclusive files so they can run at the same time. Parent session wires `src/main.js` after they return. No photoreal rebuild, no new campus, no claimed Google Earth verification unless imagery is actually inspected.

**Tech Stack:** Vite, Three.js, existing Firebase client, Vitest, Playwright world/experience tests.

## Global Constraints

- UAPB only. Do not re-enable Grambling switching.
- Square HUD (`border-radius: 0` on buttons/chips/modals). Analog stick stays round.
- No em-dashes. No slogan copy. Disclose illustrative interiors.
- OSM snapshot remains source of geometry. Do not invent roads.
- Do not commit unless asked. Do not edit files outside your owner list.
- Prefer tests first for physics/camera. Run `npm test` after your files change.

## File owners (parallel wave)

| Track | Model | Own these files only |
|---|---|---|
| A Arch collision | Claude Opus 4.7 | `src/buildings.js`, `tests/unit/world.test.js` (append only) |
| B Interiors | Claude Sonnet 5.5 | `src/interiors.js` |
| C Map spots | Gemini 3.1 Pro | `src/campusData.uapb.js`, `src/seasonal.js`, `docs/references/README.md` |
| D Camera | GPT-5.6 | `src/cameraController.js` (new), `tests/unit/camera.test.js` (new) |
| E HUD groups | Muse Wonder | `src/experience.js`, `index.html`, `src/style.css` |

Parent later: `src/main.js`, `src/multiplayer.js` if room-id is a one-line presence field.

## Out of this wave

- Photoreal glTF characters
- Per-room Firebase schema + rules rewrite
- Real-device GPU profiling
- Google Earth claims without a successful visual inspect

---

### Track A: Bell Tower arch and stadium stands

- [ ] Keep the tower walk-through at the open base. Do not block the arch with a solid AABB.
- [ ] Author `userData.collider` polygons or multiple boxes for piers, not the void.
- [ ] Stadium: collide stands/press box, keep field walkable.
- [ ] Unit test: point in arch is clear; pier is blocked; field center is clear.

### Track B: Documented interiors only

- [ ] Keep Union + library. Add at most two more rooms if a public photo/source exists (Caldwell lobby or HPER lobby). Otherwise improve Union/library furniture collision and signs.
- [ ] `interiorType()` remains the only API `main.js` needs.
- [ ] Label illustrative vs photo-referenced in room copy.

### Track C: Relocate fictional spots

- [ ] Export `ACTIVITY_SPOTS` from `campusData.uapb.js` with x/z next to real buildings (union lawn, library quad, bell tower plaza). Include keys used in `main.js`: cards, stepshow, dominoes, doubledutch, hopscotch, boombox, pager, cookout, photobooth, king, billboards, community.
- [ ] Shift `PARTY_SPOTS` / `RETAIL_NEAR_UNION` / `VENDING_SPOTS` off building interiors using imported footprints.
- [ ] Note confidence in `docs/references/README.md`. Seasonal props stay fictional but not inside walls.

### Track D: Camera controller

- [ ] New module: `{ yaw, zoom, offsetFor(room), damp(dt), obstruct(origin, target, raycast) }` with named presets close/follow/overview.
- [ ] Persist yaw/zoom keys already used. Do not import `main.js`.
- [ ] Unit tests for clamp, shortest-angle, and a fake ray hit pulling camera closer.

### Track E: HUD grouping

- [ ] Explore UAPB menu: four headings Explore / Play / Community / Settings. Keep existing `data-modal` ids.
- [ ] Keep square buttons. Do not restore pills or emoji spam.
- [ ] Tests in `tests/e2e/experience.mjs` still find `.yard-menu summary`, `#enter-yard`, `#night-toggle`, `[data-modal="cards"]`.
