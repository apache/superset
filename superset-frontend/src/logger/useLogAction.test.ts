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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { renderHook } from '@testing-library/react-hooks';
import { createWrapper } from 'spec/helpers/testing-library';
import useLogAction from './useLogAction';
import { LOG_ACTIONS_SQLLAB_COPY_LINK } from './LogUtils';
import { LOG_EVENT } from './actions';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

test('dispatches logEvent action with static EventData', () => {
  const staticEventData = { staticEventKey: 'value1' };
  const store = mockStore();
  const { result } = renderHook(() => useLogAction(staticEventData), {
    wrapper: createWrapper({
      useRedux: true,
      store,
    }),
  });
  result.current(LOG_ACTIONS_SQLLAB_COPY_LINK, { count: 1 });
  store.getActions();
  expect(store.getActions()).toEqual([
    {
      type: LOG_EVENT,
      payload: {
        eventName: LOG_ACTIONS_SQLLAB_COPY_LINK,
        eventData: {
          payload: {
            ...staticEventData,
            count: 1,
          },
        },
      },
    },
  ]);
});
