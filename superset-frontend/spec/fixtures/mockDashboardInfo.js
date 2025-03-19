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
import { FilterBarOrientation } from 'src/dashboard/types';

export default {
  id: 1234,
  slug: 'dashboardSlug',
  metadata: {
    native_filter_configuration: [
      {
        id: 'DefaultsID',
        filterType: 'filter_select',
        chartsInScope: [],
        targets: [{}],
        cascadeParentIds: [],
      },
    ],
  },
  changed_on_delta_humanized: '7 minutes ago',
  changed_by: {
    id: 3,
    first_name: 'John',
    last_name: 'Doe',
  },
  created_on_delta_humanized: '10 days ago',
  created_by: {
    id: 2,
    first_name: 'Kay',
    last_name: 'Mon',
  },
  owners: [{ first_name: 'John', last_name: 'Doe', id: 1 }],
  userId: 'mock_user_id',
  dash_edit_perm: true,
  dash_save_perm: true,
  common: {
    flash_messages: [],
    conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 },
  },
  filterBarOrientation: FilterBarOrientation.Vertical,
};
