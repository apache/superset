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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import copyTextToClipboard from 'src/utils/copy';
import SyntaxHighlighterCopy from './SyntaxHighlighterCopy';

jest.mock('src/utils/copy', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));

test('renders the copy control as a native button and copies on click', async () => {
  const addSuccessToast = jest.fn();
  render(
    <SyntaxHighlighterCopy language="sql" addSuccessToast={addSuccessToast}>
      SELECT 1
    </SyntaxHighlighterCopy>,
  );

  const button = screen.getByRole('button', {
    name: 'Copy code to clipboard',
  });
  expect(button.tagName).toBe('BUTTON');

  await userEvent.click(button);

  await waitFor(() => expect(addSuccessToast).toHaveBeenCalled());
  expect(copyTextToClipboard).toHaveBeenCalledTimes(1);
});

test('copy button is reachable by keyboard', async () => {
  render(
    <SyntaxHighlighterCopy language="sql">SELECT 1</SyntaxHighlighterCopy>,
  );

  await userEvent.tab();

  expect(
    screen.getByRole('button', { name: 'Copy code to clipboard' }),
  ).toHaveFocus();
});
