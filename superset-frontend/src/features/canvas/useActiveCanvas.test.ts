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
import { activeCanvasOf } from './useActiveCanvas';

const input = {
  id: 7,
  title: 'Exec overview',
  revision: 2,
  draftToken: 'tok-a',
  draftLoaded: true,
  draftRevision: 3,
  draftPending: false,
};

test('a settled draft carries the revision on screen', () => {
  expect(activeCanvasOf(input)).toStrictEqual({
    id: 7,
    title: 'Exec overview',
    revision: 2,
    draft: { token: 'tok-a', pending: false, revision: 3 },
  });
});

test('a pending draft carries no revision at all', () => {
  const { draft } = activeCanvasOf({ ...input, draftPending: true });

  expect(draft).toStrictEqual({ token: 'tok-a', pending: true });
  expect(draft).not.toHaveProperty('revision');
});

test('a draft not loaded, or no token, is not named', () => {
  expect(activeCanvasOf({ ...input, draftLoaded: false })).not.toHaveProperty(
    'draft',
  );
  expect(
    activeCanvasOf({ ...input, draftToken: undefined }),
  ).not.toHaveProperty('draft');
});

test('a version preview leaves no draft beside it', () => {
  const value = activeCanvasOf({
    ...input,
    previewedVersion: { uuid: 'v-1', number: 1 },
  });

  expect(value).toStrictEqual({
    id: 7,
    title: 'Exec overview',
    revision: 2,
    previewedVersion: { uuid: 'v-1', number: 1 },
  });
});

test('the value and everything in it is frozen', () => {
  const settled = activeCanvasOf(input);
  const pending = activeCanvasOf({ ...input, draftPending: true });
  const version = { uuid: 'v-1', number: 1 };
  const previewing = activeCanvasOf({ ...input, previewedVersion: version });

  // Present, so that being frozen says something.
  expect(settled.draft).toMatchObject({ pending: false });
  expect(pending.draft).toMatchObject({ pending: true });
  expect(previewing.previewedVersion).toStrictEqual(version);
  expect(Object.isFrozen(settled)).toBe(true);
  expect(Object.isFrozen(settled.draft)).toBe(true);
  expect(Object.isFrozen(pending.draft)).toBe(true);
  expect(Object.isFrozen(previewing)).toBe(true);
  expect(Object.isFrozen(previewing.previewedVersion)).toBe(true);
  // A copy: the caller's object stays its own.
  expect(previewing.previewedVersion).not.toBe(version);
});
