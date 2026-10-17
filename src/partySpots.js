export const PARTY_SPOTS = {
  bell_tower_yard: { label: "The Yard (Bell Tower)", x: 10, z: -10 },
  union_courtyard: { label: "Student Union Courtyard", x: -68, z: -30 },
  dorm_block: { label: "Dorm Block (Harrold)", x: -92, z: 18 },
  stadium_lot: { label: "Stadium Lot", x: -24, z: -418 },
};

export function spotPosition(key) {
  return PARTY_SPOTS[key] || PARTY_SPOTS.bell_tower_yard;
}
