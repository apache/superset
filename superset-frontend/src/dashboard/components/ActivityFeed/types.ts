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

export type ActionTypeFilter =
  | 'all'
  | 'view'
  | 'edit'
  | 'export'
  | 'chart_interaction';

export interface ActivityUser {
  id: number | null;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface ActivityItem {
  id: number;
  action: string;
  action_category: 'view' | 'edit' | 'export' | 'chart_interaction' | 'other';
  action_display: string;
  user: ActivityUser;
  timestamp: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  duration_ms?: number | null;
  details?: Record<string, unknown> | null;
}

export interface ActivityFeedResponse {
  activities: ActivityItem[];
  count: number;
  has_more?: boolean;
  page: number;
  page_size: number;
}

export interface ActivitySummary {
  total_views: number;
  unique_viewers: number;
  views_today: number;
  recent_editors: string[];
  period_days: number;
}
