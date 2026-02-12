/*
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

export const kpiData = [
  {
    metric: 'Total Revenue',
    value: 2847563,
    change: 12.5,
    target: 2500000,
    icon: '💰',
    status: 'success',
  },
  {
    metric: 'Active Users',
    value: 84521,
    change: -3.2,
    target: 90000,
    icon: '👥',
    status: 'warning',
  },
  {
    metric: 'Conversion Rate',
    value: 4.7,
    change: 0.8,
    target: 5.0,
    icon: '📈',
    status: 'success',
  },
  {
    metric: 'Avg Response Time',
    value: 142,
    change: -15.3,
    target: 150,
    icon: '⚡',
    status: 'success',
  },
];

export const leaderboardData = [
  {
    rank: 1,
    name: 'Sarah Chen',
    team: 'Engineering',
    score: 2847,
    avatar: '👩‍💻',
    trend: 'up',
  },
  {
    rank: 2,
    name: 'Marcus Johnson',
    team: 'Sales',
    score: 2654,
    avatar: '👨‍💼',
    trend: 'up',
  },
  {
    rank: 3,
    name: 'Emily Rodriguez',
    team: 'Marketing',
    score: 2432,
    avatar: '👩‍🎨',
    trend: 'down',
  },
  {
    rank: 4,
    name: 'David Kim',
    team: 'Engineering',
    score: 2198,
    avatar: '👨‍💻',
    trend: 'up',
  },
  {
    rank: 5,
    name: 'Lisa Thompson',
    team: 'Support',
    score: 2045,
    avatar: '👩‍🔧',
    trend: 'same',
  },
];

export const timelineData = [
  {
    date: '2024-01-15',
    event: 'Product Launch',
    type: 'milestone',
    description: 'Successfully launched v2.0 to production',
  },
  {
    date: '2024-01-10',
    event: 'Beta Testing Complete',
    type: 'success',
    description: '500+ users tested with 98% satisfaction',
  },
  {
    date: '2024-01-05',
    event: 'Security Audit',
    type: 'warning',
    description: '2 minor issues found and resolved',
  },
  {
    date: '2023-12-20',
    event: 'Development Sprint',
    type: 'info',
    description: 'Completed 47 story points',
  },
  {
    date: '2023-12-15',
    event: 'Design Review',
    type: 'info',
    description: 'UI/UX approved by stakeholders',
  },
];
