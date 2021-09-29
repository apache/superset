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
import { ToastType } from 'src/components/MessageToasts/types';
import getToastsFromPyFlashMessages from 'src/components/MessageToasts/getToastsFromPyFlashMessages';

describe('getToastsFromPyFlashMessages', () => {
  it('should return an info toast', () => {
    const toast = getToastsFromPyFlashMessages([['info', 'info test']])[0];
    expect(toast).toMatchObject({
      toastType: ToastType.INFO,
      text: 'info test',
    });
  });

  it('should return a success toast', () => {
    const toast = getToastsFromPyFlashMessages([
      ['success', 'success test'],
    ])[0];
    expect(toast).toMatchObject({
      toastType: ToastType.SUCCESS,
      text: 'success test',
    });
  });

  it('should return a danger toast', () => {
    const toast = getToastsFromPyFlashMessages([['danger', 'danger test']])[0];
    expect(toast).toMatchObject({
      toastType: ToastType.DANGER,
      text: 'danger test',
    });
  });
});
