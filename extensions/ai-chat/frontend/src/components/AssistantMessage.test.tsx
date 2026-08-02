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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssistantMessage from './AssistantMessage';

const LONG = '## Revenue overview\n\nThe dashboard tracks revenue by region.';
/** No bulk fold has been asked for yet. */
const UNFOLDED = { seq: 0, collapsed: false };

function expanded(): string | null {
  return (
    document.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') ??
    null
  );
}

function mockClipboard() {
  const writeText = jest.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

test('a long reply collapses under a title derived from its content', async () => {
  render(<AssistantMessage content={LONG} fold={UNFOLDED} />);
  expect(screen.getByText('Revenue overview')).toBeInTheDocument();
  expect(
    screen.getByText('The dashboard tracks revenue by region.'),
  ).toBeInTheDocument();

  // antd keeps collapsed content mounted for its animation, so the
  // expanded/collapsed state is asserted semantically.
  expect(expanded()).toBe('true');

  await userEvent.click(screen.getByText('Revenue overview'));
  await waitFor(() => expect(expanded()).toBe('false'));
  // The title stays visible so a collapsed reply is still identifiable.
  expect(screen.getByText('Revenue overview')).toBeInTheDocument();
});

test('copying puts the whole message on the clipboard, not the title', async () => {
  const writeText = mockClipboard();
  render(<AssistantMessage content={LONG} fold={UNFOLDED} />);

  await userEvent.click(screen.getByTestId('chat-message-copy'));
  expect(writeText).toHaveBeenCalledWith(LONG);
  // The body is still expanded: copying must not toggle the panel.
  expect(
    screen.getByText('The dashboard tracks revenue by region.'),
  ).toBeInTheDocument();
  expect(await screen.findByLabelText('Copied')).toBeInTheDocument();
});

test('a short reply is shown plainly, with copy but no collapse', () => {
  render(<AssistantMessage content="All good." fold={UNFOLDED} />);
  // Rendered once, not duplicated as its own title.
  expect(screen.getAllByText('All good.')).toHaveLength(1);
  expect(screen.getByTestId('chat-message-copy')).toBeInTheDocument();
});

test('the fold signal folds an expanded reply, then reopens it', async () => {
  const { rerender } = render(
    <AssistantMessage content={LONG} fold={UNFOLDED} />,
  );
  expect(expanded()).toBe('true');

  rerender(
    <AssistantMessage content={LONG} fold={{ seq: 1, collapsed: true }} />,
  );
  await waitFor(() => expect(expanded()).toBe('false'));

  rerender(
    <AssistantMessage content={LONG} fold={{ seq: 2, collapsed: false }} />,
  );
  await waitFor(() => expect(expanded()).toBe('true'));
});

test('a reply that arrives after a fold-all still opens expanded', () => {
  // The instruction predates this reply, so it does not apply to it.
  render(
    <AssistantMessage content={LONG} fold={{ seq: 4, collapsed: true }} />,
  );
  expect(expanded()).toBe('true');
});
