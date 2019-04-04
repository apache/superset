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

/* global process */
import BrowserDriver from './browser-driver';
import {COLOR} from '../../lib/utils/color';
import Log from '../../lib/log';

const log = new Log({id: 'render-test'});

// DEFAULT config, intended to be overridden in the node script that calls us

// read the webpack env from 3 arg (node script arg)
let webpackEnv = 'render';
if (process.argv.length >= 3) {
  webpackEnv = process.argv[2];
}

const DEFAULT_CONFIG = {
  title: 'BrowserTest',
  exposeFunction: 'taskComplete',
  parameters: [`--env.${webpackEnv}`]
};

export default class BrowserTestDriver extends BrowserDriver {
  run(config = {}) {
    config = Object.assign(DEFAULT_CONFIG, config);
    const {title, exposeFunction} = config;
    this.title = title;
    log.log({
      message: `${title} started. Launching Chromium instance, waiting for ${exposeFunction}...`,
      color: COLOR.YELLOW
    })();
    this.time = Date.now();
    return Promise.resolve()
      .then(_ => this.startServer(config))
      .then(_ => this.startBrowser())
      .then(_ => this.newPage())
      .then(_ => {
        return this.exposeFunction(exposeFunction);
      })
      .then(resultString => {
        const result = JSON.parse(resultString);
        const ok =
          result.success === Boolean(result.success) &&
          (!result.failedTest || typeof result.failedTest === 'string');
        if (!ok) {
          throw new Error(`Illegal response "${resultString}" returned from Chrome test script`);
        }
        if (!result.success) {
          throw new Error(result.failedTest || 'Unknown failure');
        }
        this._success();
      })
      .catch(error => {
        this._failure(error);
      });
  }

  _success() {
    const elapsed = ((Date.now() - this.time) / 1000).toFixed(1);
    log.log({
      message: `${this.title} successfully completed in ${elapsed}s!`,
      color: COLOR.BRIGHT_GREEN
    })();
    this.setShellStatus(true);
    this.exit();
  }

  _failure(error) {
    log.log({
      message: `${this.title} failed: ${error.message}. Keeping browser open to allow debugging.`,
      color: COLOR.BRIGHT_RED
    })();
    // Don't call exit(). Leave browser running so user can inspect image that failed to render
    this.setShellStatus(false);
  }
}
