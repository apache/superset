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
 * The display labels for a visualization's Explore controls, by control name.
 *
 * A chart's `params` is keyed by Explore control names -- `adhoc_filters`,
 * `color_by_primary_axis`, `axisTicks` -- which are internal names a reader
 * deciding something about the chart should not have to know. These are the
 * labels the author saw in Explore when they set them, taken from the
 * chart's own control panel, so the two agree.
 *
 * Only controls whose label is a plain string are returned: a label may be
 * a node or a function for a dynamic control, and neither can be dropped
 * into a sentence. A key that is not a control -- `viz_type`, `datasource`,
 * `slice_id` -- is simply absent, so a caller falls back to the raw name.
 *
 * An unknown visualization type yields an empty object rather than
 * throwing; the caller then shows raw keys, which is what it would have
 * shown anyway.
 *
 * @example
 * const labels = charts.controlLabels('table');
 * labels.adhoc_filters // 'Filters'
 */
export declare function controlLabels(vizType: string): Record<string, string>;
