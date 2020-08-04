"use strict";

// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
exports.stripAndCollapseASCIIWhitespace = s => {
  return s.replace(/[ \t\n\f\r]+/g, " ").replace(/^[ \t\n\f\r]+/, "").replace(/[ \t\n\f\r]+$/, "");
};
