# UAPB product audit and implementation plan

Audit date: 2026-10-18. Scope: the checked-out application, source, local build, and browser-rendered desktop/phone flows. This is not an audit of a live Firebase deployment, real-device GPU performance, or verified campus geography.

## Verdict

The baseline is a feature-rich prototype, not a release-ready campus experience. It has accumulated activities faster than it has established a coherent core loop. Its strongest assets are the UAPB premise, existing geographic data, varied activity modules, and backend test infrastructure. Its weakest areas are embodiment, orientation, visual consistency, first-run clarity, and realistic release criteria.

UAPB must remain the only released campus. Grambling data can stay in the repository as dormant work; no second-campus rollout until the UAPB gates below pass. A prettier header does not satisfy those gates.

## Evidence and method

- Inspected `index.html`, `src/main.js`, camera/input/render loop, campus data/model dispatch, pedestrians, minimap, online presence, store, onboarding, service worker, test scripts, and CI.
- Captured the initial desktop view in `audit/before.png` before modifications.
- Exercised the new entry, camera buttons, character editing, reload persistence, movement-control collapse, activity menu, and overflow checks in Chromium desktop and emulated iPhone 14 / Pixel 7.
- Ran the unit suite and production build. Backend/emulator assertions in the README are prior project claims, not newly verified results from this audit.
- No interviews, campus walk-through, accessibility assistive-technology session, bandwidth lab, or frame-time trace was performed. Those are explicit follow-up tasks.

## Baseline inventory

Brand: gold `#f4b223`, black `#121212`, green `#0a5c2b`; system sans-serif; pill-shaped controls; emoji-heavy labels. Preserve the recognizable black-and-gold identity, campus names, and playful activity premise.

Information architecture: a single full-screen scene with approximately twenty header actions; generic modals for activities/auth; minimap; duplicated account conversion controls; timed announcements; first-run modal. No real landing page, destination search, or route selection.

Existing aesthetic: low layout variation, constant scene movement, very high control density. New direction: variance 5/10, motion 3/10, density 3/10. Native DOM/CSS remains the UI foundation; Three.js remains the scene engine. No framework migration is needed to solve the immediate problems.

Preserve the title/description/social metadata and deployment paths. Search ranking was not measured. Retire redundant sign-up calls, nonsemantic clickable divs, forced first-run wall of text, and always-visible activity rows.

## Severity-ranked findings

| ID | Severity | Finding and evidence | Consequence | Disposition |
|---|---|---|---|---|
| U01 | Critical | Player in `main.js` consisted of a capsule torso and sphere head | No convincing human silhouette or motion | Articulated procedural replacement delivered; production art remains open |
| U02 | High | Fixed `CAM_OFFSET`; no zoom or orbit UI | Players cannot inspect themselves or recover a useful view | Bounded zoom, orbit, reset, keyboard and screen controls delivered |
| U03 | High | About twenty `.chip-row` actions plus duplicate auth CTAs | Scene obstructed; no priority or progressive disclosure | Collapsible menu and compact HUD delivered |
| U04 | High | Mandatory onboarding modal sits over an already busy scene | Weak first impression, no focused start action | Dedicated scene-backed entry delivered |
| U05 | High | `updateAvatar` clamps coordinates only | Walking through buildings undermines the world | Substepped footprint collision delivered; authored special-model colliders remain open |
| U06 | High | Keyboard input had no typing guard or focus-loss reset | Movement can leak from UI input or stay held after blur | Typing guard, modal pause, blur/visibility reset delivered |
| U07 | High | Movement and turn/camera interpolation use fixed per-frame factors | Direction mismatches view; behavior varies with frame rate | Camera-relative motion and delta-time smoothing delivered |
| U08 | High | No editable avatar schema or gender/body/style choices | Players cannot express identity | Browser-local editor delivered; cloud sync, richer morphology, wardrobe remain open |
| U09 | High | Ambient NPCs repeat the capsule/sphere body | Population reads as markers rather than people | Shared humanoid generator and animated NPC limbs delivered; paths still decorative circles |
| U10 | High | Minimap is small colored points over a very long campus | Little useful orientation or destination discovery | Open: destination directory, labeled map, routing |
| U11 | High | Campus source explicitly says 0.35x and approximate footprints; old copy said real-scale | Authenticity overstated | Help copy corrected; campus verification remains open |
| U12 | High | New-campus switch existed before UAPB quality was established | Scope dilution | UAPB enforced as active campus; switching removed |
| U13 | High | Geometry, input, modal routing, weather, presence and UI share a large `main.js` | Expensive, risky iteration and poor isolation | Avatar, editor, shell, collision extracted; further decomposition open |
| U14 | High | Static Firebase imports ship in solo build | Unnecessary initial download/parse cost | Open: lazy online services and activity modules |
| U15 | Medium | Night ambient intensity falls to 0.22 before weather dimming | Character and scene details disappear | Higher baseline lighting delivered; calibrated day/night art pass open |
| U16 | High | Presence schema contains only name/color/position | Rich appearance cannot reach other players | Shared humanoid geometry delivered; no unsupported schema writes added |
| U17 | High | Modal scaffolding lacks consistent semantics, focus trapping and restoration | Keyboard users lose their place | Shared dialog preparation, Escape, focus wrap/restore delivered; full assistive-tech audit open |
| U18 | Medium | Old mobile tests assert a horizontally overflowing chip row and D-pad | Tests preserve undesirable UI rather than current intent | Updated experience suite; old entry point delegates to it |
| U19 | High | Service worker caches arbitrary same-origin GET responses; no explicit first-load offline fallback | Offline reliability and update behavior uncertain | Open: response validation, bounded caches, offline route and upgrade test |
| U20 | High | Store and online community features appear alongside local games in solo mode | Discovery leads to unavailable experiences | Accurate entry/help messaging delivered; capability-aware menu grouping open |
| U21 | High | Production readiness claims outstrip what local smoke checks prove | Passing builds mistaken for readiness | Release gates and explicit verification limits introduced |

Severity means user/release impact, not a claimed exploitable security vulnerability. The security subsystem needs its own preserved emulator run before deployment.

## First implementation pass delivered

1. UAPB-only entry and compact navigation, preserving existing game modules and backend data contracts.
2. On-screen analog movement with pointer capture, dead zone, collapse/expand, and cancellation; existing keyboard and gamepad routes remain.
3. Zoom buttons, wheel, +/− keys; Q/R rotation; reset button/0 key; bounds prevent unbounded zoom.
4. Shared human silhouette with arms, legs, shoes, eyes, ears, nose, hair and gait. Local player and ambient pedestrians animate; remote peers use the shared silhouette but still snap to network positions.
5. Reopenable editor: gender categories, independent build, hairstyle, skin/top colors, height, live rendered preview, save/cancel, local reload persistence. Gender never selects or restricts a body shape. This is not a complete morphology system; “Self-described” is currently only a category, not a free-text identity field.
6. Conservative building-footprint collision with substeps and wall sliding. Stadium is excluded because its data rectangle does not describe its walkable interior. This must not be advertised as full environment physics.
7. Input lifecycle and dialog-accessibility improvements, brighter lighting, and truthful solo/help copy.
8. New collision/appearance unit coverage and desktop/phone flow checks, plus updated existing multiplayer entry selectors.

## Sequential technical roadmap

### Phase 1: stabilize the UAPB core interaction loop

Dependencies: current first pass. Keep this phase ahead of new features.

- Extract input into an `InputController`: independent keyboard, analog pointer and gamepad vectors, a single normalized intent, modal/visibility gating, clean disposal. Remove synthetic keyboard duplication from gamepad D-pad handling.
- Extract camera into a `CameraController`: named close/follow/overview presets, yaw/zoom state, shortest-angle damping, camera obstruction raycasts, pinch gestures, user preference persistence.
- Define actual collision shapes alongside each building factory. Preserve doors and tower arches; model stadium stands independently. Add tree/prop colliders only where they improve traversal.
- Replace first-match interaction-zone selection with nearest eligible target plus hysteresis. Show destination/action title and enabled/disabled state. Disable or explain E when no target exists.
- Add a deterministic test scene and inspection API restricted to development/tests for position, yaw, camera distance, current zone, draw calls and frame time. Test outcomes, not just button clickability.
- Add a recovery action to return to a verified spawn. Make respawn respect collision and clear input.

Acceptance: ten-minute desktop/touch/controller sessions without stuck movement; no movement while typing/modal open; no tunnelling through authored colliders; consistent cardinal movement after all camera rotations; target prompts do not flicker at boundaries; focus returns after every close path.

### Phase 2: character art and identity

Dependencies: stable movement/camera and agreed visual reference sheet.

- Establish a stylized human art brief: proportions, face readability, clothing construction, lighting reference, broad skin-tone validation. Avoid treating gender as anatomy or clothing restrictions.
- Author a reusable rigged glTF model with locomotion clips (idle, walk, run, turn, interact, sit, wave). Blend clips by speed; handle starting/stopping and foot sliding. Procedural ellipsoids are the interim fallback.
- Add independently adjustable torso/shoulder/hip proportions and face presets; multiple textured hair families, including coils, locs, braids, twists and short styles. Audit clipping at every supported body extreme.
- Introduce `AvatarAppearanceV1`: bounded preset identifiers, colors, morphology values, optional private identity/preferences. Migrate local saves; retain a known-safe fallback for invalid/older data.
- Add cloud appearance only after Firestore/RTDB validation and multiplayer tests. Broadcast appearance only on change; never every movement frame. Identity does not need to be public by default.
- Introduce preview rotate controls, unsaved-change feedback, reset-to-default, undo, and self-described identity text if desired. Explicitly show what saves locally versus to an account.
- Add outfit slots and compatibility rules before linking store inventory to geometry. Do not sell color swatches as if they were modeled outfits.

Initial budgets to validate: at most 25k triangles for close player, <=8k distant LOD, compressed textures, bounded material count. These are proposed budgets, not measured current performance.

Acceptance: distinct readable silhouettes; no clothing/hair clipping across supported presets and clips; all appearance choices independent of gender; local/cloud migration/reload/reconnect tests; visual approval from representative UAPB users; remote peers see the saved appearance.

### Phase 3: campus legibility and authenticity

Dependencies: movement/collision foundation; authoritative reference collection.

- Create a provenance registry for every building, path, activity location, sign, storefront and landmark: source, date, confidence, real/stylized/fictional status.
- Validate Bell Tower, Student Union, library and connecting pedestrian routes first. Then expand to residence halls and athletics. Verify current tenant names before presenting them as factual.
- Replace generic repeated blocks through a coherent material library, correct silhouettes and building-specific roofs/windows/entrances. Keep licensed sources and asset attribution recorded.
- Build a destination directory with search and category filters. Use the same destination IDs for minimap, world signs, activity menu and routes.
- Add a walkable graph, route path rendering, distance/arrival feedback, and cancel/reselect behavior. A marker alone is not navigation.
- Replace NPC circles with paths and small idle groups at hubs. Label or style NPCs so they are not mistaken for live players.

Acceptance: five representative destinations found without instructions; verified routes stay on accessible ground; landmarks recognizable in user review; fictional activity placements clearly disclosed; no misleading institutional endorsement.

### Phase 4: UI and use-case completion

Dependencies: destination taxonomy and capability model.

- Group navigation into Explore, Play, Community and Settings. Surface only a few contextual shortcuts in the HUD.
- Provide capability-aware states: local games available immediately; online-only actions explain prerequisites before a modal dead end. Make connection/reconnection status honest.
- Create first-session choices: explore campus, customize character, or play an activity. Keep one primary start path and optional guidance.
- Audit each minigame independently: rules explanation, input instructions, start/restart/exit, difficulty, results, reward verification, offline behavior and accessible alternatives. Do not call basic card mechanics a full competitive game without rule review.
- Use a common dialog primitive with focus, close, scroll, loading, error and cleanup behavior. Remove duplicated inline styling and unused legacy markup.
- Add settings for volume, visual quality, camera speed, reduced motion and control hints. Extend the editor’s reduced-motion handling to all decorative scene motion.

Acceptance: usable at 320px width and landscape phone sizes; 44px primary touch targets; keyboard-only completion of entry/editor/menu/game flows; no hidden account entry on phones; no unavailable feature advertised as active.

### Phase 5: performance and resilience

Dependencies: profiling before optimization decisions.

- Capture renderer draw calls/triangles, frame time percentiles, JS heap and texture memory along a fixed campus route on target hardware.
- Lazy-load Firebase/account/community services and minigames; render a lightweight landing before constructing the whole world. Catch WebGL initialization/context-loss failures with a usable recovery screen.
- Share/instance repeated geometry and materials; use distance LOD/culling; update distant NPCs less frequently; throttle minimap redraws and projected name labels.
- Pause or reduce rendering in hidden tabs. Provide low/medium/high quality tiers based on a user setting plus conservative initial detection.
- Remove per-frame allocations where profiling shows pressure; resize shadows around visible play area rather than rendering irrelevant terrain.
- Fix service-worker cache lifecycle: cache only successful supported responses, finite versioned assets, offline fallback, safe update prompt and cache cleanup regression test.

Proposed gates: sustained >=30fps on agreed midrange mobile hardware and >=60fps on agreed desktop hardware; no repeated long tasks during movement; <=2.5s useful entry under agreed network conditions; no unbounded memory growth in 30 minutes. Record device/network/trace with each result. No present claim that these targets are met.

### Phase 6: online integration and launch rehearsal

Dependencies: phases 1–5; configured staging backend.

- Re-run security rules and callable integration tests; extend them for any appearance/identity schema before deployment.
- Test two actual clients for appearance, movement interpolation, disconnect/reconnect, names, chat, reporting, bans, wallet and duplicate reward handling.
- Review multiplayer movement authority and rate limits separately; numeric coordinate validation alone is not anti-cheat.
- Run purchase sandbox scenarios before enabling purchases. Keep purchases out of the critical campus exploration path.
- Test upgrade from existing local storage/service-worker versions; preserve accounts, inventory and saved progress.
- Pilot with UAPB students/alumni; log task completion, confusion, crashes and qualitative character/campus feedback. Resolve critical/high issues before increasing rollout.

Acceptance: signed release checklist with test evidence; no critical defects; agreed high defects resolved; reliable recovery; verified purchase flow if enabled; operational moderation and support coverage.

## UAPB release gate and expansion policy

UAPB is ready only when users can enter, customize, navigate to recognizable destinations, participate in working activities, and return without losing state, with the visual, accessibility, performance and online gates above satisfied. Track each phase as planned / in progress / verified with evidence links.

Only then consider another campus. Reuse the stable campus schema, destination graph, art pipeline and shared components. Do not copy UAPB-specific activities, organizations or geography blindly.

## Verification record for this pass

- Production build: passed. Bundle-size warnings remain: Three.js about 539 kB and Firebase about 715 kB minified (before compression); this is a real optimization backlog item.
- Unit tests: 48 passed, including collision tunnelling/sliding/bounds and appearance normalization/rig construction.
- Browser suite: desktop 1440×900, emulated iPhone 14, emulated Pixel 7; checks entry, camera actions, save/reopen/reload, collapsible movement, activity opening, overflow, uncaught errors. Screenshots in `docs/audit/`.
- These checks do not establish real touch-device performance, camera obstruction behavior, visual art approval, or gameplay balance.
- Full emulator/security/purchase suite was not rerun in this pass. Multiplayer test entry selectors were adapted to the new shell; online behavior remains a verification requirement.
- Nothing was deployed by this work.


## Execution update: physical world, map evidence and interiors (2026-10-18)

This update advances phases 1, 3, 4 and 5. It does not mark the entire roadmap complete.

### New audit findings

| ID | Severity | Evidence | Implementation / remaining work |
|---|---|---|---|
| U22 | Critical | `ROAD_ROUTE` was a plausible invented loop, including building centers | Replaced runtime roads/traffic with pinned OSM road centerlines and separate footpaths |
| U23 | High | Approximate dimensions substantially shrank buildings despite generally correct centers | Imported dimensions; added missing named campus massing; preserved source way IDs |
| U24 | Critical | Cars were visual-only, with no response to a pedestrian | Braking, dynamic vehicle obstacles, swept impact detection, knockback, recovery and cooldown implemented |
| U25 | High | Collision covered only nominal building rectangles | Spatially indexed collision now derives from visible ground-level static meshes, including props, trees and furniture |
| U26 | High | No enterable buildings or interior scene lifecycle | Student Union lobby/lounge/elevator and library study interior implemented with entry/exit and disposal |
| U27 | High | A search for Watson Library can surface the historic building now known as Childress Hall | Reference identity registry; correct current-library source selected |
| U28 | Medium | Minimap stretched axes independently and redrew all map geometry per frame | Uniform map scale, cached static layer and throttled updates |

### Delivered behavior

- Find a building in Explore UAPB, search by name, and choose a destination. A gold route appears in the world and minimap, with remaining modeled distance, arrival feedback and cancel.
- A* uses the same collision world as movement, validates intermediate segments, favors mapped pedestrian/access paths and routes around solid geometry. When mapping lacks a usable path, clear modeled ground may be used. No claim that these are verified real campus pedestrian directions.
- Gold doorway markers identify the two currently enterable buildings. E/touch/controller action enters the building. The same character moves through a separate room with solid walls/furniture. Exit returns to the original exterior point.
- The Student Union has two modeled levels; the elevator action changes levels. The lounge supports the existing Spades activity. Visual elements follow the architect’s actual reference photographs, but the layout is approximate.
- Library exterior glazing/piers/material treatment improved using the actual current-library photo. The study interior remains explicitly illustrative.
- Vehicles brake for a pedestrian ahead and stop for static world obstructions. Swept relative-motion contact detects fast crossings; an impact briefly staggers/knocks back the player, then restores control. Stationary vehicles block movement. No gore, damage economy or vehicle-driving feature was introduced.
- Return to Bell Tower provides a recovery path. Input is cleared during transitions/recovery. Outdoor presence coordinates are not overwritten with an interior’s local coordinates.
- Imported road/path geometry is batched into a small number of surface meshes; minimap static geometry is cached and updates are throttled.

### Technical boundaries still open

1. Interiors are available for the Student Union and current library only. Other destinations say exterior only. No claim that every UAPB building is modeled inside.
2. There is no surveyed floor plan, terrain elevation model, staircase locomotion, full rigid-body/ragdoll simulation, or vehicle-to-vehicle traffic simulation. Endpoint traffic reversal remains a simplified behavior.
3. Generic mapped buildings now use polygon collision, keeping irregular footprint openings clear. Special landmark meshes still use conservative bounds; finer authored collision is needed for their arches and alcoves.
4. Road/building geometry comes from OSM plus official-map identity checks. Google Earth Web still did not load. Google Maps satellite at 34.24224,-92.0206 (2026-10-19) shows Union west of the Bell Tower plaza and Watson Library WSW, which matches the OSM X-east/Z-south origin. Entrance bearings, road widths, and University Drive alignment still need a closer pass. Imagery is not a game texture.
5. Some temporary Homecoming props and activity placements are still fictional and need relocation/review against the corrected building footprints.
6. Remote players still appear at their exterior location while a user is inside; proper per-room multiplayer instances require a backend schema and validation update.
7. Routes do not yet reroute automatically, obey crosswalk signals, or certify accessible travel. They avoid static geometry; moving vehicles remain hazards.
8. Player/NPC bodies now load Kenney Animated Characters 3 (CC0 FBX idle/run). Hair still only exists on the procedural fallback. Photoreal scanned humans are not in the repository.

### Evidence and reproducibility

See [reference registry](references/README.md) for official-map, OSM, architect, library, Google Maps and attempted Earth references. Run `npm run import:map` to regenerate the checked-in geometry. Run `npm run test:world` for browser tests of routes, camera state, entrance/exit, Union floor changes, room-wall collision and vehicle impact/recovery on desktop and emulated iPhone.

New unit coverage tests physical obstacles, rotated vehicles, fast swept contacts, valid routes around solids, unreachable destinations, and source-map identity. Screenshots use real rendered application scenes in `docs/audit/*-union-*.png`, `*-library-interior.png`, `*-mapped-route.png` and `*-vehicle-impact.png`.

### Next execution priorities

1. Validate remaining entrance directions and relocate fictional event props against the corrected footprints.
2. Author fine collision meshes for special-model arches; implement obstruction-aware camera and vertical traversal where verified.
3. Obtain additional publicly documented interiors before expanding enterable rooms; preserve reference confidence per room.
4. Add per-room multiplayer presence, lazy-load online services, and finish real-device frame/memory profiling.
5. Continue the original art/identity, accessibility, minigame and release gates. Keep other campuses disabled.


HUD pass (2026-10-18): buttons, chips, modals, and HUD panels are square. Landing copy dropped the slogan/kicker/arrow. Landmark models now use south-face doorway collision instead of a solid AABB, so you can walk up to a door without clipping through the mass. Analog stick stays round because it is a stick, not a button.

Final pass validation: 54 unit tests pass. Production build succeeds with the existing large-bundle warning. Physical-world tests cover desktop and emulated iPhone; the existing experience regression suite covers desktop, iPhone and Pixel. Backend emulator/security tests and live deployment were not run in this pass. An achievement toast that intercepted mobile menu taps was made non-interactive. Tests run on a local Vite server; they do not establish real-device performance or photorealistic art quality.
