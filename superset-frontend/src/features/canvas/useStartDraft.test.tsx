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
import fetchMock from 'fetch-mock';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { useStartDraft } from './useStartDraft';

const endpoint = 'glob:*/api/v1/canvas/*/draft';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

/** The hook's two outputs, as a button and a word. */
function Harness({
  canvasId,
  onStarted,
}: {
  canvasId: number;
  onStarted: (token: string) => void;
}) {
  const { start, starting } = useStartDraft(canvasId, onStarted);
  return (
    <button type="button" onClick={start}>
      {starting ? 'starting' : 'idle'}
    </button>
  );
}

const renderHarness = (onStarted = jest.fn(), canvasId = 7) => {
  const view = render(<Harness canvasId={canvasId} onStarted={onStarted} />, {
    useRedux: true,
  });
  return { ...view, onStarted };
};

/**
 * Waits until the response has actually been handled.
 *
 * The request being *issued* is not enough: a `waitFor` on the call history is
 * satisfied the moment the POST goes out, so anything asserted after it runs
 * before the response continuation does, and a missing guard inside that
 * continuation still passes. `starting` is cleared in `finally`, which runs
 * only once the whole handler has.
 */
const settled = async () =>
  waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('idle'));

test('starting a draft opens its token', async () => {
  fetchMock.post(endpoint, { result: { token: 'tok-123', revision: 0 } });
  const { onStarted } = renderHarness();

  fireEvent.click(screen.getByRole('button'));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith('tok-123'));
  expect(fetchMock.callHistory.calls()).toHaveLength(1);
});

test('a draft that cannot be started does not open anything', async () => {
  fetchMock.post(endpoint, 403);
  const { onStarted } = renderHarness();

  fireEvent.click(screen.getByRole('button'));

  await settled();
  expect(onStarted).not.toHaveBeenCalled();
  expect(fetchMock.callHistory.calls()).toHaveLength(1);
});

test('a response without a token is treated as a failure', async () => {
  fetchMock.post(endpoint, { result: { revision: 0 } });
  const { onStarted } = renderHarness();

  fireEvent.click(screen.getByRole('button'));

  await settled();
  expect(onStarted).not.toHaveBeenCalled();
  expect(fetchMock.callHistory.calls()).toHaveLength(1);
});

test('a draft that arrives after the canvas changed is not opened', async () => {
  // Starting a draft on one canvas and navigating to another before the
  // response: the token belongs to the first canvas, and opening it on the
  // second would show that canvas's draft and publish to it.
  let respond: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    respond = () =>
      resolve(
        new Response(JSON.stringify({ result: { token: 'tok-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  });
  fetchMock.post(endpoint, () => held);
  const { rerender, onStarted } = renderHarness();

  fireEvent.click(screen.getByRole('button'));
  // The user moves on to another canvas before the draft comes back.
  rerender(<Harness canvasId={8} onStarted={onStarted} />);

  respond();

  // Only once the handler has run past the guard is the assertion meaningful.
  await settled();
  expect(onStarted).not.toHaveBeenCalled();
});
