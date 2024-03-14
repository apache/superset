/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { parseArgsStringToArgv } from 'string-argv';

class Context {
  constructor(source) {
    this.hasErrors = false;
    this.source = source;
    this.options = {};
    this.errorLogs = [];
    this.logs = [];
    this.repo = null;
    this.optToEnvMap = {
      issue: 'GITHUB_ISSUE_NUMBER',
      repo: 'GITHUB_REPOSITORY',
    };
  }

  requireOption(optionName, options) {
    const optionValue = options[optionName];
    if (optionValue === undefined || optionValue === null) {
      this.logError(`option [${optionName}] is required`);
      // this.exit(1);
    }
  }

  parseArgs(s) {
    return parseArgsStringToArgv(s);
  }

  requireOptions(optionNames, options) {
    optionNames.forEach((optionName) => {
      this.requireOption(optionName, options);
    });
  }

  processOptions(command, requiredOptions = []) {
    const raw = command.parent?.rawArgs;
    this.command = '???';
    if (raw) {
      this.command = raw.map((s) => (s.includes(' ') ? `"${s}"` : s)).join(' ').replace('node ', '');
    }
    this.options = { ...command.opts(), ...command.parent.opts() };

    // Runtime defaults for unit tests since commanders can't receive callables as default
    Object.entries(this.optToEnvMap).forEach(([k, v]) => {
      if (!this.options[k]) {
        this.options[k] = process.env[v];
      }
    });
    this.requireOptions(requiredOptions, this.options);
    this.issueNumber = this.options.issue;

    if (this.source === 'GHA') {
      this.options.actor = process.env.GITHUB_ACTOR || 'UNKNOWN';
      this.options.repo = process.env.GITHUB_REPOSITORY;
    }
    this.repo = this.options.repo;

    return this.options;
  }

  log(msg) {
    console.log(msg);
    this.logs = [...this.logs, msg];
  }

  logSuccess(msg) {
    const augMsg = `🟢 SUCCESS: ${msg}`;
    console.log(augMsg);
    this.logs.push(augMsg);
  }

  logError(msg) {
    this.hasErrors = true;
    const augMsg = `🔴 ERROR: ${msg}`;
    console.error(augMsg);
    this.errorLogs.push(augMsg);
  }

  exit(code = 0) {
    this.onDone();
    process.exit(code);
  }

  commandWrapper({
    func, successMsg, errorMsg = null, verbose = false, dryRun = false,
  }) {
    return async (...args) => {
      let resp;
      let hasError = false;

      try {
        if (!dryRun) {
          resp = await func(...args);
        }
        if (verbose && resp) {
          console.log(resp);
        }
      } catch (error) {
        hasError = true;
        if (errorMsg) {
          this.logError(errorMsg);
        } else {
          this.logError(error);
        }
        throw (error);
      }
      if (successMsg && !hasError) {
        this.logSuccess(successMsg);
      }
      return resp;
    };
  }

  doneComment() {
    const msgs = [...this.logs, ...this.errorLogs];
    let comment = '';
    comment += `> \`${this.command}\`\n`;
    comment += '```\n';
    comment += msgs.join('\n');
    comment += '\n```';
    return comment;
  }

  async onDone() {
    let msg;
    if (this.source === 'GHA') {
      msg = this.doneComment();
    }
    return msg;
  }
}

export default Context;
