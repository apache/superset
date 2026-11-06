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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import DraftBanner from './DraftBanner';
import type { DraftChange } from './types';

const history = {
  canUndo: false,
  canRedo: false,
  undo: jest.fn(),
  redo: jest.fn(),
  busy: false,
};

const actions = {
  publish: jest.fn().mockResolvedValue(undefined),
  discard: jest.fn().mockResolvedValue(undefined),
  busy: false,
};

beforeEach(() => jest.clearAllMocks());

const renderBanner = (props: Partial<Parameters<typeof DraftBanner>[0]> = {}) =>
  render(
    <DraftBanner
      history={history}
      actions={actions}
      saving={false}
      {...props}
    />,
    { useRedux: true },
  );

test('the banner says who can see the changes', () => {
  renderBanner();

  expect(
    screen.getByText('Draft. Only you can see these changes.'),
  ).toBeInTheDocument();
});

const changes: DraftChange[] = [
  { kind: 'resized', nodeId: 'rv', by: 'user' },
  { kind: 'edited', nodeId: 'ps', by: 'ai' },
];

test('the count says how much the draft holds', () => {
  renderBanner({ changes });

  expect(screen.getByTestId('canvas-draft-changes')).toHaveTextContent('2');
});

test('a draft nobody has written to counts nothing', () => {
  // Empty is the state a draft starts in; a "0 changes" label would be noise
  // beside a sentence that already says what is going on.
  renderBanner({ changes: [] });

  expect(screen.queryByTestId('canvas-draft-changes')).not.toBeInTheDocument();
});

test('the list names each change, its widget, and who made it', () => {
  renderBanner({
    changes,
    titles: { rv: 'Revenue by month', ps: 'Pipeline by stage' },
  });

  fireEvent.click(screen.getByTestId('canvas-draft-changes'));

  const listed = screen.getByTestId('canvas-change-list');
  expect(listed).toHaveTextContent('Resized');
  expect(listed).toHaveTextContent('Revenue by month');
  expect(listed).toHaveTextContent('You');
  // The agent's own changes are attributed to it, not to whoever's rights it
  // was acting with.
  expect(listed).toHaveTextContent('Pipeline by stage');
  expect(listed).toHaveTextContent('AI');
});

test('a change to a widget with no title falls back to its node', () => {
  // A removed widget has no title left to look up.
  renderBanner({ changes: [{ kind: 'removed', nodeId: 'ad', by: 'user' }] });

  fireEvent.click(screen.getByTestId('canvas-draft-changes'));

  expect(screen.getByTestId('canvas-change-list')).toHaveTextContent('ad');
});

test('undo and redo follow what the draft says is available', () => {
  renderBanner({ history: { ...history, canUndo: true } });

  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(undo).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

  fireEvent.click(undo);

  expect(history.undo).toHaveBeenCalled();
});

test('stepping is held while a layout change is still saving', () => {
  // An undo replays the draft from its op log; a drop still in flight is not
  // in that log yet, so stepping now would rebuild a draft without it and
  // then have the write land on top.
  renderBanner({ saving: true, history: { ...history, canUndo: true } });

  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('publishing is held while a layout change is still saving', () => {
  renderBanner({ saving: true });

  const publish = screen.getByRole('button', { name: 'Save' });
  expect(publish).toBeDisabled();

  fireEvent.click(publish);

  // Committing now would publish the revision before that change landed and
  // then delete the draft, losing it.
  expect(actions.publish).not.toHaveBeenCalled();
});

test('discarding is held while a layout change is still saving', () => {
  // A discard landing between a save's read and its write-back would delete
  // the draft and then have it recreated by that save, so the token still
  // opens changes the user was told were discarded.
  renderBanner({ saving: true });

  const discard = screen.getByRole('button', { name: 'Discard' });
  expect(discard).toBeDisabled();

  fireEvent.click(discard);

  expect(actions.discard).not.toHaveBeenCalled();
});

test('the banner cannot be dismissed', () => {
  // It is what says a draft is open, and it carries the only two ways to
  // close one. Dismissing it would hide the state and both exits.
  const { container } = renderBanner();

  expect(container.querySelector('.ant-alert-close-icon')).toBeNull();
});
