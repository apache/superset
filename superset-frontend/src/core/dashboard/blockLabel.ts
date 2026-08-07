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
 * @fileoverview What a block is called, in the one place every panel that
 * names one can reach.
 *
 * A block is named in more than one part of the editor — its own header on
 * the canvas, its row in the outline — and those have to agree. A block
 * called "Sales by Territory" in one and "ECharts" in the other reads as two
 * different blocks.
 */

import { views } from 'src/core/views';
import { DASHBOARD_BUILDING_BLOCKS_LOCATION } from './resolveBuildingBlockView';

type Props = Record<string, unknown> | undefined;

/**
 * The ECharts option's own title, which is where a chart's name is authored.
 *
 * ECharts accepts either one title or an array of them; the first is the
 * chart's, and any others annotate parts of it.
 */
const echartsTitle = (props: Props): unknown => {
  const title = (props?.echartsOptions as { title?: unknown } | undefined)
    ?.title;
  const first = Array.isArray(title) ? title[0] : title;
  return (first as { text?: unknown } | undefined)?.text;
};

/**
 * Where a block type carries a name of its own.
 *
 * Only the types that have one: everything else is named by its registration,
 * and an unlisted type — an extension's — falls through to that without
 * needing to be known here.
 */
const NAMED_BY: Record<string, (props: Props) => unknown> = {
  markdown: props => props?.content,
  echarts: echartsTitle,
  'metric-tile': props => props?.label,
};

/**
 * What to call the block of `type` holding `props`.
 *
 * A name the block's own content carries wins, because that is the name its
 * author gave it and the one they will look for. Only when there is none does
 * this fall back to the registered block name — "Markdown", "Table" — which
 * says what a block is rather than which one it is, and is worth nothing at
 * all when five of them sit in a column.
 *
 * Returned whole: how much of a long name fits is the caller's business,
 * since a row in a panel and a header on a wide chart cut at different
 * points.
 */
export function blockLabel(type: string, props: Props): string {
  const own = NAMED_BY[type]?.(props);
  if (typeof own === 'string' && own.trim() !== '') {
    return own.trim().replace(/\s+/g, ' ');
  }
  const registered = views
    .getViews(DASHBOARD_BUILDING_BLOCKS_LOCATION)
    ?.find(view => view.id === type);
  return registered?.name ?? type;
}
