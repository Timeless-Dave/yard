import * as uapb from "./campusData.uapb.js";
import * as grambling from "./campusData.grambling.js";

const STORAGE_KEY = "yard-campus";

export const CAMPUSES = {
  uapb: { meta: uapb.CAMPUS_META, data: uapb },
  grambling: { meta: grambling.CAMPUS_META, data: grambling },
};

export function getActiveCampusId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CAMPUSES[stored]) return stored;
  } catch {
    /* storage unavailable */
  }
  return "uapb";
}

export function setActiveCampusId(id) {
  if (!CAMPUSES[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export function getActiveCampus() {
  return CAMPUSES[getActiveCampusId()];
}
