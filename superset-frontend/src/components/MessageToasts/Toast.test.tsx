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
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import Toast from 'src/components/MessageToasts/Toast';
import { ToastMeta } from 'src/components/MessageToasts/types';
import mockMessageToasts from './mockMessageToasts';

const props = {
  toast: mockMessageToasts[0] as ToastMeta,
  onCloseToast() {},
};

const setup = (overrideProps?: Record<string, unknown>) =>
  render(<Toast {...props} {...overrideProps} />);

test('should render', () => {
  const { getByTestId } = setup();
  expect(getByTestId('toast-container')).toBeInTheDocument();
});

test('should render toastText within the div', () => {
  const { getByTestId } = setup();
  expect(getByTestId('toast-container')).toHaveTextContent(props.toast.text);
});

test('should call onCloseToast upon toast dismissal', async () => {
  const onCloseToast = jest.fn();
  const { getByTestId } = setup({ onCloseToast });
  fireEvent.click(getByTestId('close-button'));
  await waitFor(() => expect(onCloseToast).toHaveBeenCalledTimes(1));
  expect(onCloseToast).toHaveBeenCalledWith(props.toast.id);
});

/**
 * The recovery toast is the only `allowHtml` consumer, and its whole purpose
 * is the anchor it carries. Its copy-level test asserts the markup string,
 * which passes whether or not the rendered anchor keeps its `href`, so these
 * assert the rendered attribute instead.
 *
 * Interweave permits `href` on an anchor without `allowAttributes` (the
 * `ALLOWED_ATTRS` regex is a fallback for attributes its tag config does not
 * already know), so this passes today. It is here to catch an upgrade that
 * changes that, since the failure mode is a link that looks fine and does
 * nothing.
 */
const htmlToast = (text: string) =>
  ({
    ...props.toast,
    text,
    allowHtml: true,
  }) as ToastMeta;

test('an allowHtml toast keeps the href on its link', () => {
  const { getByRole } = setup({
    toast: htmlToast(
      'My Chart restored successfully <a href="/explore/?slice_id=7">View Chart →</a>',
    ),
  });

  expect(getByRole('link', { name: /View Chart/ })).toHaveAttribute(
    'href',
    '/explore/?slice_id=7',
  );
});

// Assembled rather than written literally so the linter's no-script-url rule
// does not flag the payload this test exists to prove is neutralised.
const SCRIPT_SCHEME = 'java'.concat('script');

test('an allowHtml toast still drops event handlers and script URIs', () => {
  const { getByTestId, queryByRole } = setup({
    toast: htmlToast(
      `<a href="${SCRIPT_SCHEME}:alert(1)" onclick="alert(2)">Click</a>`,
    ),
  });

  const container = getByTestId('toast-container');
  expect(container.innerHTML).not.toContain('onclick');
  expect(container.innerHTML).not.toContain(`${SCRIPT_SCHEME}:`);
  // The anchor is stripped of its href rather than rendered as a live link.
  expect(queryByRole('link')).not.toBeInTheDocument();
});

test('a toast without allowHtml renders markup as inert text', () => {
  const { getByTestId, queryByRole } = setup({
    toast: { ...props.toast, text: '<a href="/x">nope</a>' } as ToastMeta,
  });

  expect(queryByRole('link')).not.toBeInTheDocument();
  expect(getByTestId('toast-container')).toHaveTextContent('nope');
});

test('a link requested through the action creator survives to the rendered toast', () => {
  // Integration-shaped on purpose: the flag has to cross the addToast hop,
  // where it was once dropped by a destructure-and-rebuild while every test
  // stayed green -- they all injected allowHtml downstream of the drop. This
  // is the only test that would have caught it.
  const { addSuccessToast } = jest.requireActual(
    'src/components/MessageToasts/actions',
  );
  const action = addSuccessToast(
    'Chart restored. <a href="/explore/?slice_id=1">View</a>',
    { allowHtml: true },
  );

  const toast = action.payload as ToastMeta;
  expect(toast.allowHtml).toBe(true);

  const { getByTestId } = setup({ toast });
  const link = getByTestId('toast-container').querySelector('a');
  expect(link).not.toBeNull();
  expect(link).toHaveAttribute('href', '/explore/?slice_id=1');
});
