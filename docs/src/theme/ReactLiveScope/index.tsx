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

import React from 'react';

// Browser-only check for SSR safety
const isBrowser = typeof window !== 'undefined';

/**
 * ReactLiveScope provides the scope for live code blocks.
 * Any component added here will be available in ```tsx live blocks.
 *
 * Components are conditionally loaded only in the browser to avoid
 * SSG issues with Emotion CSS-in-JS jsx runtime.
 *
 * Components are available by name, e.g.:
 *   <Button>Click me</Button>
 *   <Avatar size="large" />
 *   <Badge count={5} />
 */

// Base scope with React (always available)
const ReactLiveScope: Record<string, unknown> = {
  // React core
  React,
  ...React,
};

// Only load Superset components in browser context
// This prevents SSG errors from Emotion CSS-in-JS
if (isBrowser) {
  try {
    // Dynamic require for browser-only execution
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SupersetComponents = require('@superset/components');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Alert } = require('@apache-superset/core/ui');

    console.log('[ReactLiveScope] SupersetComponents keys:', Object.keys(SupersetComponents || {}).slice(0, 10));
    console.log('[ReactLiveScope] Has Button?', 'Button' in (SupersetComponents || {}));

    Object.assign(ReactLiveScope, SupersetComponents, { Alert });

    console.log('[ReactLiveScope] Final scope keys:', Object.keys(ReactLiveScope).slice(0, 20));
  } catch (e) {
    console.error('[ReactLiveScope] Failed to load Superset components:', e);
  }
}

export default ReactLiveScope;
