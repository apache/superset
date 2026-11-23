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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PublishConfirmation from './PublishConfirmation';
import type { PublishReview } from './useDraftActions';

const review = (): PublishReview => ({
  parts: [
    {
      title: 'Revenue notes',
      lines: ['Reads Sales as each viewer', 'Uses d3 7.9.0'],
      publish: () => Promise.resolve(),
    },
  ],
  outcomes: [],
  confirm: jest.fn(),
  cancel: jest.fn(),
});

const part = (title: string) => ({
  title,
  lines: [`What ${title} asks`],
  publish: () => Promise.resolve(),
});

const ended = (
  end: PublishReview['end'],
  outcomes: PublishReview['outcomes'],
): PublishReview => ({
  parts: [part('Maps'), part('Notes'), part('Prices')],
  outcomes,
  end,
  confirm: jest.fn(),
  cancel: jest.fn(),
});

test('the person reads every part before anything is published', async () => {
  const shown = review();
  render(<PublishConfirmation review={shown} busy={false} />);

  expect(screen.getByText('Publish this canvas?')).toBeInTheDocument();
  expect(screen.getByText('Revenue notes')).toBeInTheDocument();
  expect(screen.getByText('Reads Sales as each viewer')).toBeInTheDocument();
  expect(screen.getByText('Uses d3 7.9.0')).toBeInTheDocument();
  expect(shown.confirm).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

  expect(shown.confirm).toHaveBeenCalled();
});

test('cancelling closes the review', async () => {
  const shown = review();
  render(<PublishConfirmation review={shown} busy={false} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(shown.cancel).toHaveBeenCalled();
  expect(shown.confirm).not.toHaveBeenCalled();
});

test('nothing is shown while nothing is reviewed', () => {
  render(<PublishConfirmation review={undefined} busy={false} />);

  expect(screen.queryByText('Publish this canvas?')).toBeNull();
});

test('a publish that stopped partway says what went out, and that the canvas did not', async () => {
  const shown = ended(
    {
      state: 'stopped',
      reason: "Notes wasn't published, so the canvas wasn't either.",
      retry: true,
    },
    [
      { state: 'published', notices: [] },
      { state: 'failed', message: 'Its server check failed' },
    ],
  );
  render(<PublishConfirmation review={shown} busy={false} />);

  expect(screen.getByText("The canvas wasn't published")).toBeInTheDocument();
  const [maps, notes, prices] = screen.getAllByTestId('canvas-publish-part');
  expect(maps).toHaveTextContent('Maps Published');
  expect(notes).toHaveTextContent('Not published: Its server check failed');
  expect(prices).toHaveTextContent('Prices Not published');
  expect(
    screen.getByText("Notes wasn't published, so the canvas wasn't either."),
  ).toBeInTheDocument();
  // What the parts asked was read already; it isn't listed again.
  expect(screen.queryByText('What Maps asks')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Publish again' }));
  expect(shown.confirm).toHaveBeenCalled();

  await userEvent.click(screen.getByText('Close'));
  expect(shown.cancel).toHaveBeenCalled();
});

test('a stop that publishing again cannot help offers only to close', async () => {
  const shown = ended(
    {
      state: 'stopped',
      reason: 'The canvas changed since this draft started; start a new draft.',
      retry: false,
    },
    [{ state: 'published', notices: [] }],
  );
  render(<PublishConfirmation review={shown} busy={false} />);

  expect(
    screen.getByText(
      'The canvas changed since this draft started; start a new draft.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Publish again' })).toBeNull();

  await userEvent.click(screen.getByText('Close'));

  expect(shown.cancel).toHaveBeenCalled();
  expect(shown.confirm).not.toHaveBeenCalled();
});

test("a part's notices show under it once it is published", async () => {
  const shown = ended({ state: 'published' }, [
    {
      state: 'published',
      notices: ['Published without a server check: no check runner here.'],
    },
    { state: 'published', notices: [] },
    { state: 'published', notices: [] },
  ]);
  render(<PublishConfirmation review={shown} busy={false} />);

  expect(screen.getByText('Canvas published')).toBeInTheDocument();
  const [maps, notes] = screen.getAllByTestId('canvas-publish-part');
  expect(maps).toHaveTextContent(
    'Published without a server check: no check runner here.',
  );
  expect(notes).not.toHaveTextContent('server check');

  await userEvent.click(screen.getByRole('button', { name: 'OK' }));

  expect(shown.cancel).toHaveBeenCalled();
});
