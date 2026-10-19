# UAPB reference registry

Retrieved/reviewed 2026-10-18. Reference images inform original modeled geometry; they are not embedded as game textures.

| Source | What was actually checked | Use and limitations |
|---|---|---|
| [Official UAPB campus map](https://uapb.edu/wp-content/uploads/2023/08/UAPB-Map.pdf) | Downloaded PDF, inspected rendered map and numbered building key | Names and relative campus organization; diagram is not a georeferenced survey and may predate changes |
| [OpenStreetMap map extract](https://www.openstreetmap.org/api/0.6/map?bbox=-92.028,34.24,-92.015,34.257) | Downloaded XML including node coordinates, way IDs and versions | Reproducible geometry in `uapb-osm.xml`; official university map used for identity cross-check |
| [AMR: L.A. Davis renovation](https://www.amr-architects.com/projects/uapb-l.a.-davis-renovation) | Inspected actual lobby, lounge, and glass meeting-room photographs | Union interior materials/furniture/circulation vocabulary; no dimensioned floor plan obtained |
| [UAPB Student Union](https://uapb.edu/campus-life/campus-living/student-involvement-and-leadership/l-a-davis-student-union/) | Official facility identity | Institutional context; not a dimensional source |
| [ALA library reference](https://www.ala.org/advocacy/holding-space/strengthening-communities-and-developing-leaders-hbcu-libraries) | Inspected UAPB library exterior photograph | Red brick, rectangular pale entrance piers, tall glazing, canopy; no interior geometry evidence |
| [UAPB library](https://uapb.edu/academics/john-brown-watson-memorial-library/) | Library services and collaborative equipment descriptions | Functional context for study interior; does not establish actual furniture positions |
| [SAH Childress Hall](https://sah-archipedia.org/buildings/AR-01-JE10.2) | Distinguished historic former Watson Library from present library | Prevents using the wrong historic-building photo for current Watson Library |
| [Google Maps satellite at Bell Tower origin](https://www.google.com/maps/@34.24224,-92.0206,18z/data=!3m1!1e3) | Inspected 2026-10-19 at ~462 m altitude. Labels show Student Union west of the circular plaza, Watson Library west-southwest, Henderson-Young on the plaza, ROTC and Hathaway-Howard to the south. John Kennedy Dr is north of the quad. | Used only as a visual identity check. Tiles are not downloaded into the game. Screenshot: `docs/audit/maps-satellite-bell-union-library.jpg`. Google Earth Web still did not load (blank page). A University Drive search lists 1200 University Dr as the campus/bookstore address, with the Union and Caldwell/Admissions nearby. |
| [Google Earth UAPB search](https://earth.google.com/web/search/University+of+Arkansas+at+Pine+Bluff/) | Attempted 2026-10-19; Earth Web remained blank in this browser | **Earth still not visually verified.** Maps satellite is the imagery that was actually seen. |

## Image references inspected

The following were temporarily downloaded and visually inspected. They remain external references, not redistributed assets in `public/`.

- Union lounge: https://static.wixstatic.com/media/7485ae_a60a28f8b1864096a0ff7bf4fe650ca5~mv2.jpg
- Union ground-floor lobby/mail counter: https://static.wixstatic.com/media/7485ae_fab20b5502114fe1bb34146edf4866ba~mv2.jpg
- Union glass-partition meeting space: https://static.wixstatic.com/media/7485ae_b40fdfebd55b49849a7282ce157b43d4~mv2.jpg
- Current library facade: https://www.ala.org/sites/default/files/advocacy/content/stateandlocal/UAPB--Library.JPG

The Union reconstruction uses pale floors, gray seating, yellow chairs, wood counters/slats, glazing, and an elevator core based on those photographs. It does not claim exact room dimensions or object placement. The library study interior is illustrative and says so in the application.

No public interior photograph set was found for Caldwell Hall or HPER that is sufficient to author another enterable room. Written sources mention an Alumni Hall of Fame in the Caldwell lobby and HPER pool/courts/arena, but those are not photographs. Those buildings stay exterior-only.

Character mesh: Kenney Animated Characters 3 (CC0 1.0), https://kenney.nl and https://kenney-assets.itch.io/animated-characters-3. Idle and run FBX plus humanMaleA/humanFemaleA skins ship in `public/models/kenney/`. This is a licensed stylized rig, not a photoreal scan. Procedural ellipsoids remain the fallback if FBX fails to load.

## Coordinate contract

Origin: latitude 34.2422394, longitude -92.0206016, near the Bell Tower. X increases east; Z increases south. Projected local meters use 111320 meters/degree and longitude cosine correction. The existing 0.35 compression factor is retained to avoid silently changing every activity coordinate. This is a **compressed game world**, not a 1:1 digital twin. Character sizes and walking speeds are gameplay-scaled.

`npm run import:map` deterministically regenerates `src/uapbMap.generated.json` from the XML snapshot. It contains 41 named building footprints and 302 clipped road/path runs. Roads with private-access tags are omitted. OSM gaps, incomplete access tags, ground elevation, curb height and ADA route suitability have not been field-verified. Routes are game navigation, not real-world travel instructions.

The initial Overpass request returned HTTP 406; the OSM map endpoint succeeded. No data from the rejected response is used.

## Corrections and confidence

- The original building centers generally matched the imported geographic projection, but building width/depth values were arbitrary and too small.
- Student Union: original 11 × 8.8 game units, imported bounds 28.656 × 18.791.
- Current Watson Library: original 9.9 × 7.7, imported bounds 15.386 × 15.593.
- Caldwell: original 7.7 × 6.1, imported bounds 16.413 × 26.128.
- Official map labels Woodard Hall, while OSM labels the same way Woodward Hall. Display name follows the official university map; source ID preserves traceability.
- Current library way: 818591116. Historic Childress Hall: 818591099. They are distinct buildings.
- The invented ambient loop has been removed from runtime; traffic chooses imported road centerlines and never pedestrian-only ways.
- New campus structures use imported polygon massing. Heights/window arrangements are approximations. Special landmark models retain simplified architecture, now sized from measured footprint bounds where available.
- The stadium still uses an existing stylized model, not a newly verified survey model. Seasonal/event props and some activity placements remain fictional.


## Activity Placements

Activity spots (cards, stepshow, etc.), party locations, and vending/retail props have been computationally moved out of imported building footprints and placed on nearby open plazas or lawns (using simple radius/angle searches against building AABBs).
Coordinates rely on these generated bounding boxes and are labeled with confidence `plaza` or `lawn` (representing open space around the Bell Tower and Union). Placements are plausible for gameplay but are explicitly fictional or approximate; they are not verified via Google Earth.

## Attribution and data license

OpenStreetMap data © OpenStreetMap contributors, available under the [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright). The XML extract and generated geographic database retain that provenance. Map attribution appears in the destination UI. The application renders original procedural geometry over the derived map.

The official UAPB PDF is retained as an audit reference, not shipped as a game asset. AMR/ALA photographs are referenced by link only in the repository.
