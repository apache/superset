#!/usr/bin/env node
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

/* eslint-disable no-console */

/**
 * Clean build outputs and Nx cache
 */

const { execSync } = require('child_process');

console.log('🧹 Cleaning build outputs and cache...');

// Clear Nx cache
try {
  execSync('npx nx reset', { stdio: 'inherit' });
} catch (e) {
  // Nx might not be initialized yet
}

// Clean build directories
execSync('lerna run clean --parallel 2>/dev/null || true', {
  stdio: 'inherit',
  shell: true,
});

console.log('✨ Clean complete!');
