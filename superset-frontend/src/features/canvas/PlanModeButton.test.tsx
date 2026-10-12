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
import PlanModeButton from './PlanModeButton';

const endpoint = 'glob:*/api/v1/canvas/7/draft';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

const clickPlanMode = async (onStarted = jest.fn()) => {
  render(<PlanModeButton canvasId={7} onStarted={onStarted} />, {
    useRedux: true,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Plan mode' }));
  return onStarted;
};

test('starting a plan creates a draft and opens its token', async () => {
  fetchMock.post(endpoint, { result: { token: 'tok-123', revision: 0 } });

  const onStarted = await clickPlanMode();

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith('tok-123'));
  expect(fetchMock.callHistory.calls()).toHaveLength(1);
});

test('a draft that cannot be started does not open anything', async () => {
  fetchMock.post(endpoint, 403);

  const onStarted = await clickPlanMode();

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  expect(onStarted).not.toHaveBeenCalled();
});

test('a response without a token is treated as a failure', async () => {
  fetchMock.post(endpoint, { result: { revision: 0 } });

  const onStarted = await clickPlanMode();

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  expect(onStarted).not.toHaveBeenCalled();
});
