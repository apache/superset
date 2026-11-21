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
import { TextModal } from '.';

jest.mock('src/components/CopyToClipboard', () => ({
  CopyToClipboard: ({ text }: { text: string }) => (
    <span data-test="mock-copy-to-clipboard" data-copy-text={text} />
  ),
}));

const multiLineValue = 'first line\nsecond line\n  indented third line';

test('renders the trigger without opening the modal', () => {
  render(<TextModal modalTitle="Cell content" value="some value" />, {
    useRedux: true,
  });
  expect(screen.getByText('some value')).toBeInTheDocument();
  expect(screen.queryByTestId('text-modal-body')).not.toBeInTheDocument();
});

test('renders a custom trigger node when provided', () => {
  render(
    <TextModal
      modalTitle="Cell content"
      value="raw value"
      triggerNode="formatted value"
    />,
    { useRedux: true },
  );
  expect(screen.getByText('formatted value')).toBeInTheDocument();
  expect(screen.queryByText('raw value')).not.toBeInTheDocument();
});

test('opens a modal showing the full value with line breaks preserved', () => {
  render(
    <TextModal
      modalTitle="Cell content"
      value={multiLineValue}
      triggerNode="trigger"
    />,
    { useRedux: true },
  );
  fireEvent.click(screen.getByText('trigger'));
  expect(screen.getByText('Cell content')).toBeInTheDocument();
  expect(screen.getByTestId('text-modal-body').textContent).toBe(
    multiLineValue,
  );
});

test('copies the original, unmodified value', () => {
  render(
    <TextModal
      modalTitle="Cell content"
      value={multiLineValue}
      triggerNode="trigger"
    />,
    { useRedux: true },
  );
  fireEvent.click(screen.getByText('trigger'));
  expect(screen.getByTestId('mock-copy-to-clipboard')).toHaveAttribute(
    'data-copy-text',
    multiLineValue,
  );
});

test('does not open the modal when the click ends a text selection', () => {
  jest.spyOn(window, 'getSelection').mockReturnValue({
    toString: () => 'some',
  } as unknown as Selection);
  render(
    <TextModal
      modalTitle="Cell content"
      value="some value"
      triggerNode="trigger"
    />,
    { useRedux: true },
  );
  fireEvent.click(screen.getByText('trigger'));
  expect(screen.queryByTestId('text-modal-body')).not.toBeInTheDocument();
  jest.restoreAllMocks();
});
