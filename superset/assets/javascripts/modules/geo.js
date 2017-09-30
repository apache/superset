
const METER_TO_MILE = 1609.34;
export function unitToRadius(unit, num) {
  if (unit === 'square_m') {
    return Math.sqrt(num / Math.PI);
  } else if (unit === 'radius_m') {
    return num;
  } else if (unit === 'radius_km') {
    return num * 1000;
  } else if (unit === 'radius_miles') {
    return num * METER_TO_MILE;
  } else if (unit === 'square_km') {
    return Math.sqrt(num / Math.PI) * 1000;
  } else if (unit === 'square_miles') {
    return Math.sqrt(num / Math.PI) * METER_TO_MILE;
  }
  return null;
}
