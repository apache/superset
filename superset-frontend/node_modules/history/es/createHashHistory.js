'use strict';

import warnAboutDeprecatedESMImport from './warnAboutDeprecatedESMImport.js';
warnAboutDeprecatedESMImport('createHashHistory');

import { createHashHistory } from '../esm/history.js';
export default createHashHistory;
