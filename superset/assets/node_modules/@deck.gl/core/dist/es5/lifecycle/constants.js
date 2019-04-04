"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LIFECYCLE = void 0;
var LIFECYCLE = {
  NO_STATE: 'Awaiting state',
  MATCHED: 'Matched. State transferred from previous layer',
  INITIALIZED: 'Initialized',
  AWAITING_GC: 'Discarded. Awaiting garbage collection',
  AWAITING_FINALIZATION: 'No longer matched. Awaiting garbage collection',
  FINALIZED: 'Finalized! Awaiting garbage collection'
};
exports.LIFECYCLE = LIFECYCLE;
//# sourceMappingURL=constants.js.map