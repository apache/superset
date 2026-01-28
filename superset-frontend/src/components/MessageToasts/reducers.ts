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
import { ToastMeta } from './types';

interface AddToastAction {
  type: typeof ADD_TOAST;
  payload: ToastMeta;
}

interface RemoveToastAction {
  type: typeof REMOVE_TOAST;
  payload: {
    id: string;
  };
}

type ToastAction = AddToastAction | RemoveToastAction;

export default function messageToastsReducer(
  toasts: ToastMeta[] = [],
  action: ToastAction,
): ToastMeta[] {
  switch (action.type) {
    case ADD_TOAST: {
      const { payload: toast } = action;
      const result = toasts.slice();
      if (!toast.noDuplicate || !result.find(x => x.text === toast.text)) {
        return [toast, ...toasts];
      }
      return toasts;
    }

    case REMOVE_TOAST: {
      const {
        payload: { id },
      } = action;
      return [...toasts].filter(toast => toast.id !== id);
    }

    default:
      return toasts;
  }
}
