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
import { ADD_TOAST, REMOVE_TOAST } from '../../../../src/messageToasts/actions';
import messageToastsReducer from '../../../../src/messageToasts/reducers';

describe('messageToasts reducer', () => {
  it('should return initial state', () => {
    expect(messageToastsReducer(undefined, {})).toEqual([]);
  });

  it('should add a toast', () => {
    expect(
      messageToastsReducer([], {
        type: ADD_TOAST,
        payload: { text: 'test', id: 'id', type: 'test_type' },
      }),
    ).toEqual([{ text: 'test', id: 'id', type: 'test_type' }]);
  });

  it('should remove a toast', () => {
    expect(
      messageToastsReducer([{ id: 'id' }, { id: 'id2' }], {
        type: REMOVE_TOAST,
        payload: { id: 'id' },
      }),
    ).toEqual([{ id: 'id2' }]);
  });
});
