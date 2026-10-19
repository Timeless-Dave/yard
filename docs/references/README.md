# UAPB reference registry

Retrieved/reviewed 2026-10-18. Reference images inform original modeled geometry; they are not embedded as game textures.

| Source | What was actually checked | Use and limitations |
|---|---|---|
| [Official UAPB campus map (2023)](https://uapb.edu/wp-content/uploads/2023/08/UAPB-Map.pdf) | Downloaded PDF, inspected rendered map and numbered building key | Names and relative campus organization; diagram is not a georeferenced survey and may predate changes |
| [Official UAPB campus map (2024)](https://uapb.edu/wp-content/uploads/2024/06/UAPB-Map.pdf) | Numbered key: Union #25, Caldwell #26, Bell Tower #27, John B. Watson Library #29 | Same identity order as OSM: Union/Library west of tower, Caldwell east, University Drive on the east edge |
| [OpenStreetMap map extract](https://www.openstreetmap.org/api/0.6/map?bbox=-92.028,34.24,-92.015,34.257) | Downloaded XML including node coordinates, way IDs and versions | Reproducible geometry in `uapb-osm.xml`; official university map used for identity cross-check |
| [AMR: L.A. Davis renovation](https://www.amr-architects.com/projects/uapb-l.a.-davis-renovation) | Inspected actual lobby, lounge, and glass meeting-room photographs | Union interior materials/furniture/circulation vocabulary; no dimensioned floor plan obtained |
| [UAPB Student Union](https://uapb.edu/campus-life/campus-living/student-involvement-and-leadership/l-a-davis-student-union/) | Official facility identity | Institutional context; not a dimensional source |
| [ALA library reference](https://www.ala.org/advocacy/holding-space/strengthening-communities-and-developing-leaders-hbcu-libraries) | Inspected UAPB library exterior photograph | Red brick, rectangular pale entrance piers, tall glazing, canopy; no interior geometry evidence |
| [UAPB library](https://uapb.edu/academics/john-brown-watson-memorial-library/) | Library services and collaborative equipment descriptions | Functional context for study interior; does not establish actual furniture positions |
| [SAH Childress Hall](https://sah-archipedia.org/buildings/AR-01-JE10.2) | Distinguished historic former Watson Library from present library | Prevents using the wrong historic-building photo for current Watson Library |
| [University Museum 360 tour](https://omnisightinc.com/virtual-tours/university-arkansas-pine-bluff/university-museum-cultural-center-virtual-tour-demo7735/) | Historic library / Childress Hall museum interiors | **Not used.** That is Childress Hall, not the current John B. Watson Library |
| [PBC Union renovation photos](https://www.pbcommercial.com/ceremony-held-at-uapb-for-refurbished-building/) | May 2024 news photos: mail/print shop, upstairs lounge, SGA/mural at stair | Corroborates the AMR Union reconstruction; news license, not copied into `public/` |
| [PBC HPER pep rally](https://www.arkansasonline.com/photos/2023/mar/15/3379424/) | Clemmons Arena court and bleachers, people in foreground | Gym color reference only. Not a lobby photograph. HPER stays exterior-only |
| [Caldwell Hall exterior, Commons](https://commons.wikimedia.org/wiki/File:Caldwell_Hall.jpg) | Exterior of UAPB Caldwell Hall | Exterior massing only. **No Caldwell lobby photo found** (the Commons/NC State "Lobby in Caldwell Hall" image is a different campus) |
| [Current Watson Library exterior, Commons](https://commons.wikimedia.org/wiki/File:John_Brown_Watson_Memorial_Library_Building.jpg) | Current library facade | Exterior only; does not authorize a surveyed interior |
| [Carol Highsmith, LoC: campus sign](https://www.loc.gov/item/2020741546/) | University Drive entrance context, 2020 | Public-dedicated photograph; not used as a game texture |
| [OSM UAPB relation](https://www.openstreetmap.org/relation/13140571) | Campus relation and University Drive way 672052342 | University Drive is predominantly north-south on the **east** side of the historic core, not through the Bell Tower plaza |
| [Google Maps satellite at Bell Tower origin](https://www.google.com/maps/@34.24224,-92.0206,18z/data=!3m1!1e3) | Inspected 2026-10-19 at ~462 m altitude. Labels show Student Union west of the circular plaza, Watson Library west-southwest, Henderson-Young on the plaza, ROTC and Hathaway-Howard to the south. John Kennedy Dr is north of the quad. | Used only as a visual identity check. Tiles are not downloaded into the game. Screenshot: `docs/audit/maps-satellite-bell-union-library.jpg`. Google Earth Web still did not load (blank page). A University Drive search lists 1200 University Dr as the campus/bookstore address, with the Union and Caldwell/Admissions nearby. |
| [Google Earth UAPB search](https://earth.google.com/web/search/University+of+Arkansas+at+Pine+Bluff/) | Attempted 2026-10-19; Earth Web remained blank in this browser | **Earth still not visually verified.** Maps satellite is the imagery that was actually seen. |

## Image references inspected

The following were temporarily downloaded and visually inspected. They remain external references, not redistributed assets in `public/`.

- Union lounge: https://static.wixstatic.com/media/7485ae_a60a28f8b1864096a0ff7bf4fe650ca5~mv2.jpg
- Union ground-floor lobby/mail counter: https://static.wixstatic.com/media/7485ae_fab20b5502114fe1bb34146edf4866ba~mv2.jpg
- Union glass-partition meeting space: https://static.wixstatic.com/media/7485ae_b40fdfebd55b49849a7282ce157b43d4~mv2.jpg
- Current library facade: https://www.ala.org/sites/default/files/advocacy/content/stateandlocal/UAPB--Library.JPG

The Union reconstruction uses pale floors, gray seating, yellow chairs, wood counters/slats, glazing, and an elevator core based on those photographs. It does not claim exact room dimensions or object placement. The library study interior is illustrative and says so in the application.

No public interior photograph of the **Caldwell Hall lobby** (Alumni Hall of Fame) was found. HPER has a news photo of **Clemmons Arena**, not a rec lobby. A 360 tour exists for the **museum in historic Childress Hall**; that must not be copied onto the current library. Caldwell and HPER stay exterior-only.

West-to-east identity order from OSM, the 2024 map, Maps satellite, and ESRI World Imagery: Union and current library → Bell Tower plaza → Caldwell Hall → University Drive. Game coordinates keep that order at 0.35 scale. University Drive does not bisect the tower quad.

Character mesh in game: Kenney Animated Characters 3 (CC0 1.0), human-scale FBX with idle/run, in `public/models/kenney/`. A native CC0 GLB alternative is Kenney Mini Characters (`idle`/`walk` clips, ~700 triangles), which was not swapped in because it is a mini figure, not a full-size human. Photoreal scanned humans are still not in the repository.

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
