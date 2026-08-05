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
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'dist', 'index.html');
const bytes = statSync(out).size;
const kib = (bytes / 1024).toFixed(1);
const mib = (bytes / (1024 * 1024)).toFixed(2);
const budget = 1.5 * 1024 * 1024;
const status = bytes <= budget ? 'OK (under 1.5MB budget)' : 'OVER 1.5MB budget';
console.log(`\n  dist/index.html = ${bytes} bytes (${kib} KiB / ${mib} MiB) — ${status}\n`);
