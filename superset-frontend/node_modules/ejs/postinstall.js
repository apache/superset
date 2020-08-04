#!/usr/bin/env node

'use strict';

function isTrue(value) {
  return !!value && value !== '0' && value !== 'false';
}

let envDisable = isTrue(process.env.DISABLE_OPENCOLLECTIVE) || isTrue(process.env.CI);
let logLevel = process.env.npm_config_loglevel;
let logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel) > -1;

if (!envDisable && !logLevelDisplay) {
  console.log('Thank you for installing \u001b[35mEJS\u001b[0m: built with the \u001b[32mJake\u001b[0m JavaScript build tool (\u001b[32mhttps://jakejs.com/\u001b[0m)\n');
}


