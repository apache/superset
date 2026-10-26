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

/**
 * @fileoverview Everything behind `/approvals`.
 *
 * There is only the list. A change request has no page of its own, because
 * the mocks give it none: a dashboard or chart is reviewed on the asset,
 * where the banner and the in-place panel are (screens 9-12), and a dataset
 * is reviewed in the dataset editor's own tabs, read-only (screen 13),
 * which opens from the list.
 *
 * This file used to route `/<id>` and `/<id>/review` to a detail screen.
 * Both were invented -- the second by me, on top of a page the epic had
 * added as a dataset fallback -- and neither appears among the 33 mocks.
 */

import React from 'react';
import Approvals from './Approvals';

export default function ApprovalsPage() {
  return <Approvals />;
}
