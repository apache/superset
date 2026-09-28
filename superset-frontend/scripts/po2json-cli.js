#!/usr/bin/env node
/*
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

// Thin CLI wrapper around po2json.js's poToJed(), called by po2json.sh.
// Usage: po2json-cli.js --domain <domain> <input.po> <output.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { poToJed } from './po2json.js';

const {
  values: { domain },
  positionals: [input, output],
} = parseArgs({
  options: { domain: { type: 'string', default: 'messages' } },
  allowPositionals: true,
});
if (!input || !output) {
  throw new Error(
    'Usage: po2json-cli.js --domain <domain> <input.po> <output.json>',
  );
}

writeFileSync(output, JSON.stringify(poToJed(readFileSync(input), domain)));
