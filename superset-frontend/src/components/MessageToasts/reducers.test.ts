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
import { ADD_TOAST, REMOVE_TOAST } from 'src/components/MessageToasts/actions';
import messageToastsReducer from 'src/components/MessageToasts/reducers';
import { ToastMeta, ToastType } from 'src/components/MessageToasts/types';

// messageToasts reducer
test('messageToasts reducer should return initial state', () => {
  expect(
    messageToastsReducer(undefined, { type: '' } as unknown as Parameters<
      typeof messageToastsReducer
    >[1]),
  ).toEqual([]);
});

test('messageToasts reducer should add a toast', () => {
  expect(
    messageToastsReducer([], {
      type: ADD_TOAST,
      payload: {
        text: 'test',
        id: 'id',
        toastType: ToastType.Info,
        duration: 4000,
      },
    }),
  ).toEqual([
    { text: 'test', id: 'id', toastType: ToastType.Info, duration: 4000 },
  ]);
});

test('messageToasts reducer should remove a toast', () => {
  expect(
    messageToastsReducer(
      [
        { id: 'id', toastType: ToastType.Info, text: 'toast1', duration: 4000 },
        {
          id: 'id2',
          toastType: ToastType.Info,
          text: 'toast2',
          duration: 4000,
        },
      ] as ToastMeta[],
      {
        type: REMOVE_TOAST,
        payload: { id: 'id' },
      },
    ),
  ).toEqual([
    { id: 'id2', toastType: ToastType.Info, text: 'toast2', duration: 4000 },
  ]);
});
