export function createInteractionTarget() {
  return {
    pick(zones, x, z, previous) {
      let closest = null;
      let closestDist = Infinity;
      let prevDist = Infinity;
      let previousInZones = false;

      for (const zone of zones) {
        const dx = x - zone.x;
        const dz = z - zone.z;
        const dist = Math.hypot(dx, dz);

        if (zone === previous) {
          prevDist = dist;
          previousInZones = true;
        }

        if (dist <= zone.radius) {
          if (dist < closestDist) {
            closestDist = dist;
            closest = zone;
          }
        }
      }

      if (previous && previousInZones && prevDist <= previous.radius * 1.15) {
        if (closest && closestDist <= prevDist - 0.6) {
          return closest;
        }
        return previous;
      }

      return closest;
    },

    prompt(zone, { entered, modalOpen, stunned, gamepad, coarse = false } = {}) {
      const available = Boolean(zone && entered && !modalOpen && !stunned);
      
      let text = '';
      let label = '';
      
      if (zone) {
        const verb = coarse ? 'Tap' : 'Press';
        const key = gamepad ? 'A' : 'E';
        text = `${verb} ${key} · ${zone.label}`;
        label = zone.label;
      }

      return { available, text, label };
    }
  };
}
