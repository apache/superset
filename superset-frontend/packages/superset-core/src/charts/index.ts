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
 * @fileoverview Drawing a chart from an extension.
 *
 * Deliberately one component. Drawing a chart takes a good deal more than a
 * renderer -- the viz plugin registry, the query pipeline, the dataset's
 * metadata, the async-query machinery -- and none of it is the extension's
 * business. The host owns all of it, so an extension hands over what to draw
 * and receives a chart, and is never exposed to how that happens.
 *
 * This is the same move `http` made for `SupersetClient`: the
 * `@superset-ui/core` package is not shared with extensions, because sharing
 * it made its entire surface accidental API. What an extension needed from it
 * here was `SuperChart`, and what it gets instead is this.
 */

import type { ReactElement } from 'react';

/** What to draw, and how much room it has. */
export interface AssetChartProps {
  /**
   * The chart's form data: the same object Explore holds for a chart, and the
   * one saved as a chart's `params`.
   *
   * `viz_type` names the plugin that draws it and `datasource` names what it
   * is drawn from, as `"<id>__<type>"` (for example `"12__table"`). Without a
   * `viz_type` there is nothing to draw, and the component says so rather than
   * guessing.
   *
   * Pass a stable reference. A new object every render is a new chart: the
   * component queries again whenever this changes identity, so build it with
   * `useMemo` from the values that actually define the chart.
   */
  formData: object;
  /**
   * The height of the area the chart fills. A number is pixels; a string is
   * any CSS length. Defaults to `"100%"`, which needs a parent with a height
   * of its own.
   */
  height?: string | number;
  /** The width of the area the chart fills. Same forms as `height`. */
  width?: string | number;
}

/**
 * Draws the chart that `formData` describes.
 *
 * The component runs the query itself and draws the result with the plugin
 * the form data names -- the same one the real chart panel uses, so what you
 * see is what that chart would be, not a second renderer that could disagree.
 * It shows its own loading state while the query runs and its own message if
 * the query fails; a plugin that throws while drawing degrades to a contained
 * error inside the chart's area rather than taking the page down.
 *
 * It queries as an unsaved chart. The result is not cached against any saved
 * chart, and the charts of the page it sits on -- an open Explore session, a
 * dashboard -- are neither refreshed nor changed by it.
 *
 * What it does not do:
 *
 * - **Does not save, or change anything.** It reads.
 * - **Does not make form data valid.** Settings the plugin cannot draw
 *   surface as an error in the chart's area; they are not corrected.
 * - **Does not apply filters from the page it is on.** It draws exactly the
 *   form data it was given, including its own `adhoc_filters`.
 * - **Does not follow changes to the underlying data.** It queries when
 *   mounted and when `formData` changes, and not on a timer.
 * - **Does not hand back the query result.** An extension that needs the rows
 *   asks the API for them; this draws.
 *
 * What a caller owes it: form data with a `viz_type` and, for a chart with
 * data behind it, a `datasource`; the user's permission to read that
 * dataset (a user who may not gets the query's own refusal as the error); and
 * a parent with a size, unless `height` and `width` say otherwise.
 *
 * @example
 * ```tsx
 * import { charts } from '@apache-superset/core';
 *
 * const formData = useMemo(
 *   () => ({ viz_type: 'table', datasource: '12__table', row_limit: 50 }),
 *   [],
 * );
 *
 * <charts.AssetChart formData={formData} height={320} />
 * ```
 */
export declare function AssetChart(props: AssetChartProps): ReactElement;

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

/**
 * The default value of each of a visualization's Explore controls, by name.
 *
 * The companion to `controlLabels`, read from the same control panel, and
 * the answer to "was this setting changed, or merely written down?".
 *
 * Explore hydrates a chart's stored `params` with these before the author
 * sees it and posts the whole hydrated form back on save, so a chart stored
 * without a key arrives carrying that key -- a reader comparing stored
 * against posted sees it as new and cannot tell a ticked checkbox from a
 * default being recorded. Superset's own "this chart differs from its saved
 * version" diff does not have the problem: it compares two hydrated form
 * data objects inside Explore. Anything comparing against the stored row
 * needs the defaults, and the control panel registry is a host internal.
 *
 * Only controls that declare a `default` are returned, so an absent key
 * means "no default to compare against" and not "the default is undefined".
 * A caller must treat those as unknown rather than as a change.
 *
 * An unknown visualization type yields an empty object rather than
 * throwing, matching `controlLabels`.
 *
 * @example
 * const defaults = charts.controlDefaults('pie');
 * defaults.donut // false
 */
export declare function controlDefaults(vizType: string): Record<string, unknown>;
