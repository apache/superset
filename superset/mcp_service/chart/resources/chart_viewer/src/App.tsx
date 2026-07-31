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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ChartData, ChartMeta, ColorScheme, ViewType } from './types';
import { REQUERY_TOOL_NAME } from './types';
import {
  ChartBridge,
  type DisplayMode,
  type HostCapabilities,
} from './bridge';
import {
  applyThemeVars,
  detectPreferredScheme,
  getThemeTokens,
  type SupersetThemeTokens,
} from './theme';
import {
  availableViews,
  chartDataToEChartsOption,
  classifyColumns,
  defaultViewForChartType,
  isCartesianView,
  isEChartsView,
} from './adapter';
import { formatByColumn, stripUntrustedMarkers } from './format';
import {
  copyText,
  downloadDataUrl,
  downloadFile,
  exportFilename,
  isDownloadRestricted,
  toCsv,
} from './export';
import { EChart, type EChartClickParams } from './components/EChart';
import type { EChartsType } from './echarts';
import { BigNumber } from './components/BigNumber';
import { CopyPanel } from './components/CopyPanel';
import { DataTable } from './components/DataTable';
import { Toolbar } from './components/Toolbar';
import type { ExportAction } from './components/ExportMenu';
import { EmptyState, ErrorState, LoadingSkeleton } from './components/States';
import { SAMPLE_CHART_DATA } from './sample-data';

const bridge = new ChartBridge();
const DEFAULT_WIDGET_HEIGHT = 420;
const MAX_WIDGET_HEIGHT = 1200;
const MIN_WIDGET_HEIGHT = 260;

/**
 * Rows included when handing the data to the assistant. The host feeds this
 * straight into the model's context, so it is capped well below the result
 * size the widget itself can hold.
 */
const SHARE_ROW_LIMIT = 100;

interface DrillState {
  active: boolean;
  label: string;
}

/**
 * Resolve a clicked mark back to its source row. Cartesian series are built
 * one mark per row so `dataIndex` is the row; pie and scatter reorder or
 * collapse rows and carry the original index on the data item instead.
 */
function sourceRowIndex(params: EChartClickParams): number {
  return params.rowIndex ?? params.dataIndex;
}

export function App(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChartData | null>(null);
  const [meta, setMeta] = useState<ChartMeta>({});
  const [scheme, setScheme] = useState<ColorScheme>(detectPreferredScheme());
  const [caps, setCaps] = useState<HostCapabilities | null>(null);
  const [view, setView] = useState<ViewType>('line');
  const [activeMetrics, setActiveMetrics] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillState>({ active: false, label: '' });
  const [selection, setSelection] = useState<EChartClickParams | null>(null);
  const [requestedHeight, setRequestedHeight] = useState(DEFAULT_WIDGET_HEIGHT);
  // Tracked so the maximize control can toggle rather than only ever expand.
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline');
  const [restoreHeight, setRestoreHeight] = useState<number | null>(null);
  const [copyPanel, setCopyPanel] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const chartInstance = useRef<EChartsType | null>(null);
  // The host sandbox decides this once, at load; it cannot change mid-session.
  const downloadsBlocked = useMemo(() => isDownloadRestricted(), []);

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((message: string, ms = 2600): void => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, ms);
  }, []);

  // Superset tokens travel with the data, so the widget renders in the
  // deployment's own branding rather than hardcoded colors.
  const supersetTheme = (data?.theme ?? null) as SupersetThemeTokens | null;
  const theme = useMemo(
    () => getThemeTokens(scheme, supersetTheme),
    [scheme, supersetTheme],
  );

  // ---- Bridge handshake + data intake ------------------------------------
  useEffect(() => {
    let alive = true;

    function intake(
      next: ChartData | null,
      nextMeta: ChartMeta,
      err?: string,
    ): void {
      if (!alive) return;
      if (err) {
        // A ChartError / isError result (not-found, RBAC, query, OAuth): show
        // the styled error state instead of spinning forever.
        setError(err);
        setLoading(false);
        return;
      }
      if (!next) return; // connected but no data yet — keep waiting
      setData(next);
      setMeta((m) => ({ ...m, ...nextMeta }));
      const defaultView = defaultViewForChartType(next.chart_type, next);
      setView(defaultView);
      setActiveMetrics(classifyColumns(next).numeric.map((c) => c.name));
      setError(null);
      setLoading(false);
      window.requestAnimationFrame(() => {
        bridge.reportSize(
          Math.max(window.innerWidth, 320),
          DEFAULT_WIDGET_HEIGHT,
        );
      });
    }

    bridge
      .initialize()
      .then((init) => {
        if (!alive) return;
        setCaps(init.capabilities);
        setScheme(init.context.scheme);
        if (
          init.context.displayMode === 'inline' ||
          init.context.displayMode === 'fullscreen'
        ) {
          setDisplayMode(init.context.displayMode);
        }
        if (init.error) {
          intake(null, {}, init.error);
        } else if (init.chartData) {
          intake(init.chartData, init.meta);
        } else if (init.connected) {
          // Connected but no data yet: wait for a tool-result push below.
        } else if (init.embedded) {
          // Embedded in a host but the handshake failed — NEVER show sample
          // data (it would look like the user's real chart). Show an error.
          intake(null, {}, 'Could not connect to Superset to load this chart.');
        } else {
          // True standalone dev/demo mode (not embedded): sample data is fine.
          intake(SAMPLE_CHART_DATA, {});
        }
      })
      .catch(() => {
        // Unexpected failure resolving the handshake. Only fall back to sample
        // data when clearly not embedded; otherwise surface an error.
        if (!alive) return;
        if (window.self !== window.top) {
          intake(null, {}, 'Could not connect to Superset to load this chart.');
        } else {
          intake(SAMPLE_CHART_DATA, {});
        }
      });

    const offResult = bridge.onToolResult((d, m, e) => intake(d, m, e));
    const offCtx = bridge.onContextChange((ctx) => {
      if (ctx.scheme) setScheme(ctx.scheme);
      // The host can change display mode on its own (its own fullscreen
      // chrome, or Esc); follow it so our toggle stays in step.
      if (ctx.displayMode === 'inline' || ctx.displayMode === 'fullscreen') {
        setDisplayMode(ctx.displayMode);
      }
    });

    return () => {
      alive = false;
      offResult();
      offCtx();
    };
  }, []);

  // Keep chrome + chart theme in sync with the resolved scheme.
  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  // Fall back to OS theme changes when the host does not push a scheme.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void =>
      setScheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const roles = useMemo(() => (data ? classifyColumns(data) : null), [data]);
  const views = useMemo(() => (data ? availableViews(data) : []), [data]);

  const option = useMemo(() => {
    if (!data) return {};
    return chartDataToEChartsOption(data, view, { theme, activeMetrics });
  }, [data, view, theme, activeMetrics]);

  // ---- Magic moment: click-to-drill via render_chart_requery -------------
  const canRequery = !!caps && bridge.hasTool(REQUERY_TOOL_NAME);
  const canAsk = !!caps?.canUpdateModelContext || !!caps?.canSendMessage;

  const requery = useCallback(
    async (
      args: Parameters<ChartBridge['callTool']>[1],
      drillLabel: string,
    ) => {
      if (!data) return;
      setLoading(true);
      try {
        // The tool takes a single `request` model keyed by `identifier`;
        // a flat payload is rejected by schema validation.
        const next = (await bridge.callTool(REQUERY_TOOL_NAME, {
          request: {
            identifier: data.chart_id,
            ...args,
          },
        })) as ChartData;
        if (next && Array.isArray(next.columns)) {
          setData(next);
          setActiveMetrics(classifyColumns(next).numeric.map((c) => c.name));
          setDrill({
            active: true,
            label: stripUntrustedMarkers(drillLabel),
          });
        }
      } catch {
        showToast('Drill-down is unavailable in this host.');
      } finally {
        setLoading(false);
      }
    },
    [data],
  );

  const handlePointClick = useCallback(
    (params: EChartClickParams) => {
      setSelection(params);
      if (!roles?.dimension) return;
      const row = sourceRowIndex(params);
      if (row < 0) return;
      const rawX = data?.data?.[row]?.[roles.dimension.name];
      // Filter values go back to Superset as-is, so the trust delimiters have
      // to come off or the `==` comparison matches nothing.
      const xVal =
        typeof rawX === 'string' ? stripUntrustedMarkers(rawX) : rawX;
      if (canRequery && roles.dimensionIsTemporal) {
        // Ask for a finer granularity where the saved query context supports
        // overriding it. Some chart query contexts ignore this hint.
        void requery(
          {
            filter: { col: roles.dimension.name, val: xVal },
            granularity: 'P1D',
          },
          `${params.seriesName} · ${formatByColumn(xVal, roles.dimension)}`,
        );
      }
    },
    [canRequery, data, requery, roles],
  );

  // ---- Magic moment: brush-to-zoom re-query ------------------------------
  const handleBrushEnd = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (
        !canRequery ||
        !roles?.dimensionIsTemporal ||
        !roles.dimension ||
        !data
      )
        return;
      const rows = data.data ?? [];
      const lo = Math.max(0, Math.min(range.startIndex, range.endIndex));
      const hi = Math.min(
        rows.length - 1,
        Math.max(range.startIndex, range.endIndex),
      );
      const start = rows[lo]?.[roles.dimension.name];
      const end = rows[hi]?.[roles.dimension.name];
      if (start == null || end == null) return;
      void requery(
        { time_range: `${String(start)} : ${String(end)}`, granularity: 'P1D' },
        `Zoomed ${formatByColumn(start, roles.dimension)} – ${formatByColumn(end, roles.dimension)}`,
      );
    },
    [canRequery, data, requery, roles],
  );

  const resetDrill = useCallback(() => {
    setDrill({ active: false, label: '' });
    // Re-request the full chart (no filter) to reset.
    if (canRequery && data) {
      void requery({}, '');
      setDrill({ active: false, label: '' });
    }
  }, [canRequery, data, requery]);

  // ---- Magic moment: "Ask about this" ------------------------------------
  const askAboutSelection = useCallback(async () => {
    if (!selection || !data || !roles) return;
    const row = sourceRowIndex(selection);
    const xVal =
      row >= 0 ? data.data?.[row]?.[roles.dimension?.name ?? ''] : undefined;
    const dimLabel =
      roles.dimension?.display_name ?? roles.dimension?.name ?? 'x';
    const msg = stripUntrustedMarkers(
      `User is looking at ${selection.seriesName}=${formatByColumn(
        selection.value,
        roles.numeric.find(
          (c) => (c.display_name || c.name) === selection.seriesName,
        ),
      )} for ${dimLabel}=${formatByColumn(
        xVal,
        roles.dimension ?? undefined,
      )} in "${data.chart_name}".`,
    );
    await bridge.updateModelContext(msg, {
      chart_id: data.chart_id,
      metric: selection.seriesName,
      value: selection.value,
      dimension: dimLabel,
      dimension_value: xVal,
    });
    await bridge.sendMessage(msg);
    setSelection(null);
    showToast('Shared this data point with the assistant.');
  }, [selection, data, roles]);

  // explore_url is a field on the ChartData (structuredContent), with a
  // legacy fallback to tool-result _meta for older servers.
  const exploreUrl = data?.explore_url ?? meta.explore_url;
  const openInSuperset = useCallback(async () => {
    if (!exploreUrl) return;
    if (await bridge.openLink(exploreUrl)) return;
    // Neither the host nor a direct window.open could take us there (a
    // sandboxed iframe with no popup permission). Hand over the URL rather
    // than letting the click do nothing.
    let copied = false;
    try {
      await navigator.clipboard?.writeText(exploreUrl);
      copied = true;
    } catch {
      copied = false;
    }
    showToast(
      copied
        ? 'Could not open it here — link copied to your clipboard.'
        : `Open in Superset: ${exploreUrl}`,
      copied ? 2600 : 8000,
    );
  }, [exploreUrl, showToast]);

  // ---- Export -------------------------------------------------------------
  const exportActions = useMemo<ExportAction[]>(() => {
    if (!data) return [];
    const csv = (): string => toCsv(data);
    const actions: ExportAction[] = [];

    if (!downloadsBlocked) {
      actions.push({
        key: 'csv',
        label: 'Download CSV',
        onSelect: () => {
          const ok = downloadFile(
            exportFilename(data, 'csv'),
            'text/csv',
            csv(),
          );
          showToast(ok ? 'CSV downloaded.' : 'The host blocked the download.');
        },
      });
      if (isEChartsView(view)) {
        actions.push({
          key: 'png',
          label: 'Download PNG',
          onSelect: () => {
            const chart = chartInstance.current;
            if (!chart) {
              showToast('The chart is not ready yet.');
              return;
            }
            const url = chart.getDataURL({
              type: 'png',
              pixelRatio: 2,
              // Transparent PNGs are unreadable pasted into a light document.
              backgroundColor: theme.bg,
            });
            const ok = downloadDataUrl(exportFilename(data, 'png'), url);
            showToast(ok ? 'Image downloaded.' : 'The host blocked the download.');
          },
        });
      }
    }

    actions.push({
      key: 'copy',
      label: 'Copy CSV',
      onSelect: () => {
        const text = csv();
        void copyText(text).then((ok) => {
          if (ok) showToast('CSV copied to the clipboard.');
          // No clipboard permission in this frame — show it instead so the
          // user can copy it with their own keystroke.
          else setCopyPanel({ title: 'CSV', text });
        });
      },
    });

    if (downloadsBlocked) {
      // A programmatic copy can report success without the clipboard actually
      // changing (permissions vary by host), so a path that cannot lie —
      // the text, on screen, for the user to copy — is always offered.
      actions.push({
        key: 'show',
        label: 'Show CSV',
        onSelect: () => setCopyPanel({ title: 'CSV', text: csv() }),
      });
    }

    if (canAsk) {
      actions.push({
        key: 'share',
        label: 'Send data to the assistant',
        onSelect: () => {
          const truncated = data.row_count > SHARE_ROW_LIMIT;
          const text = toCsv(data, SHARE_ROW_LIMIT);
          const preamble = stripUntrustedMarkers(
            `Data behind "${data.chart_name}"${
              truncated
                ? ` (first ${SHARE_ROW_LIMIT} of ${data.row_count} rows)`
                : ''
            }, as CSV:`,
          );
          void (async () => {
            await bridge.updateModelContext(`${preamble}\n${text}`, {
              chart_id: data.chart_id,
              row_count: data.row_count,
              shared_rows: Math.min(SHARE_ROW_LIMIT, data.row_count),
            });
            await bridge.sendMessage(`${preamble}\n${text}`);
            showToast('Sent the data to the assistant.');
          })();
        },
      });
    }

    return actions;
  }, [canAsk, data, downloadsBlocked, showToast, theme.bg, view]);

  const exportNote = downloadsBlocked
    ? 'This host sandboxes the widget, so it cannot save files. Copy the data or send it to the assistant instead.'
    : undefined;

  const toggleMetric = useCallback((name: string) => {
    setActiveMetrics((cur) => {
      if (cur.includes(name)) {
        const next = cur.filter((n) => n !== name);
        return next.length ? next : cur; // keep at least one
      }
      return [...cur, name];
    });
  }, []);

  const requestHeight = useCallback((height: number) => {
    const next = Math.max(
      MIN_WIDGET_HEIGHT,
      Math.min(MAX_WIDGET_HEIGHT, Math.round(height)),
    );
    setRequestedHeight(next);
    bridge.reportSize(Math.max(window.innerWidth, 320), next);
  }, []);

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = requestedHeight;
      const onMove = (moveEvent: PointerEvent): void => {
        requestHeight(startHeight + moveEvent.clientY - startY);
      };
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [requestHeight, requestedHeight],
  );

  const toggleMaximize = useCallback(async () => {
    const expanding = displayMode !== 'fullscreen';
    const target: DisplayMode = expanding ? 'fullscreen' : 'inline';
    if (await bridge.requestDisplayMode(target)) {
      setDisplayMode(target);
      return;
    }
    // Hosts without display-mode support still honor size notifications, so
    // grow the iframe instead — and remember the previous height so the same
    // control can put it back.
    if (expanding) {
      setRestoreHeight(requestedHeight);
      requestHeight(Math.max(requestedHeight, 720));
    } else {
      requestHeight(restoreHeight ?? DEFAULT_WIDGET_HEIGHT);
      setRestoreHeight(null);
    }
    setDisplayMode(target);
  }, [displayMode, requestHeight, requestedHeight, restoreHeight]);

  // Escape restores an expanded widget, matching the usual fullscreen idiom.
  useEffect(() => {
    if (displayMode !== 'fullscreen') return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void toggleMaximize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [displayMode, toggleMaximize]);

  // ---- Render ------------------------------------------------------------
  if (error)
    return shell(
      <ErrorState message={error} />,
      null,
      null,
      '',
      null,
      null,
      requestedHeight,
      startResize,
      toggleMaximize,
      displayMode,
    );
  if (loading && !data)
    return shell(
      <LoadingSkeleton />,
      null,
      null,
      '',
      null,
      null,
      requestedHeight,
      startResize,
      toggleMaximize,
      displayMode,
    );
  if (!data)
    return shell(
      <EmptyState />,
      null,
      null,
      '',
      null,
      null,
      requestedHeight,
      startResize,
      toggleMaximize,
      displayMode,
    );

  const isEmpty = !data.data || data.data.length === 0;
  // Brushing selects a range along a category x-axis, which only exists on the
  // cartesian views — a pie or scatter has nothing to sweep.
  const enableBrush =
    isCartesianView(view) && canRequery && !!roles?.dimensionIsTemporal;

  const body = isEmpty ? (
    <EmptyState />
  ) : view === 'big_number' ? (
    <BigNumber data={data} theme={theme} />
  ) : view === 'table' ? (
    <DataTable data={data} />
  ) : (
    <>
      {drill.active && (
        <div className="sv-reset-pill">
          <button
            type="button"
            className="sv-btn sv-btn--subtle"
            onClick={resetDrill}
          >
            ← Reset drill
          </button>
        </div>
      )}
      <EChart
        option={option}
        scheme={scheme}
        enableBrush={enableBrush}
        onDataPointClick={handlePointClick}
        onBrushEnd={handleBrushEnd}
        onInstance={(chart) => {
          chartInstance.current = chart;
        }}
      />
    </>
  );

  return shell(
    body,
    <Toolbar
      views={views}
      activeView={view}
      onViewChange={setView}
      metricColumns={roles?.numeric ?? []}
      activeMetrics={activeMetrics}
      onToggleMetric={toggleMetric}
      exploreUrl={exploreUrl}
      onOpenInSuperset={openInSuperset}
      exportActions={exportActions}
      exportNote={exportNote}
    />,
    data,
    drill.label,
    copyPanel ? (
      <CopyPanel
        title={copyPanel.title}
        text={copyPanel.text}
        onClose={() => setCopyPanel(null)}
      />
    ) : selection && canAsk ? (
      <div className="sv-toast">
        <span>
          {selection.seriesName}:{' '}
          <strong>{formatByColumn(selection.value)}</strong>
        </span>
        <button
          type="button"
          className="sv-btn sv-btn--ghost"
          onClick={askAboutSelection}
        >
          Ask about this
        </button>
        <button
          type="button"
          className="sv-btn sv-btn--subtle"
          onClick={() => setSelection(null)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    ) : null,
    toast,
    requestedHeight,
    startResize,
    toggleMaximize,
    displayMode,
  );
}

/** Consistent app chrome: header + toolbar + body + insight footer. */
function shell(
  body: JSX.Element,
  toolbar: JSX.Element | null,
  data?: ChartData | null,
  drillLabel?: string,
  actionToast?: JSX.Element | null,
  toast?: string | null,
  requestedHeight = DEFAULT_WIDGET_HEIGHT,
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void,
  onToggleMaximize?: () => void,
  displayMode: DisplayMode = 'inline',
): JSX.Element {
  const expanded = displayMode === 'fullscreen';
  return (
    <div className="sv-app" style={{ minHeight: requestedHeight }}>
      <div className="sv-header">
        <div className="sv-title-wrap">
          <h1 className="sv-title">
            {stripUntrustedMarkers(data?.chart_name ?? 'Chart')}
          </h1>
          <div className="sv-subtitle">
            <span className="sv-accent-dot" />
            {drillLabel ? (
              <span>{drillLabel}</span>
            ) : data ? (
              <span>
                {data.row_count.toLocaleString()} rows
                {data.total_rows && data.total_rows > data.row_count
                  ? ` of ${data.total_rows.toLocaleString()}`
                  : ''}
              </span>
            ) : (
              <span>Superset</span>
            )}
          </div>
        </div>
        {onToggleMaximize && (
          <button
            type="button"
            className="sv-btn sv-btn--subtle sv-maximize"
            onClick={onToggleMaximize}
            aria-label={expanded ? 'Restore chart size' : 'Maximize chart'}
            aria-pressed={expanded}
            title={expanded ? 'Restore (Esc)' : 'Maximize'}
          >
            {expanded ? '⤡' : '⛶'}
          </button>
        )}
      </div>
      {toolbar}
      <div className="sv-body">
        {body}
        {actionToast}
        {toast && <div className="sv-toast">{toast}</div>}
      </div>
      {data?.insights && data.insights.length > 0 && (
        <div className="sv-insights">
          <strong>Insight:</strong> {stripUntrustedMarkers(data.insights[0])}
        </div>
      )}
      {onResizeStart && (
        <div
          className="sv-resize-handle"
          role="separator"
          aria-label="Resize chart"
          aria-orientation="horizontal"
          onPointerDown={onResizeStart}
        />
      )}
    </div>
  );
}
