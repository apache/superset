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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

export const DASHBOARD_WORKSPACE_PAGE_SIZE = 100;

export const DASHBOARD_WORKSPACE_LIST_COLUMNS = [
  'id',
  'dashboard_title',
  'published',
  'url',
  'slug',
  'description',
  'changed_by',
  'changed_by.id',
  'changed_by.first_name',
  'changed_by.last_name',
  'changed_on_delta_humanized',
  'editors.id',
  'editors.label',
  'editors.img',
  'editors.type',
  'tags.id',
  'tags.name',
  'tags.type',
  'status',
  'certified_by',
  'certification_details',
  'changed_on',
  ...(isFeatureEnabled(FeatureFlag.EnableViewers)
    ? ['viewers.id', 'viewers.label', 'viewers.img', 'viewers.type']
    : []),
];

/** Optional bootstrap key: `common.conf.DASHBOARD_WORKSPACE_DEFAULT_SLUG` */
export function getDashboardWorkspaceDefaultSlug(): string | undefined {
  const slug = getBootstrapData()?.common?.conf?.DASHBOARD_WORKSPACE_DEFAULT_SLUG;
  return typeof slug === 'string' && slug.length > 0 ? slug : undefined;
}
