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

import React from 'react';
import { pages } from '@apache-superset/core';
import ApprovalsPage from './ApprovalsPage';
import ChangeReviewSettings from './ChangeReviewSettings';

/**
 * The page's path and its navigation entry are declared in extension.json.
 * This supplies the component; the host owns the URL.
 */
pages.registerPage(
  { path: '/approvals', name: 'Approvals', permission: 'can_review' },
  ApprovalsPage,
);

// Was a FAB view the extension registered by hand, with a Settings menu
// entry and a `menu_access` permission it had to create itself.
pages.registerPage(
  { path: '/change-review-settings', name: 'Change review' },
  ChangeReviewSettings,
);
