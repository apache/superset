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
import { RootState } from 'src/dashboard/types';

/**
 * Selector to check if the current dashboard is a template.
 * Template dashboards are read-only and cannot be edited.
 *
 * Template metadata is stored in the nested "template_info" structure
 * within the dashboard's metadata.
 */
export const selectIsTemplateDashboard = (state: RootState): boolean =>
  !!state.dashboardInfo?.metadata?.template_info?.is_template;
