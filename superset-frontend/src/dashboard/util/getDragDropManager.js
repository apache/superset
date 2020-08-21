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
import { DragDropManager } from 'dnd-core';
import HTML5Backend from 'react-dnd-html5-backend';

let defaultManager;

// we use this method to ensure that there is a singleton of the DragDropManager
// within the app this seems to work fine, but in tests multiple are initialized
// see this issue for more details https://github.com/react-dnd/react-dnd/issues/186
// @TODO re-evaluate whether this is required when we move to jest
// the alternative is simply using an HOC like:
//  DragDropContext(HTML5Backend)(DashboardBuilder);
export default function getDragDropManager() {
  if (!defaultManager) {
    defaultManager = new DragDropManager(HTML5Backend);
  }
  return defaultManager;
}
