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
 * Class names the embedded API measures the page by. Class names rather than
 * `data-test`, which the production build strips.
 */

/** The dashboard grid: once it is mounted, the layout has its full height. */
export const DASHBOARD_GRID_CLASS = 'dashboard-grid';

/** The vertical filter bar when bounded to its content inside an embed. */
export const FILTER_BAR_BOUNDED_CLASS = 'filter-bar-bounded';

/** The only scrolling part of the bounded filter bar. */
export const FILTER_BAR_SCROLL_CLASS = 'filter-bar-scroll';
