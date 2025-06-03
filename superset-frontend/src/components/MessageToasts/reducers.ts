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
import { ADD_TOAST, REMOVE_TOAST } from './actions';

export default function messageToastsReducer(toasts = [], action: $TSFixMe) {
  switch (action.type) {
    case ADD_TOAST: {
      const { payload: toast } = action;
      const result = toasts.slice();
      // @ts-expect-error TS(2339): Property 'text' does not exist on type 'never'.
      if (!toast.noDuplicate || !result.find(x => x.text === toast.text)) {
        return [toast, ...toasts];
      }
      return toasts;
    }

    case REMOVE_TOAST: {
      const {
        payload: { id },
      } = action;
      // @ts-expect-error TS(2339): Property 'id' does not exist on type 'never'.
      return [...toasts].filter(toast => toast.id !== id);
    }

    default:
      return toasts;
  }
}
