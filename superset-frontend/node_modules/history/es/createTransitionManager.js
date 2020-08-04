'use strict';

import warnAboutDeprecatedESMImport from './warnAboutDeprecatedESMImport.js';
warnAboutDeprecatedESMImport('createTransitionManager');

import { createTransitionManager } from '../esm/history.js';
export default createTransitionManager;
