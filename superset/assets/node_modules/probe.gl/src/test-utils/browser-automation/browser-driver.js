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

import {COLOR} from '../../lib/utils/color';
import Log from '../../lib/log';
const log = new Log({id: 'render-test'});

const DEFAULT_CONFIG = {
  process: './node_modules/.bin/webpack-dev-server',
  parameters: ['--config', 'webpack.config.js'],
  port: 5000,
  options: {maxBuffer: 5000 * 1024}
};

const DEFAULT_PUPPETEER_OPTIONS = {
  headless: false
};

export default class BrowserDriver {
  constructor() {
    this.execFile = module.require('child_process').execFile;
    this.puppeteer = module.require('puppeteer');
    this.console = module.require('console');
    this.process = module.require('process');

    this.child = null;
    this.browser = null;
    this.page = null;
    this.port = null;
    this.shellStatus = 0;
  }

  setShellStatus(success) {
    // return value that is visible to the shell, 0 is success
    this.shellStatus = success ? 0 : 1;
  }

  startBrowser(options = DEFAULT_PUPPETEER_OPTIONS) {
    if (this.browser) {
      return Promise.resolve(this.browser);
    }
    return this.puppeteer
      .launch(options)
      .then(browser => {
        this.browser = browser;
      });
  }

  newPage({url = 'http://localhost', width = 1550, height = 850} = {}) {
    log.log({
      message: `Connecting to port: ${this.port}`,
      color: COLOR.YELLOW
    })();
    return this.startBrowser()
      .then(_ => this.browser.newPage())
      .then(page => {
        this.page = page;
      })
      .then(_ => this.page.waitFor(1000))
      .then(_ => this.page.goto(`${url}:${this.port}`))
      .then(_ => this.page.setViewport({width: 1550, height: 850}));
  }

  exposeFunction(name = 'testDriverDone') {
    return new Promise(resolve => {
      this.page.exposeFunction(name, resolve);
    });
  }

  stopBrowser() {
    return Promise.resolve()
      .then(_ => this.page.waitFor(1000))
      .then(_ => this.browser.close());
  }

  startServer(config = {}, maxRetryTimes = 30) {
    const newConfig = Object.assign({}, DEFAULT_CONFIG, config);
    return new Promise((resolve, reject) => {
      log.log({
        message: `Binding to port: ${newConfig.port}`,
        color: COLOR.YELLOW
      })();
      const timeout = setTimeout(() => { // eslint-disable-line
        resolve();
      }, 2000);
      this.child = this.execFile(
        newConfig.process,
        [...newConfig.parameters, '--port', `${newConfig.port}`],
        newConfig.options,
        error => {
          if (error) {
            clearTimeout(timeout); // eslint-disable-line
            log.log({
              message: `Failed to bind port: ${newConfig.port}`,
              color: COLOR.YELLOW
            })();
            reject(error);
          }
        }
      );
    })
      .then(() => {
        this.port = newConfig.port;
      })
      .catch(error => {
        if (maxRetryTimes > 0) {
          newConfig.port++;
          return this.startServer(newConfig, maxRetryTimes - 1);
        } else { // eslint-disable-line
          log.log({
            message: 'Failed to start server, use \'killall node\' to stop existing services',
            color: COLOR.RED
          })();
          throw error;
        }
      });
  }

  stopServer() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  exitProcess() {
    // generate a return value that is visible to the shell, 0 is success
    this.process.exit(this.shellStatus);
  }

  exit() {
    return Promise.resolve()
      .then(() => this.stopBrowser())
      .then(() => {
        this.stopServer();
        this.exitProcess();
      });
  }
}
