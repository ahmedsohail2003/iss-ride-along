// The pure-JavaScript parts of satellite.js 7.2.0 that we use.
// Why this file exists: satellite.js's main entry also re-exports an optional WebAssembly build
// whose worker uses top-level await, which the single-file production build cannot bundle.
// Importing the plain JS modules directly keeps the page one small file. Same functions, same results.
export { jday } from '../../node_modules/satellite.js/dist/ext.js';
export { twoline2satrec, json2satrec } from '../../node_modules/satellite.js/dist/io.js';
export { propagate, gstime } from '../../node_modules/satellite.js/dist/propagation.js';
export {
  degreesLat,
  degreesLong,
  degreesToRadians,
  radiansToDegrees,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
} from '../../node_modules/satellite.js/dist/transforms.js';
export { sunPos } from '../../node_modules/satellite.js/dist/sun.js';
export { shadowFraction } from '../../node_modules/satellite.js/dist/shadow.js';
