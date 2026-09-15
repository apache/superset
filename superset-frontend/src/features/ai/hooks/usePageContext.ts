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
 * @fileoverview What the user is looking at, read out of the Redux store.
 *
 * The assistant cannot answer "why is this number wrong" without knowing which
 * chart, query or dashboard "this" refers to, so every page type contributes a
 * shape describing itself. Everything read here is already on the client; no
 * request is made to build it.
 *
 * Only one page's slice is populated per call, because only one of SQL Lab,
 * Explore and a dashboard is mounted at a time. Selectors are written against
 * optional slices for that reason rather than assuming a page's reducers are
 * registered.
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import type { DataMaskStateWithId } from '@superset-ui/core';
import type { SqlLabRootState } from 'src/SqlLab/types';
import type { ExplorePageState } from 'src/explore/types';
import type {
  DashboardInfo,
  DashboardLayoutState,
  LayoutItem,
  RootState as DashboardRootState,
  SliceEntitiesState,
} from 'src/dashboard/types';
import {
  CHART_TYPE,
  MARKDOWN_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';

/** At most this many markdown blocks are lifted off a dashboard. */
const MAX_MARKDOWN_BLOCKS = 10;

/** Per-block ceiling, so one enormous markdown tile cannot fill the prompt. */
const MAX_MARKDOWN_BLOCK_LENGTH = 25000;

/** Formatted context above this length is considered worth minimising. */
const LARGE_CONTEXT_THRESHOLD = 5000;

/**
 * The slices this hook reads.
 *
 * Declared locally rather than intersecting the three page root states: those
 * disagree about the shape of shared keys such as `common`, and an intersection
 * of them is uninhabitable.
 */
interface AiPageRootState {
  sqlLab?: SqlLabRootState['sqlLab'];
  explore?: ExplorePageState['explore'];
  /**
   * `dashboard_title` is spread onto this slice at hydration but is absent from
   * the declared type, so it is named here instead of being read through a cast.
   */
  dashboardInfo?: DashboardInfo & { dashboard_title?: string };
  dashboardState?: DashboardRootState['dashboardState'];
  dashboardLayout?: DashboardLayoutState;
  sliceEntities?: SliceEntitiesState;
  nativeFilters?: DashboardRootState['nativeFilters'];
  dataMask?: DataMaskStateWithId;
}

/**
 * Extract chart ID from URL patterns like /explore/?slice_id=123 or /chart/123/
 */
const extractChartIdFromUrl = (url: string): number | undefined => {
  // Try to extract from slice_id parameter
  const sliceIdMatch = url.match(/[?&]slice_id=(\d+)/);
  if (sliceIdMatch) {
    return parseInt(sliceIdMatch[1], 10);
  }

  // Try to extract from chart path
  const chartPathMatch = url.match(/\/chart\/(\d+)/);
  if (chartPathMatch) {
    return parseInt(chartPathMatch[1], 10);
  }

  return undefined;
};

/**
 * Utility function to truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

const HELPER_PREFIX = '@helper';

const isHelperDirective = (content: string): boolean =>
  content.trimStart().toLowerCase().startsWith(HELPER_PREFIX);

export interface PageContext {
  url: string;
  pathname: string;
  pageType: 'sqllab' | 'explore' | 'dashboard' | 'chart' | 'home' | 'other';
  sqlContext?: {
    activeEditor?: {
      sql?: string;
      database?: string;
      /** Sent alongside the name so the assistant can run SQL against the
       * connection the user has selected rather than resolving one by name. */
      databaseId?: number;
      schema?: string;
      catalog?: string;
      queryLimit?: number;
      name?: string;
    };
    tables?: Array<{
      name: string;
      schema?: string;
      catalog?: string;
    }>;
    recentQueries?: Array<{
      sql?: string;
      status?: string;
      executedAt?: number;
    }>;
  };
  chartContext?: {
    chartId?: string | number;
    vizType?: string;
    datasource?: {
      id?: string | number;
      name?: string;
      type?: string;
      schema?: string;
      database?: string;
    };
    /** A subset of the chart's controls. Values stay `unknown`: the assistant
     * only ever serialises them, and typing them as `any` would let unchecked
     * reads back in. */
    formData?: Record<string, unknown>;
    chartName?: string;
    metadata?: {
      isEditing?: boolean;
      canOverwrite?: boolean;
      description?: string;
    };
    slice?: {
      slice_id?: number;
      slice_name?: string;
      description?: string;
    };
  };
  dashboardContext?: {
    /** Sent so the assistant can call dashboard tools against the dashboard the
     * user is actually on. Without it the model has to guess an id or fall back
     * to searching by title. */
    id?: number;
    title?: string;
    activeTabId?: string;
    activeTabLabel?: string;
    charts?: Array<{
      id: number;
      title?: string;
    }>;
    activeFilters?: Array<{
      name: string;
      column?: string;
      filterType?: string;
      value?: unknown;
    }>;
  };
  pageMarkdown?: Array<{
    source: string;
    content: string;
  }>;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/** A named string off an untyped bag, or undefined if it is not one. */
const readStringField = (
  bag: Record<string, unknown> | undefined,
  field: string,
): string | undefined => {
  const value = bag?.[field];
  return typeof value === 'string' && value ? value : undefined;
};

/** Layout items inside the currently selected tab tree, or all of them when the
 * dashboard has no tabs. */
const isInActiveTab = (
  item: LayoutItem,
  layout: Record<string, LayoutItem>,
  activeTabs: Set<string>,
): boolean => {
  const tabParents = (item.parents ?? []).filter(
    parent => layout[parent]?.type === TAB_TYPE,
  );
  // On dashboards with tabs, include only charts inside the active tab tree.
  // If there are no tabs or no active tab selected, keep all non-tab charts.
  if (tabParents.length === 0) {
    return activeTabs.size === 0;
  }
  return tabParents.every(tabId => activeTabs.has(tabId));
};

/**
 * Custom hook that extracts context about the current page for use in chat
 */
export const usePageContext = (): PageContext => {
  const location = useLocation();

  // SQL Lab context
  const sqlLabState = useSelector((state: AiPageRootState) => state.sqlLab);

  // Explore/Chart context
  const exploreState = useSelector((state: AiPageRootState) => state.explore);

  // Chart slice information
  const sliceState = useSelector(
    (state: AiPageRootState) => state.explore?.slice,
  );

  // Dashboard context
  const dashboardState = useSelector(
    (state: AiPageRootState) => state.dashboardInfo,
  );
  const activeDashboardTabs = useSelector(
    (state: AiPageRootState) => state.dashboardState?.activeTabs,
  );
  const dashboardLayout = useSelector(
    (state: AiPageRootState) => state.dashboardLayout?.present,
  );
  const dashboardSliceEntities = useSelector(
    (state: AiPageRootState) => state.sliceEntities?.slices,
  );

  const nativeFilters = useSelector(
    (state: AiPageRootState) => state.nativeFilters?.filters,
  );
  const dataMask = useSelector((state: AiPageRootState) => state.dataMask);

  return useMemo(() => {
    const { pathname, search } = location;
    const url = `${pathname}${search}`;

    let pageType: PageContext['pageType'] = 'other';
    let sqlContext: PageContext['sqlContext'];
    let chartContext: PageContext['chartContext'];
    let dashboardContext: PageContext['dashboardContext'];
    let pageMarkdown: PageContext['pageMarkdown'];

    // Determine page type and extract relevant context
    // Matched on the post-route_base path only. A `/superset/` prefix would be
    // doubled under a subdirectory deployment, and is a 404 since route_base was
    // cleared; `includes` still matches when a deployment root is present.
    if (pathname.includes('/sqllab')) {
      pageType = 'sqllab';

      if (sqlLabState) {
        const {
          queryEditors,
          tables,
          queries,
          tabHistory,
          databases,
          unsavedQueryEditor,
        } = sqlLabState;

        // Get active editor
        const activeEditorId = tabHistory?.[tabHistory.length - 1];
        const activeEditor = queryEditors?.find(qe => qe.id === activeEditorId);
        const mergedEditor =
          activeEditor && unsavedQueryEditor?.id === activeEditor.id
            ? { ...activeEditor, ...unsavedQueryEditor }
            : activeEditor;

        if (mergedEditor) {
          const database = databases?.[mergedEditor.dbId ?? ''];

          sqlContext = {
            activeEditor: {
              sql: mergedEditor.sql,
              database: database?.database_name,
              databaseId:
                typeof mergedEditor.dbId === 'number'
                  ? mergedEditor.dbId
                  : undefined,
              schema: mergedEditor.schema,
              catalog: mergedEditor.catalog || undefined,
              queryLimit: mergedEditor.queryLimit,
              name: mergedEditor.name,
            },
            tables: tables
              ?.filter(table => table.queryEditorId === mergedEditor.id)
              ?.slice(0, 10) // Limit to prevent huge context
              ?.map(table => ({
                name: table.name,
                schema: table.schema,
                catalog: table.catalog ?? undefined,
              })),
            recentQueries: Object.values(queries || {})
              ?.filter(query => query.sqlEditorId === mergedEditor.id)
              ?.sort((a, b) => (b.startDttm || 0) - (a.startDttm || 0))
              ?.slice(0, 5) // Last 5 queries only
              ?.map(query => ({
                sql: query.sql?.slice(0, 500), // Truncate long queries
                status: query.state,
                executedAt: query.startDttm,
              })),
          };
        }
      }
    } else if (
      (pathname.includes('/explore') || pathname.includes('/chart')) &&
      !pathname.includes('/list')
    ) {
      pageType = pathname.includes('/explore') ? 'explore' : 'chart';

      if (exploreState) {
        const { form_data: formData, datasource } = exploreState;
        const slice = sliceState;

        // Extract chart ID from form_data, slice, or URL
        const chartId =
          formData?.slice_id || slice?.slice_id || extractChartIdFromUrl(url);

        chartContext = {
          chartId,
          vizType: formData?.viz_type,
          datasource: datasource
            ? {
                id: datasource.id,
                name:
                  datasource.table_name ||
                  datasource.datasource_name ||
                  undefined,
                type: datasource.type,
                schema: datasource.schema || undefined,
                // `Dataset.database` is an untyped bag, so the name is checked
                // rather than asserted.
                database: readStringField(datasource.database, 'database_name'),
              }
            : undefined,
          formData: formData
            ? {
                // Include key form data but limit size
                slice_id: formData.slice_id,
                metrics: formData.metrics,
                groupby: formData.groupby,
                columns: formData.columns,
                filters: formData.adhoc_filters?.slice(0, 10), // Limit filters
                time_range: formData.time_range,
                granularity_sqla: formData.granularity_sqla,
                ...(Object.keys(formData).length > 20
                  ? { _truncated: 'Large form_data truncated for context' }
                  : formData),
              }
            : undefined,
          chartName: slice?.slice_name || formData?.slice_name || 'Untitled',
          metadata: {
            isEditing: !chartId || chartId === 0, // New chart if no ID
            canOverwrite: exploreState.can_overwrite,
            description: slice?.description ?? undefined,
          },
          slice: slice
            ? {
                slice_id: slice.slice_id,
                slice_name: slice.slice_name,
                description: slice.description ?? undefined,
              }
            : undefined,
        };

        if (slice?.description?.trim()) {
          pageMarkdown = [
            {
              source: 'chart_description',
              content: truncateText(
                slice.description.trim(),
                MAX_MARKDOWN_BLOCK_LENGTH,
              ),
            },
          ];
        }
      }
    } else if (pathname.includes('/dashboard') && !pathname.includes('/list')) {
      pageType = 'dashboard';

      if (dashboardState) {
        const layout = dashboardLayout ?? {};
        const activeTabId =
          Array.isArray(activeDashboardTabs) && activeDashboardTabs.length > 0
            ? activeDashboardTabs[0]
            : undefined;
        const activeTabLabel =
          activeTabId && typeof layout[activeTabId]?.meta?.text === 'string'
            ? layout[activeTabId].meta.text
            : undefined;
        const activeTabsSet = new Set(
          Array.isArray(activeDashboardTabs) ? activeDashboardTabs : [],
        );
        const chartsInActiveTab = Object.values(layout)
          .filter(layoutItem => layoutItem?.type === CHART_TYPE)
          .filter(layoutItem =>
            isInActiveTab(layoutItem, layout, activeTabsSet),
          )
          // flatMap rather than map-then-filter so a layout item with no chart id
          // is dropped without a type predicate to reassert what was lost.
          .flatMap(layoutItem => {
            const { chartId } = layoutItem.meta;
            if (typeof chartId !== 'number' || !Number.isFinite(chartId)) {
              return [];
            }
            const sliceEntity = dashboardSliceEntities?.[chartId];
            return [
              {
                id: chartId,
                title:
                  layoutItem.meta.sliceNameOverride ||
                  layoutItem.meta.sliceName ||
                  sliceEntity?.slice_name ||
                  undefined,
              },
            ];
          });

        const markdownBlocks = Object.values(layout)
          .filter(layoutItem => layoutItem?.type === MARKDOWN_TYPE)
          .filter(layoutItem =>
            isInActiveTab(layoutItem, layout, activeTabsSet),
          )
          .map(layoutItem => layoutItem.meta.code)
          .filter(
            (code): code is string =>
              typeof code === 'string' && code.trim().length > 0,
          )
          .slice(0, MAX_MARKDOWN_BLOCKS)
          .map(code => ({
            source: 'dashboard_component',
            content: truncateText(code.trim(), MAX_MARKDOWN_BLOCK_LENGTH),
          }));

        if (markdownBlocks.length > 0) {
          pageMarkdown = markdownBlocks;
        }

        // Only filters that are actually applied are described: naming a filter
        // the user has not set would have the assistant explain a constraint that
        // is not on the data.
        const activeFiltersList =
          nativeFilters && dataMask
            ? Object.values(nativeFilters).flatMap(filter => {
                const filterValue = dataMask[filter.id]?.filterState?.value;
                if (filterValue === undefined || filterValue === null) {
                  return [];
                }
                if (Array.isArray(filterValue) && filterValue.length === 0) {
                  return [];
                }
                if (!filter.name) {
                  return [];
                }
                return [
                  {
                    name: filter.name,
                    column: filter.targets?.[0]?.column?.name,
                    filterType: filter.filterType,
                    value: filterValue as unknown,
                  },
                ];
              })
            : undefined;

        const headerText = layout[DASHBOARD_HEADER_ID]?.meta?.text;
        dashboardContext = {
          id:
            typeof dashboardState.id === 'number'
              ? dashboardState.id
              : undefined,
          title:
            dashboardState.dashboard_title ??
            (typeof headerText === 'string' ? headerText : undefined),
          activeTabId,
          activeTabLabel,
          charts: chartsInActiveTab,
          activeFilters: activeFiltersList?.length
            ? activeFiltersList
            : undefined,
        };
      }
    } else if (pathname.includes('/welcome') || pathname === '/') {
      pageType = 'home';
    }

    return {
      url,
      pathname,
      pageType,
      sqlContext,
      chartContext,
      dashboardContext,
      pageMarkdown,
    };
  }, [
    location,
    sqlLabState,
    exploreState,
    sliceState,
    dashboardState,
    activeDashboardTabs,
    dashboardLayout,
    dashboardSliceEntities,
    nativeFilters,
    dataMask,
  ]);
};

/**
 * Format page context for sending to chat API
 * Truncates and formats the context to be readable and concise
 */
export const formatPageContextForChat = (context: PageContext): string => {
  const {
    pageType,
    pathname,
    sqlContext,
    chartContext,
    dashboardContext,
    pageMarkdown,
  } = context;

  let contextText = `Current page: ${pageType} (${pathname})\n\n`;

  if (sqlContext?.activeEditor) {
    const { sql, database, schema, name } = sqlContext.activeEditor;
    contextText += `**SQL Lab Context:**\n`;
    contextText += `- Tab: ${name || 'Untitled'}\n`;
    contextText += `- Database: ${database || 'Not selected'}\n`;
    contextText += `- Schema: ${schema || 'Not selected'}\n`;

    if (sql?.trim()) {
      const truncatedSql = truncateText(sql, 10000);
      contextText += `- Current SQL:\n\`\`\`sql\n${truncatedSql}\n\`\`\`\n`;
    }

    if (sqlContext.tables?.length) {
      contextText += `- Tables in use: ${sqlContext.tables
        .map(table => `${table.schema ? `${table.schema}.` : ''}${table.name}`)
        .join(', ')}\n`;
    }

    if (sqlContext.recentQueries?.length) {
      contextText += `- Recent queries: ${sqlContext.recentQueries.length} executed\n`;
    }
  }

  if (chartContext) {
    const {
      chartId,
      vizType,
      datasource,
      chartName,
      formData,
      metadata,
      slice,
    } = chartContext;
    contextText += `**Chart/Explore Context:**\n`;
    contextText += `- Chart ID: ${chartId || 'New Chart'}\n`;
    contextText += `- Chart type: ${vizType || 'Unknown'}\n`;
    contextText += `- Chart name: ${chartName || 'Untitled'}\n`;

    if (metadata?.isEditing !== undefined) {
      contextText += `- Mode: ${
        metadata.isEditing ? 'Creating New Chart' : 'Editing Existing Chart'
      }\n`;
    }

    if (datasource) {
      contextText += `- Datasource: ${datasource.name} (${datasource.type})\n`;
      if (datasource.id) {
        contextText += `- Datasource ID: ${datasource.id}\n`;
      }
      if (datasource.schema) {
        contextText += `- Schema: ${datasource.schema}\n`;
      }
      if (datasource.database) {
        contextText += `- Database: ${datasource.database}\n`;
      }
    }

    if (formData) {
      if (formData.metrics) {
        contextText += `- Metrics: ${JSON.stringify(formData.metrics)}\n`;
      }
      if (formData.groupby) {
        contextText += `- Group by: ${JSON.stringify(formData.groupby)}\n`;
      }
      if (formData.time_range) {
        contextText += `- Time range: ${formData.time_range}\n`;
      }
      if (Array.isArray(formData.filters) && formData.filters.length) {
        contextText += `- Filters: ${formData.filters.length} applied\n`;
      }
    }

    if (slice?.description) {
      contextText += `- Description: ${slice.description}\n`;
    }
  }

  if (dashboardContext) {
    const { id, title, activeTabId, activeTabLabel, charts, activeFilters } =
      dashboardContext;
    contextText += `**Dashboard Context:**\n`;
    contextText += `- Title: ${title || 'Untitled Dashboard'}\n`;
    if (id !== undefined) {
      contextText += `- Dashboard id: ${id}\n`;
    }
    if (activeTabId) {
      contextText += `- Active tab: ${activeTabLabel || activeTabId}\n`;
    }
    if (charts?.length) {
      contextText += `- Charts in active tab (${charts.length}):\n`;
      charts.forEach(chart => {
        contextText += `  - ${chart.id}: ${chart.title || 'Untitled chart'}\n`;
      });
    }
    if (activeFilters?.length) {
      contextText += `- Active native filters (${activeFilters.length}):\n`;
      activeFilters.forEach(filter => {
        const valueStr = Array.isArray(filter.value)
          ? filter.value.map(value => String(value)).join(', ')
          : String(filter.value);
        const colStr = filter.column ? ` on column "${filter.column}"` : '';
        contextText += `  - "${filter.name}"${colStr}: ${valueStr}\n`;
      });
      contextText += `\n  Note: Any SQL generated can incorporate these active filter values as WHERE clauses if necessary. Usually for generic requests like "Show me the data" or "What's the trend?" it is best to include the filter values in the SQL query to match what the user sees on the dashboard.\n`;
    }
  }

  const visibleMarkdown = pageMarkdown?.filter(
    block => !isHelperDirective(block.content),
  );
  if (visibleMarkdown?.length) {
    contextText += `\n**Page Markdown Content:**\n`;
    visibleMarkdown.forEach((block, index) => {
      const label =
        block.source === 'dashboard_component'
          ? `Dashboard Markdown ${index + 1}`
          : 'Chart Description';
      contextText += `- ${label}:\n${block.content}\n\n`;
    });
  }

  return contextText.trim();
};

const stripHelperPrefix = (content: string): string => {
  const trimmed = content.trimStart();
  return trimmed.slice(HELPER_PREFIX.length).trim();
};

/**
 * Extract @helper markdown blocks as standalone system-prompt directives.
 * These are separated from normal page markdown so they can be injected
 * as their own system messages rather than mixed into page context.
 */
export const extractHelperDirectives = (context: PageContext): string[] =>
  (context.pageMarkdown ?? [])
    .filter(block => isHelperDirective(block.content))
    .map(block => stripHelperPrefix(block.content))
    .filter(text => text.length > 0);

/**
 * Utility function to check if context is too large
 */
export const isContextTooLarge = (context: PageContext): boolean =>
  formatPageContextForChat(context).length > LARGE_CONTEXT_THRESHOLD;

/**
 * Create a minimal version of context for very large contexts
 */
export const getMinimalContext = (context: PageContext): PageContext => {
  const {
    pageType,
    pathname,
    sqlContext,
    chartContext,
    dashboardContext,
    pageMarkdown,
  } = context;

  return {
    url: context.url,
    pathname,
    pageType,
    sqlContext: sqlContext
      ? {
          activeEditor: {
            database: sqlContext.activeEditor?.database,
            // Ids survive trimming: they cost a handful of characters and a tool
            // call without one fails outright.
            databaseId: sqlContext.activeEditor?.databaseId,
            schema: sqlContext.activeEditor?.schema,
            name: sqlContext.activeEditor?.name,
            sql: sqlContext.activeEditor?.sql
              ? truncateText(sqlContext.activeEditor.sql, 200)
              : undefined,
          },
          tables: sqlContext.tables?.slice(0, 3),
          recentQueries: [],
        }
      : undefined,
    chartContext: chartContext
      ? {
          chartId: chartContext.chartId,
          vizType: chartContext.vizType,
          chartName: chartContext.chartName,
          datasource: chartContext.datasource,
          metadata: chartContext.metadata,
          formData: {
            metrics: chartContext.formData?.metrics,
            groupby: chartContext.formData?.groupby,
            time_range: chartContext.formData?.time_range,
          },
        }
      : undefined,
    dashboardContext: dashboardContext
      ? {
          // See the note on `databaseId` above.
          id: dashboardContext.id,
          title: dashboardContext.title,
          activeTabId: dashboardContext.activeTabId,
          activeTabLabel: dashboardContext.activeTabLabel,
          charts: dashboardContext.charts,
          activeFilters: dashboardContext.activeFilters?.slice(0, 20),
        }
      : undefined,
    pageMarkdown: pageMarkdown?.slice(0, 2).map(block => ({
      source: block.source,
      content: truncateText(block.content, 200),
    })),
  };
};

export const buildRecentChatHistorySummary = (
  history: ChatHistoryEntry[],
  lastTurns: number = 4,
  maxChars: number = 1200,
): string | undefined => {
  if (!history.length) {
    return undefined;
  }

  const compactHistory = history
    .filter(
      message =>
        (message.role === 'user' || message.role === 'assistant') &&
        message.content.trim().length > 0,
    )
    .slice(-Math.max(1, lastTurns * 2))
    .map(message => {
      const roleLabel = message.role === 'user' ? 'user' : 'assistant';
      return `${roleLabel}: ${message.content.replace(/\s+/g, ' ').trim()}`;
    })
    .join('\n');

  if (!compactHistory) {
    return undefined;
  }

  return compactHistory.length <= maxChars
    ? compactHistory
    : compactHistory.slice(compactHistory.length - maxChars);
};

/**
 * The context object sent to the backend under `page_context`.
 *
 * The formatted prose is included alongside the structured shape so the server
 * can put it straight into a prompt without reimplementing the formatter, while
 * still having the fields available for anything that needs them individually.
 */
export const buildPageContextPayload = (
  context: PageContext,
): Record<string, unknown> => {
  const trimmed = isContextTooLarge(context)
    ? getMinimalContext(context)
    : context;
  return {
    ...trimmed,
    formatted: formatPageContextForChat(trimmed),
    helper_directives: extractHelperDirectives(trimmed),
  };
};
