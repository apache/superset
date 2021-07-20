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

import { ComponentType, useMemo } from 'react';
import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';

import {
  addDangerToast,
  addInfoToast,
  addSuccessToast,
  addWarningToast,
} from '../actions';

export interface ToastProps {
  addDangerToast: typeof addDangerToast;
  addInfoToast: typeof addInfoToast;
  addSuccessToast: typeof addSuccessToast;
  addWarningToast: typeof addWarningToast;
}

const toasters = {
  addInfoToast,
  addSuccessToast,
  addWarningToast,
  addDangerToast,
};

// To work properly the redux state must have a `messageToasts` subtree
export default function withToasts(BaseComponent: ComponentType<any>) {
  return connect(null, dispatch => bindActionCreators(toasters, dispatch))(
    BaseComponent,
  ) as any;
  // Redux has some confusing typings that cause problems for consumers of this function.
  // If someone can fix the types, great, but for now it's just any.
}

export function useToasts() {
  const dispatch = useDispatch();
  return useMemo(() => bindActionCreators(toasters, dispatch), [dispatch]);
}
