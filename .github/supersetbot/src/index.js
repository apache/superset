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

import getCLI from './cli.js';
import Context from './context.js';
import Github from './github.js';

async function runCommandFromGithubAction(rawCommand) {
  const context = new Context('GHA');
  const cli = getCLI(context);
  const github = new Github(context);

  // Make rawCommand look like argv
  const cmd = rawCommand.trim().replace('@supersetbot', 'supersetbot');
  const args = context.parseArgs(cmd);

  await cli.parseAsync(['node', ...args]);
  const msg = await context.onDone();

  github.createComment(msg);
}

export { runCommandFromGithubAction };
