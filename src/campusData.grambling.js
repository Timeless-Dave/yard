// Real Grambling State University building positions, sourced from
// OpenStreetMap (Overpass API), projected to local meters around the
// Favrot Student Union (the campus's real social hub — like UAPB, the
// Bell Tower is the origin because that's the natural plaza; here the
// Student Union plays that role) and scaled 0.35x. `special` tags route
// to a detailed model in src/buildings.js; see that file's comments for
// what each one is built from.
export const BUILDINGS = [
  { name: "Favrot Student Union", kind: "student_life", special: "columns", color: "#8a3b2b", x: 0.0, z: 0.0, w: 11.0, h: 7, d: 8.8 },
  { name: "A. C. Lewis Memorial Library", kind: "academic", special: "library", color: "#7a3b2e", x: -96.6, z: -75.3, w: 9.9, h: 8, d: 7.7 },
  { name: "Robinson Memorial Stadium", kind: "athletics", special: "stadium", color: "#0a5c2b", x: -260.3, z: 99.2, w: 22.0, h: 11, d: 12.1 },
  { name: "McCall Dining Hall", kind: "student_life", color: "#8a3b2b", x: -28.0, z: -17.9, w: 7.7, h: 6, d: 6.1 },
  { name: "Eddie G. Robinson Museum", kind: "arts", color: "#5a4a8a", x: -46.5, z: -91.5, w: 6.1, h: 6, d: 5.0 },
  { name: "Conrad Hutchinson Performing Arts Center", kind: "arts", color: "#7a2d8a", x: -221.3, z: 30.5, w: 8.8, h: 7, d: 6.6 },
  { name: "Fred Hobdy Assembly Center", kind: "athletics", color: "#2d6b4a", x: -345.4, z: 117.7, w: 9.9, h: 8, d: 7.7 },
  { name: "Intramural Center", kind: "athletics", color: "#2d6b4a", x: 40.1, z: 44.0, w: 6.1, h: 6, d: 5.0 },
  { name: "Fredrick Douglas Hall", kind: "dorm", color: "#6b4423", x: 52.0, z: -23.9, w: 9.9, h: 7, d: 7.2 },
  { name: "Phyllis Wheatley Hall", kind: "dorm", color: "#6b4423", x: 73.3, z: -22.2, w: 8.8, h: 7, d: 6.6 },
  { name: "Mary McLeod Bethune Hall", kind: "dorm", color: "#7a5230", x: 58.0, z: 35.3, w: 8.2, h: 7, d: 6.6 },
  { name: "Crispus Attucks Hall", kind: "dorm", color: "#7a5230", x: 49.3, z: -64.0, w: 7.2, h: 6, d: 5.5 },
  { name: "Harriet Tubman Hall", kind: "dorm", color: "#6b4423", x: -137.2, z: 109.1, w: 8.2, h: 7, d: 6.6 },
  { name: "Sojourner Truth Hall", kind: "dorm", color: "#7a5230", x: -150.7, z: 155.8, w: 7.2, h: 6, d: 5.5 },
  { name: "Carver Hall", kind: "academic", color: "#3a5c8a", x: -87.6, z: -30.8, w: 7.2, h: 6, d: 5.5 },
  { name: "Jewett Hall", kind: "academic", color: "#3a5c8a", x: -53.6, z: -46.1, w: 7.2, h: 6, d: 5.5 },
  { name: "Robinson Hall", kind: "academic", color: "#3a5c8a", x: -26.4, z: 17.7, w: 6.1, h: 6, d: 5.0 },
  { name: "Lee Hall", kind: "academic", color: "#5a4a8a", x: -25.2, z: -90.2, w: 7.2, h: 6, d: 5.5 },
  { name: "T.L. James Hall", kind: "academic", color: "#3a5c8a", x: -50.3, z: -19.6, w: 6.1, h: 6, d: 5.0 },
  { name: "Brown Hall", kind: "academic", color: "#3a5c8a", x: -41.1, z: 46.5, w: 6.1, h: 6, d: 5.0 },
];

// Real coordinates (sport-tagged OSM ways), same projection.
export const REAL_RECREATION = [
  { name: "Baseball Field", x: 123.3, z: -76.9, w: 24, d: 16, sport: "baseball" },
  { name: "Basketball Courts", x: -164.1, z: 49.2, w: 16, d: 10, sport: "basketball" },
];

// Not in OSM (no interior POI data) — placed just outside the real
// Favrot Student Union, where the campus bookstore/dining actually is.
export const RETAIL_NEAR_UNION = [
  { name: "Chick-fil-A", icon: "🐔", x: -16, z: -12, color: "#dd0033" },
  { name: "Tiger Bookstore", icon: "📚", x: -16, z: 12, color: "#2a2a2a" },
  { name: "Subway", icon: "🥪", x: 16, z: -12, color: "#00704a" },
  { name: "The Grill", icon: "🍽️", x: 16, z: 12, color: "#8a3b2b" },
];

export const FICTIONAL_RECREATION = [
  { name: "Soccer Pitch", x: -372.6, z: 64.4, w: 26, d: 16 },
  { name: "Golf Driving Range", x: 123.3, z: -110, w: 10, d: 20 },
];

export const VENDING_SPOTS = [
  [-20, -5],
  [-100, 100],
  [-250, 90],
];

export const PARTY_SPOTS = {
  union_yard: { label: "The Yard (Favrot Union)", x: 10, z: -10 },
  dining_courtyard: { label: "McCall Dining Courtyard", x: -28, z: -30 },
  dorm_block: { label: "Dorm Block (Tubman/Truth)", x: -144, z: 130 },
  stadium_lot: { label: "Stadium Lot", x: -260, z: 110 },
};

export const CAMPUS_META = {
  id: "grambling",
  label: "Grambling State",
  shortName: "GSU",
  mascot: "Tigers",
  primaryColor: "#f4b223",
  lat: 32.5233746,
  lon: -92.7132389,
  location: "Grambling, LA",
};
