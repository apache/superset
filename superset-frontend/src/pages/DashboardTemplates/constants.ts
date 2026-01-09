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

import { t } from '@superset-ui/core';
import { DashboardTemplate } from './types';

export const BLANK_TEMPLATE: DashboardTemplate = {
  id: null,
  uuid: 'blank',
  dashboard_title: t('Start from blank'),
  template_description: t('Create a new dashboard from scratch'),
  template_category: null,
  is_featured_template: false,
  is_template: false,
  template_thumbnail_url: null,
  template_tags: [],
};

export const FEATURED = t('Featured');
export const ALL_TEMPLATES = t('All Templates');
export const OTHER_CATEGORY = t('Other');
