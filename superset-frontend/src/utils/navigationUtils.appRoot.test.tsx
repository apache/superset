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
import { applicationRootScenarios } from 'spec/helpers/withApplicationRoot';

// Subdirectory regression for the nine `ensureAppRoot(...)` value-wrap
// callsites. Each row pins one callsite's input value
// (what the migrated component now passes to `ensureAppRoot`) and asserts the
// resulting URL under both the root deployment (`''`) and the `/superset`
// subdirectory deployment.
//
// Why this shape rather than per-callsite rendered-component tests: every
// migrated callsite is a value-only wrap (plain `<a href={ensureAppRoot(...)}>`,
// antd `<Button href={ensureAppRoot(...)}>`, or
// `<Typography.Link href={ensureAppRoot(...)}>`); the migration's correctness
// is entirely determined by `ensureAppRoot`'s output. Rendering Login,
// Register, DatabaseList, and DatasetList in full just to read back their
// rendered `href` attributes would pull in dozens of unrelated providers and
// fixtures with no extra signal. Pinning input → expected output per callsite
// gives the same regression coverage with a fraction of the surface area.
//
// The line citations in `name` are pinned at the green commit; if a follow-up
// edits move them, update the citations rather than the assertions.

interface Callsite {
  /** Human-friendly identifier (`file:line — element`). */
  name: string;
  /** The literal value the migrated component passes to `ensureAppRoot`. */
  input: string;
}

const CALLSITES: Callsite[] = [
  {
    name: 'src/explore/components/controls/AnnotationLayerControl/AnnotationLayer.tsx:149 — <a target="_blank">',
    input: '/annotationlayer/list',
  },
  {
    name: 'src/pages/Login/index.tsx:260 — antd <Button href>',
    input: '/register/',
  },
  {
    name: 'src/pages/Register/index.tsx:95 — antd <Button href>',
    input: '/login/',
  },
  {
    name: 'src/pages/AnnotationLayerList/index.tsx:158 — <Typography.Link href>',
    // Sample id (`42`) keeps the assertion concrete; the runtime caller
    // interpolates `id` from the row data.
    input: '/annotationlayer/42/annotation',
  },
  {
    name: 'src/pages/AnnotationList/index.tsx:284 — <Typography.Link href>',
    input: '/annotationlayer/list/',
  },
  {
    name: 'src/pages/DatabaseList/index.tsx:1037 — <Typography.Link href> (legacy /superset/dashboard/ literal dropped)',
    input: '/dashboard/42',
  },
  {
    name: 'src/pages/DatabaseList/index.tsx:1082 — <Typography.Link href>',
    input: '/explore/?slice_id=42',
  },
  {
    name: 'src/pages/DatasetList/index.tsx:1363 — <Typography.Link href> (legacy /superset/dashboard/ literal dropped)',
    input: '/dashboard/42',
  },
  {
    name: 'src/pages/DatasetList/index.tsx:1408 — <Typography.Link href>',
    input: '/explore/?slice_id=42',
  },
];

const DEPLOYMENTS: { label: string; root: string }[] = [
  { label: 'root deployment', root: '' },
  { label: '/superset subdirectory deployment', root: '/superset' },
];

test('ensureAppRoot composes correctly under both deployments', async () => {
  await applicationRootScenarios(DEPLOYMENTS, async ({ root }) => {
    const { ensureAppRoot } = await import('src/utils/navigationUtils');
    for (const callsite of CALLSITES) {
      const expected =
        root === '' ? callsite.input : `${root}${callsite.input}`;
      expect({
        deployment: root || '(root)',
        callsite: callsite.name,
        actual: ensureAppRoot(callsite.input),
      }).toEqual({
        deployment: root || '(root)',
        callsite: callsite.name,
        actual: expected,
      });
    }
  });
});

// `ensureAppRoot` is idempotent on already-prefixed paths under the same
// deployment root: the runtime dedupe net inside `pathUtils.ensureAppRoot`
// (documented in the `project_supersetclient_approot_dedupe.md` memory)
// recognises a leading `appRoot` segment and does not re-prefix. That is what
// keeps the migration safe to roll out incrementally — if any third party,
// SSR backend response, or pre-migration callsite still emits the legacy
// `/superset/...` literal, the helper short-circuits to a single-prefix URL
// instead of doubling it. Pin the behaviour here so a future "simplify"
// refactor cannot accidentally strip the safety net.
test('ensureAppRoot is idempotent on already-prefixed paths under /superset', async () => {
  await applicationRootScenarios(
    [{ label: '/superset subdirectory deployment', root: '/superset' }],
    async () => {
      const { ensureAppRoot } = await import('src/utils/navigationUtils');
      // Legacy emitter shape: `/superset/dashboard/42` already carries the
      // prefix. Re-wrapping must produce single-prefix, not doubled.
      expect(ensureAppRoot('/superset/dashboard/42')).toBe(
        '/superset/dashboard/42',
      );
      // New emitter shape: `/dashboard/42` is unprefixed and
      // gets the deployment root composed in.
      expect(ensureAppRoot('/dashboard/42')).toBe('/superset/dashboard/42');
    },
  );
});
