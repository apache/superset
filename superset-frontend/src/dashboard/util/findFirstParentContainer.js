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
import { TABS_TYPE } from './componentTypes';
import { DASHBOARD_ROOT_ID } from './constants';

export default function (layout = {}) {
  // DASHBOARD_GRID_TYPE or TABS_TYPE?
  let parent = layout[DASHBOARD_ROOT_ID];
  if (
    parent &&
    parent.children.length &&
    layout[parent.children[0]].type === TABS_TYPE
  ) {
    const tabs = layout[parent.children[0]];
    parent = layout[tabs.children[0]];
  } else {
    parent = layout[parent.children[0]];
  }

  return parent.id;
}
