// Real UAPB building positions sourced from OpenStreetMap (Overpass API),
// projected to local meters around the W.E. O'Bryant Bell Tower and scaled
// 0.35x for a walkable world. Footprints are stylized approximations, not
// true building outlines.
export const BUILDINGS = [
  { name: "W.E. O'Bryant Bell Tower", kind: "landmark", color: "#f4b223", x: 0.0, z: 0.0, w: 1.7, h: 11, d: 1.7 },
  { name: "Golden Lion Stadium", kind: "athletics", color: "#0a5c2b", x: -31.0, z: -428.9, w: 22.0, h: 11, d: 12.1 },
  { name: "L.A. Davis, Sr. Student Union", kind: "student_life", color: "#f4b223", x: -60.1, z: -21.7, w: 11.0, h: 7, d: 8.8 },
  { name: "John B. Watson Library", kind: "academic", color: "#3a5c8a", x: -55.2, z: 5.7, w: 9.9, h: 8, d: 7.7 },
  { name: "Health, Physical Education & Recreation (HPER)", kind: "athletics", color: "#2d6b4a", x: -123.1, z: -146.6, w: 12.1, h: 7, d: 8.8 },
  { name: "Administration Building", kind: "academic", color: "#8a3b2b", x: 60.0, z: -66.6, w: 11.0, h: 9, d: 7.7 },
  { name: "Dawson-Hicks Hall", kind: "academic", color: "#5a4a8a", x: 13.5, z: 34.0, w: 8.8, h: 7, d: 6.6 },
  { name: "Hathaway-Howard Fine Arts Center", kind: "arts", color: "#7a2d8a", x: 26.1, z: 57.7, w: 9.9, h: 7, d: 7.2 },
  { name: "Caldwell Hall", kind: "academic", color: "#3a5c8a", x: 32.3, z: 0.7, w: 7.7, h: 6, d: 6.1 },
  { name: "STEM Building", kind: "academic", color: "#2d6b8a", x: -98.4, z: -73.1, w: 9.9, h: 8, d: 7.2 },
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

// Real coordinates (sport-tagged OSM ways), same projection.
export const REAL_RECREATION = [
  { name: "Tennis Courts", x: -156.5, z: -193.6, w: 14, d: 7, sport: "tennis" },
  { name: "Football Practice Field", x: 1.7, z: -459.0, w: 30, d: 18, sport: "football" },
];

// Not in OSM (campuses rarely tag interior retail/dining or informal rec
// spots) — placed just outside the Student Union / near HPER as a
// reasonable stand-in for "the food court" and "the rec fields."
export const RETAIL_NEAR_UNION = [
  { name: "Starbucks", icon: "☕", x: -72, z: -14, color: "#00704a" },
  { name: "Chick-fil-A", icon: "🐔", x: -72, z: -30, color: "#dd0033" },
  { name: "Golden Lion Bookstore", icon: "📚", x: -48, z: -30, color: "#2a2a2a" },
  { name: "The Cafeteria", icon: "🍽️", x: -48, z: -14, color: "#8a3b2b" },
];

export const FICTIONAL_RECREATION = [
  { name: "Soccer Pitch", x: 40, z: -470, w: 26, d: 16 },
  { name: "Golf Driving Range", x: -40, z: -470, w: 10, d: 20 },
];

export const CENTER = { x: -60.1, z: -21.7 }; // Student Union — the Yard hub
