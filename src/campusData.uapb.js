import map from "./uapbMap.generated.json";
// Real UAPB building positions sourced from OpenStreetMap (Overpass API),
// projected to local meters around the W.E. O'Bryant Bell Tower and scaled
// 0.35x for a walkable world. Footprints are stylized approximations, not
// true building outlines. `special` tags route to a detailed model in
// src/buildings.js; see that file's comments for what each is built from.
const ORIGINAL_BUILDINGS = [
  { name: "W.E. O'Bryant Bell Tower", kind: "landmark", special: "bell_tower", color: "#f4b223", x: 0.0, z: 0.0, w: 1.7, h: 11, d: 1.7 },
  { name: "Golden Lion Stadium", kind: "athletics", special: "stadium", color: "#0a5c2b", x: -31.0, z: -428.9, w: 22.0, h: 11, d: 12.1 },
  { name: "L.A. Davis, Sr. Student Union", kind: "student_life", special: "union_cantilever", color: "#f4b223", x: -60.1, z: -21.7, w: 11.0, h: 7, d: 8.8 },
  { name: "John Brown Watson Memorial Library", kind: "academic", special: "library", color: "#3a5c8a", x: -55.2, z: 5.7, w: 9.9, h: 8, d: 7.7 },
  { name: "Kenneth L. Johnson HPER Complex", kind: "athletics", special: "hper", color: "#2d6b4a", x: -123.1, z: -146.6, w: 12.1, h: 7, d: 8.8 },
  { name: "Administration Building", kind: "academic", special: "columns", color: "#8a3b2b", x: 60.0, z: -66.6, w: 11.0, h: 9, d: 7.7 },
  { name: "Dawson-Hicks Hall", kind: "academic", color: "#5a4a8a", x: 13.5, z: 34.0, w: 8.8, h: 7, d: 6.6 },
  { name: "Hathaway-Howard Fine Arts Center", kind: "arts", special: "fine_arts", color: "#7a2d8a", x: 26.1, z: 57.7, w: 9.9, h: 7, d: 7.2 },
  { name: "Caldwell Hall", kind: "academic", special: "caldwell", color: "#3a5c8a", x: 32.3, z: 0.7, w: 7.7, h: 6, d: 6.1 },
  { name: "STEM Building", kind: "academic", special: "stem", color: "#2d6b8a", x: -98.4, z: -73.1, w: 9.9, h: 8, d: 7.2 },
  { name: "Walker Research Center", kind: "academic", color: "#3a5c8a", x: -23.1, z: -55.1, w: 7.2, h: 6, d: 5.5 },
  { name: "Fitness Center", kind: "athletics", color: "#2d6b4a", x: -1.5, z: -67.8, w: 7.7, h: 6, d: 6.1 },
  { name: "Residential Life", kind: "admin", color: "#555555", x: -29.5, z: 104.1, w: 6.1, h: 5, d: 5.0 },
  { name: "Delta Housing Complex", kind: "dorm", color: "#6b4423", x: -43.8, z: -232.9, w: 11.0, h: 7, d: 7.7 },
  { name: "Johnny B. Johnson Housing Complex", kind: "dorm", color: "#6b4423", x: -106.0, z: -201.1, w: 11.0, h: 7, d: 7.7 },
  { name: "Harrold Complex", kind: "dorm", color: "#6b4423", x: -98.9, z: 10.4, w: 9.9, h: 7, d: 7.2 },
  { name: "Larrison Hall", kind: "dorm", color: "#7a5230", x: -60.5, z: -45.7, w: 8.2, h: 7, d: 6.6 },
  { name: "Woodward Hall", kind: "dorm", color: "#7a5230", x: -49.4, z: -68.4, w: 8.2, h: 7, d: 6.6 },
  { name: "Holiday Hall", kind: "dorm", color: "#7a5230", x: -45.8, z: -48.9, w: 8.2, h: 7, d: 6.6 },
  { name: "Hunt Hall", kind: "academic", color: "#3a5c8a", x: -75.6, z: 35.9, w: 7.2, h: 6, d: 5.5 },
  { name: "Kountz-Kyle Hall", kind: "academic", color: "#3a5c8a", x: -52.6, z: 31.0, w: 7.2, h: 6, d: 5.5 },
  { name: "Corbin Hall", kind: "academic", color: "#3a5c8a", x: -11.8, z: 60.2, w: 7.2, h: 6, d: 5.5 },
];

// Center and footprint sizes now come from the pinned, reproducible OSM import.
const aliases = { 'John Brown Watson Memorial Library': 'John B. Watson Library', 'Kenneth L. Johnson HPER Complex': 'Health, Physical Education and Recreation (HPER) Building' };
const matchedBuildings = ORIGINAL_BUILDINGS.map(b => {
  const measured = map.buildings.find(m => m.name === (aliases[b.name] || b.name));
  return measured ? { ...b, ...measured, name: b.name === 'Woodward Hall' ? 'Woodard Hall' : b.name, h: b.h } : b;
});
// Add named campus structures missing from the prototype; exclude neighboring churches.
const usedIds = new Set(matchedBuildings.map(b => b.osmId));
const additional = map.buildings.filter(b => !usedIds.has(b.osmId) && !/church/i.test(b.name)).map(b => ({ ...b, kind: 'academic', h: 5, color: '#865448', modelConfidence: 'OSM footprint; height and facade approximate' }));
export const BUILDINGS = [...matchedBuildings, ...additional];
export const MAP_ROADS = map.roads;
export const MAP_METADATA = { origin: map.origin, scale: map.scale, retrieved: map.retrieved };

// Real coordinates (sport-tagged OSM ways), same projection.
export const REAL_RECREATION = [
  { name: "Tennis Courts", x: -156.5, z: -193.6, w: 14, d: 7, sport: "tennis" },
  { name: "Football Practice Field", x: 1.7, z: -459.0, w: 30, d: 18, sport: "football" },
];

// Not in OSM (campuses rarely tag interior retail/dining or informal rec
// spots) — placed just outside the Student Union / near HPER as a
// reasonable stand-in for "the food court" and "the rec fields."
export const RETAIL_NEAR_UNION = [
  { name: "Starbucks", icon: "☕", x: -72, z: -12, color: "#00704a" },
  { name: "Chick-fil-A", icon: "🐔", x: -73.4, z: -31.4, color: "#dd0033" },
  { name: "Golden Lion Bookstore", icon: "📚", x: -49.4, z: -31.4, color: "#2a2a2a" },
  { name: "The Cafeteria", icon: "🍽️", x: -48, z: -12, color: "#8a3b2b" },
];

export const FICTIONAL_RECREATION = [
  { name: "Soccer Pitch", x: 40, z: -470, w: 26, d: 16 },
  { name: "Golf Driving Range", x: -40, z: -470, w: 10, d: 20 },
];

export const VENDING_SPOTS = [
  [-66, -12],
  [-88, 12],
  [-121, -128],
];

export const PARTY_SPOTS = {
  bell_tower_yard: { label: "The Yard (Bell Tower)", x: 10, z: -10 },
  union_courtyard: { label: "Student Union Courtyard", x: -69.4, z: -31.4 },
  dorm_block: { label: "Dorm Block (Harrold)", x: -88, z: 18 },
  stadium_lot: { label: "Stadium Lot", x: -24, z: -418 },
};
export const ACTIVITY_SPOTS = {
  cards: { x: 5, z: 5, label: "Bell Tower Lawn", confidence: "lawn" },
  stepshow: { x: 5, z: -5, label: "Bell Tower Plaza", confidence: "plaza" },
  dominoes: { x: -5, z: 5, label: "Bell Tower West", confidence: "lawn" },
  doubledutch: { x: -5, z: -5, label: "Bell Tower North", confidence: "plaza" },
  hopscotch: { x: -10, z: 0, label: "Bell Tower Walk", confidence: "plaza" },
  boombox: { x: 0, z: 10, label: "Caldwell Lawn", confidence: "lawn" },
  pager: { x: 10, z: 5, label: "East Lawn", confidence: "lawn" },
  cookout: { x: -45, z: -10, label: "Union East Plaza", confidence: "plaza" },
  photobooth: { x: -75, z: -10, label: "Union West Walk", confidence: "plaza" },
  king: { x: -45, z: -35, label: "Union South Lawn", confidence: "lawn" },
  billboards: { x: -75, z: -35, label: "Union Courtyard", confidence: "plaza" },
  community: { x: -60, z: -5, label: "Union North Walk", confidence: "plaza" }
};

export const CAMPUS_META = {
  id: "uapb",
  label: "UAPB",
  shortName: "UAPB",
  mascot: "Golden Lions",
  primaryColor: "#f4b223",
  lat: 34.2422394,
  lon: -92.0206016,
  location: "Pine Bluff, AR",
};
