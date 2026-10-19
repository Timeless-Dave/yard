import * as uapb from "./campusData.uapb.js";
import * as grambling from "./campusData.grambling.js";

const STORAGE_KEY = "yard-campus";

export const CAMPUSES = {
  uapb: { meta: uapb.CAMPUS_META, data: uapb },
  grambling: { meta: grambling.CAMPUS_META, data: grambling },
};

// UAPB is the only released campus until its acceptance gates pass.
export function getActiveCampusId() { return "uapb"; }

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
