import {window} from './globals';

// opts allows user agent to be overridden for testing
export default function isOldIE(opts = {}) {
  const navigator = window.navigator || {};
  const userAgent = opts.userAgent || navigator.userAgent || '';
  // We only care about older versions of IE (IE 11 and below). Newer versions of IE (Edge)
  // have much better web standards support.
  const isMSIE = userAgent.indexOf('MSIE ') !== -1;
  const isTrident = userAgent.indexOf('Trident/') !== -1;
  return isMSIE || isTrident;
}
