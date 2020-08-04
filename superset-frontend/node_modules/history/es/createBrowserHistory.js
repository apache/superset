'use strict';

import warnAboutDeprecatedESMImport from './warnAboutDeprecatedESMImport.js';
warnAboutDeprecatedESMImport('createBrowserHistory');

import { createBrowserHistory } from '../esm/history.js';
export default createBrowserHistory;
