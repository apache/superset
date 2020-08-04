// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {global} from '../utils/globals';
import log from '../utils/log';
import {initializeShaderModules} from '../shaderlib';

// Version detection using babel plugin
// Fallback for tests and SSR since global variable is defined by Webpack.
/* global __VERSION__ */
const version =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : global.DECK_VERSION || 'untranspiled source';

const STARTUP_MESSAGE = 'set deck.log.priority=1 (or higher) to trace attribute updates';

if (global.deck && global.deck.VERSION !== version) {
  throw new Error(`deck.gl - multiple versions detected: ${global.deck.VERSION} vs ${version}`);
}

if (!global.deck) {
  log.log(0, `deck.gl ${version} - ${STARTUP_MESSAGE}`)();

  global.deck = global.deck || {
    VERSION: version,
    version,
    log
  };

  initializeShaderModules();
}

export default global.deck;
