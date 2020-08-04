'use strict';

import warnAboutDeprecatedESMImport from './warnAboutDeprecatedESMImport.js';
warnAboutDeprecatedESMImport('createMemoryHistory');

import { createMemoryHistory } from '../esm/history.js';
export default createMemoryHistory;
