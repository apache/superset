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
 * @fileoverview What a widget is called, in the one place every panel that
 * names one can reach.
 *
 * A widget is named in more than one part of the editor — its own header on
 * the canvas, its row in the outline — and those have to agree. A widget
 * called "Sales by Territory" in one and "ECharts" in the other reads as two
 * different widgets.
 */

import { views } from 'src/core/views';
import { DASHBOARD_WIDGETS_LOCATION } from './resolveWidgetView';

type Props = Record<string, unknown> | undefined;

/**
 * The ECharts option's own title, which is where a chart's name is authored
 * — the structured `chrome.title.text` when set (mirroring
 * `applyStructuredChrome`'s own precedence: a set structured leaf wins for
 * the property it manages), else the raw `echartsOptions.title`.
 *
 * ECharts accepts either one title or an array of them; the first is the
 * chart's, and any others annotate parts of it.
 */
const echartsTitle = (props: Props): unknown => {
  const chromeText = (
    props?.chrome as { title?: { text?: unknown } } | undefined
  )?.title?.text;
  if (typeof chromeText === 'string' && chromeText !== '') return chromeText;
  const title = (props?.echartsOptions as { title?: unknown } | undefined)
    ?.title;
  const first = Array.isArray(title) ? title[0] : title;
  return (first as { text?: unknown } | undefined)?.text;
};

/**
 * Where a widget type carries a name of its own, distinct from what it
 * renders.
 *
 * `markdown` is deliberately not here. A chart's title or a tile's label is
 * a field the widget reads once and renders once — naming the widget by it
 * and having `ChartWidget` skip drawing its own copy (see `ChartWidget`'s own
 * comment) is what keeps it appearing exactly once, in the header, rather
 * than twice. Markdown's `content` is not that: it is the whole of what the
 * widget renders, not a field carved out of it, so echoing it into the
 * header would print the same words a second time right above the ones the
 * author actually wrote — most visibly when that content is nothing but a
 * heading, where the two would read as identical. Everything else here is
 * named by its registration.
 */
const NAMED_BY: Record<string, (props: Props) => unknown> = {
  echarts: echartsTitle,
  'metric-tile': props => props?.label,
  tab: props => props?.label,
  collapsible: props => props?.label,
  slide: props => props?.label,
};

/**
 * Types that go unnamed rather than falling back to their registered name.
 *
 * Every other type says something a reader cannot already see just by
 * looking at the widget — "Table" for a grid with no title of its own,
 * "ECharts" for a chart nobody has titled yet. A markdown widget has no such
 * gap to fill: its entire rendered body sits right below the header, so
 * "Markdown" would be one more label repeating what the reader is already
 * looking at, rather than standing in for something otherwise missing.
 * `carousel` is here for a different reason: it is meant to read as just a
 * slide's own content and the dots beside it, not as a slide sitting inside
 * a captioned card — the same idea `CarouselWidget`'s own missing title bar
 * carries further.
 */
const UNNAMED: ReadonlySet<string> = new Set(['markdown', 'carousel']);

/**
 * What to call the widget of `type` holding `props`, or `''` for one that
 * goes unnamed (see `UNNAMED`) — callers skip the header's name entirely
 * for those rather than rendering an empty label.
 *
 * A name the widget's own content carries wins, because that is the name its
 * author gave it and the one they will look for. Only when there is none does
 * this fall back to the registered widget name — "Table" — which says what a
 * widget is rather than which one it is, and is worth nothing at all when
 * five of them sit in a column.
 *
 * Returned whole: how much of a long name fits is the caller's business,
 * since a row in a panel and a header on a wide chart cut at different
 * points.
 */
export function widgetLabel(type: string, props: Props): string {
  if (UNNAMED.has(type)) return '';
  const own = NAMED_BY[type]?.(props);
  if (typeof own === 'string' && own.trim() !== '') {
    return own.trim().replace(/\s+/g, ' ');
  }
  const registered = views
    .getViews(DASHBOARD_WIDGETS_LOCATION)
    ?.find(view => view.id === type);
  return registered?.name ?? type;
}
