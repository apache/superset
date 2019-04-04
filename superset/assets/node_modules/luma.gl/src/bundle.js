/* Generate pre-bundled script that can be used in browser without browserify */
/* global window */
import 'babel-polyfill';
import './index';
import * as addons from './addons';
import luma from './globals';
luma.addons = addons;

// Export all LumaGL objects as members of global lumagl variable
if (typeof window !== 'undefined') {
  window.LumaGL = luma;
}
