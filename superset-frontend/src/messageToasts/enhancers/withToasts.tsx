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

import { ComponentType } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  addDangerToast,
  addInfoToast,
  addSuccessToast,
  addWarningToast,
} from '../actions';

// To work properly the redux state must have a `messageToasts` subtree
export default function withToasts(BaseComponent: ComponentType) {
  return connect(null, dispatch =>
    bindActionCreators(
      {
        addInfoToast,
        addSuccessToast,
        addWarningToast,
        addDangerToast,
      },
      dispatch,
    ),
  )(BaseComponent) as any;
  // Rsedux has some confusing typings that cause problems for consumers of this function.
  // If someone can fix the types, great, but for now it's just any.
}
