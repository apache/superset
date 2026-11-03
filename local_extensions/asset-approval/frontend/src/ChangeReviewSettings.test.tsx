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

/**
 * @fileoverview The Change review page describes the control as it is.
 *
 * This page is the one surface whose whole job is to tell an administrator
 * how approval works, so a line that is out of date here sends them looking
 * for something that does not exist. It said approvers need "the approval
 * permission" for weeks after that permission was removed with S-05
 * (sc-131034).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { http } from '@apache-superset/core';
import ChangeReviewSettings from './ChangeReviewSettings';

// `@apache-superset/core` already resolves to spec/coreStub, whose http
// methods are jest mocks, so there is nothing to mock here -- only a return
// value to set.
const mockedGet = http.get as unknown as jest.Mock;

beforeEach(() => {
  mockedGet.mockReset();
  mockedGet.mockResolvedValue({
    json: { result: { enabled: true } },
    status: 200,
    headers: new Headers(),
  });
});

test('approving is described as editorship, not as a permission', async () => {
  render(<ChangeReviewSettings />);

  expect(
    await screen.findByText('Another editor of the asset, never the author'),
  ).toBeInTheDocument();
});

test('the page never sends an administrator looking for a permission to grant', async () => {
  // The structural half. Any wording is fine as long as it does not promise
  // a grantable right, because there is none to grant.
  const { container } = render(<ChangeReviewSettings />);

  await screen.findByText('Who can approve');

  expect(container.textContent).not.toMatch(/approval permission/i);
  expect(container.textContent).not.toMatch(/can_approve/);
});

test('the rest of the summary still reads true', async () => {
  render(<ChangeReviewSettings />);

  for (const line of [
    'All dashboards, charts and datasets',
    'Publishing is blocked until another editor is added',
    'Not available',
  ]) {
    expect(await screen.findByText(line)).toBeInTheDocument();
  }
});

test('a failed probe still leaves the page saying something true', async () => {
  // The page describes configuration rather than live state, so it must not
  // go blank when the probe fails.
  mockedGet.mockRejectedValue(new Error('no'));

  render(<ChangeReviewSettings />);

  await waitFor(() =>
    expect(screen.getByText('Change review')).toBeInTheDocument(),
  );
  expect(
    screen.getByText('Another editor of the asset, never the author'),
  ).toBeInTheDocument();
});
