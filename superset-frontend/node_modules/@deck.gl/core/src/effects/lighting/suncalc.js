// sun position calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas
// and inspired by https://github.com/mourner/suncalc/blob/master/suncalc.js
const DEGREES_TO_RADIANS = Math.PI / 180;

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const JD1970 = 2440588; // Julian Day year 1970
const JD2000 = 2451545; // Julian Day year 2000

// This angle ε [epsilon] is called the obliquity of the ecliptic and its value at the beginning of 2000 was 23.4397°
const e = DEGREES_TO_RADIANS * 23.4397; // obliquity of the Earth

// Refer https://www.aa.quae.nl/en/reken/zonpositie.html
// "The Mean Anomaly" section for explanation
const M0 = 357.5291; // Earth mean anomaly on start day
const M1 = 0.98560028; // Earth angle traverses on average per day seen from the sun

const THETA0 = 280.147; // The sidereal time (in degrees) at longitude 0° at the instant defined by JD2000
const THETA1 = 360.9856235; // The rate of change of the sidereal time, in degrees per day.

export function getSolarPosition(timestamp, latitude, longitude) {
  const longitudeWestInRadians = DEGREES_TO_RADIANS * -longitude;
  const phi = DEGREES_TO_RADIANS * latitude;
  const d = toDays(timestamp);

  const c = getSunCoords(d);
  // hour angle
  const H = getSiderealTime(d, longitudeWestInRadians) - c.rightAscension;

  // https://www.aa.quae.nl/en/reken/zonpositie.html
  // The altitude is 0° at the horizon, +90° in the zenith (straight over your head), and −90° in the nadir (straight down).
  // The azimuth is the direction along the horizon, which we measure from south to west.
  // South has azimuth 0°, west +90°, north +180°, and east +270° (or −90°, that's the same thing).
  return {
    azimuth: getAzimuth(H, phi, c.declination),
    altitude: getAltitude(H, phi, c.declination)
  };
}

export function getSunlightDirection(timestamp, latitude, longitude) {
  const {azimuth, altitude} = getSolarPosition(timestamp, latitude, longitude);
  // convert azimuth from 0 at south to be 0 at north
  const azimuthN = azimuth + Math.PI;

  // solar position to light direction
  return [-Math.sin(azimuthN), -Math.cos(azimuthN), -Math.sin(altitude)];
}

function toJulianDay(timestamp) {
  return timestamp / DAY_IN_MS - 0.5 + JD1970;
}

function toDays(timestamp) {
  return toJulianDay(timestamp) - JD2000;
}

function getRightAscension(eclipticLongitude, b) {
  const lambda = eclipticLongitude;
  return Math.atan2(Math.sin(lambda) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(lambda));
}

function getDeclination(eclipticLongitude, b) {
  const lambda = eclipticLongitude;
  return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(lambda));
}

function getAzimuth(hourAngle, latitudeInRadians, declination) {
  const H = hourAngle;
  const phi = latitudeInRadians;
  const delta = declination;
  return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi));
}

function getAltitude(hourAngle, latitudeInRadians, declination) {
  const H = hourAngle;
  const phi = latitudeInRadians;
  const delta = declination;
  return Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H));
}

// https://www.aa.quae.nl/en/reken/zonpositie.html
// "The Observer section"
function getSiderealTime(dates, longitudeWestInRadians) {
  return DEGREES_TO_RADIANS * (THETA0 + THETA1 * dates) - longitudeWestInRadians;
}

function getSolarMeanAnomaly(days) {
  return DEGREES_TO_RADIANS * (M0 + M1 * days);
}

function getEclipticLongitude(meanAnomaly) {
  const M = meanAnomaly;
  // equation of center
  const C =
    DEGREES_TO_RADIANS * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  // perihelion of the Earth
  const P = DEGREES_TO_RADIANS * 102.9372;

  return M + C + P + Math.PI;
}

function getSunCoords(dates) {
  const M = getSolarMeanAnomaly(dates);
  const L = getEclipticLongitude(M);

  return {
    declination: getDeclination(L, 0),
    rightAscension: getRightAscension(L, 0)
  };
}
