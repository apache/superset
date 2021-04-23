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
import undoable, { includeAction } from 'redux-undo';
import { UNDO_LIMIT } from '../util/constants';
import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
  RESIZE_COMPONENT,
  MOVE_COMPONENT,
  HANDLE_COMPONENT_DROP,
} from '../actions/dashboardLayout';

import dashboardLayout from './dashboardLayout';

export default undoable(dashboardLayout, {
  // +1 because length of history seems max out at limit - 1
  // +1 again so we can detect if we've exceeded the limit
  limit: UNDO_LIMIT + 2,
  filter: includeAction([
    UPDATE_COMPONENTS,
    DELETE_COMPONENT,
    CREATE_COMPONENT,
    CREATE_TOP_LEVEL_TABS,
    DELETE_TOP_LEVEL_TABS,
    RESIZE_COMPONENT,
    MOVE_COMPONENT,
    HANDLE_COMPONENT_DROP,
  ]),
});
