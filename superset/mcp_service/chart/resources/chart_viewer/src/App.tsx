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
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ChartData, ChartMeta, ColorScheme, ViewType } from './types';
import { REQUERY_TOOL_NAME } from './types';
import { ChartBridge, type HostCapabilities } from './bridge';
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
} from './adapter';
import { formatByColumn, stripUntrustedMarkers } from './format';
import { EChart, type EChartClickParams } from './components/EChart';
import { BigNumber } from './components/BigNumber';
import { DataTable } from './components/DataTable';
import { Toolbar } from './components/Toolbar';
import { EmptyState, ErrorState, LoadingSkeleton } from './components/States';
import { SAMPLE_CHART_DATA } from './sample-data';

const bridge = new ChartBridge();

/** Frame height requested from the host: chart area plus header and insight bar. */
const PREFERRED_HEIGHT = 520;
/** Bounds for the drag-to-resize handle. */
const MIN_HEIGHT = 260;
const MAX_HEIGHT = 1200;

interface DrillState {
  active: boolean;
  label: string;
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
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [maximized, setMaximized] = useState(false);

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
    }

    bridge
      .initialize()
      .then((init) => {
        if (!alive) return;
        setCaps(init.capabilities);
        setScheme(init.context.scheme);
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
    const handler = (e: MediaQueryListEvent): void => setScheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Ask the host for enough vertical room once there is a chart to show. A host that
  // honours ui/notifications/size-changed grows the frame; one that does not keeps its
  // own sizing and the CSS min-heights still apply.
  useEffect(() => {
    if (!data) return;
    bridge.reportSize(document.documentElement.clientWidth || 640, frameHeight ?? PREFERRED_HEIGHT);
    // Only on first data arrival — later reports come from the resize controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Drive the document's own height from the user's choice so hosts that size the
  // iframe to its content follow the drag as well.
  useEffect(() => {
    const h = frameHeight ? `${frameHeight}px` : '';
    document.documentElement.style.height = h;
    document.body.style.height = h;
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.style.height = h;
  }, [frameHeight]);

  const applyHeight = useCallback((next: number) => {
    const clamped = Math.max(MIN_HEIGHT, Math.min(Math.round(next), MAX_HEIGHT));
    setFrameHeight(clamped);
    bridge.reportSize(document.documentElement.clientWidth || 640, clamped);
  }, []);

  const handleResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = frameHeight ?? document.documentElement.clientHeight ?? PREFERRED_HEIGHT;
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent): void => applyHeight(startHeight + (ev.clientY - startY));
      const onUp = (ev: PointerEvent): void => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    },
    [applyHeight, frameHeight],
  );

  // Prefer a real host display-mode switch; fall back to growing in place when the
  // host does not implement the request.
  const toggleMaximize = useCallback(async () => {
    if (maximized) {
      setMaximized(false);
      await bridge.requestDisplayMode('inline');
      applyHeight(PREFERRED_HEIGHT);
      return;
    }
    setMaximized(true);
    const accepted = await bridge.requestDisplayMode('fullscreen');
    if (!accepted) applyHeight(MAX_HEIGHT);
  }, [maximized, applyHeight]);

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
    async (args: Parameters<ChartBridge['callTool']>[1], drillLabel: string) => {
      if (!data) return;
      setLoading(true);
      try {
        const next = (await bridge.callTool(REQUERY_TOOL_NAME, {
          chart_id: data.chart_id,
          ...args,
        })) as ChartData;
        if (next && Array.isArray(next.columns)) {
          setData(next);
          setActiveMetrics(classifyColumns(next).numeric.map((c) => c.name));
          setDrill({ active: true, label: drillLabel });
        }
      } catch {
        setToast('Drill-down is unavailable in this host.');
        window.setTimeout(() => setToast(null), 2600);
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
      const xVal = data?.data?.[params.dataIndex]?.[roles.dimension.name];
      if (canRequery && roles.dimensionIsTemporal) {
        // Drill into the clicked time bucket with a finer granularity.
        void requery(
          { filter: { col: roles.dimension.name, val: xVal }, granularity: 'P1D' },
          `${params.seriesName} · ${formatByColumn(xVal, roles.dimension)}`,
        );
      }
    },
    [canRequery, data, requery, roles],
  );

  // ---- Magic moment: brush-to-zoom re-query ------------------------------
  const handleBrushEnd = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!canRequery || !roles?.dimensionIsTemporal || !roles.dimension || !data) return;
      const rows = data.data ?? [];
      const lo = Math.max(0, Math.min(range.startIndex, range.endIndex));
      const hi = Math.min(rows.length - 1, Math.max(range.startIndex, range.endIndex));
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
    const xVal = data.data?.[selection.dataIndex]?.[roles.dimension?.name ?? ''];
    const dimLabel = roles.dimension?.display_name ?? roles.dimension?.name ?? 'x';
    const msg = `User is looking at ${selection.seriesName}=${formatByColumn(
      selection.value,
      roles.numeric.find((c) => (c.display_name || c.name) === selection.seriesName),
    )} for ${dimLabel}=${formatByColumn(
      xVal,
      roles.dimension ?? undefined,
    )} in "${stripUntrustedMarkers(data.chart_name)}".`;
    await bridge.updateModelContext(msg, {
      chart_id: data.chart_id,
      metric: selection.seriesName,
      value: selection.value,
      dimension: dimLabel,
      dimension_value: xVal,
    });
    await bridge.sendMessage(msg);
    setSelection(null);
    setToast('Shared this data point with the assistant.');
    window.setTimeout(() => setToast(null), 2600);
  }, [selection, data, roles]);

  // explore_url is a field on the ChartData (structuredContent), with a
  // legacy fallback to tool-result _meta for older servers.
  const exploreUrl = data?.explore_url ?? meta.explore_url;
  const openInSuperset = useCallback(() => {
    if (exploreUrl) void bridge.openLink(exploreUrl);
  }, [exploreUrl]);

  const toggleMetric = useCallback((name: string) => {
    setActiveMetrics((cur) => {
      if (cur.includes(name)) {
        const next = cur.filter((n) => n !== name);
        return next.length ? next : cur; // keep at least one
      }
      return [...cur, name];
    });
  }, []);

  // ---- Render ------------------------------------------------------------
  if (error) return shell(<ErrorState message={error} />, null);
  if (loading && !data) return shell(<LoadingSkeleton />, null);
  if (!data) return shell(<EmptyState />, null);

  const isEmpty = !data.data || data.data.length === 0;
  const isChartView = view === 'line' || view === 'bar' || view === 'area';
  const enableBrush = isChartView && canRequery && !!roles?.dimensionIsTemporal;

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
          <button type="button" className="sv-btn sv-btn--subtle" onClick={resetDrill}>
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
    />,
    data,
    drill.label,
    selection && canAsk ? (
      <div className="sv-toast">
        <span>
          {selection.seriesName}: <strong>{formatByColumn(selection.value)}</strong>
        </span>
        <button type="button" className="sv-btn sv-btn--ghost" onClick={askAboutSelection}>
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
    {
      height: frameHeight,
      maximized,
      onResizeStart: handleResizeStart,
      onToggleMaximize: toggleMaximize,
    },
  );
}

/** User-driven sizing controls threaded into the app chrome. */
interface FrameControls {
  height: number | null;
  maximized: boolean;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleMaximize: () => void;
}

/** Consistent app chrome: header + toolbar + body + insight footer. */
function shell(
  body: JSX.Element,
  toolbar: JSX.Element | null,
  data?: ChartData | null,
  drillLabel?: string,
  actionToast?: JSX.Element | null,
  toast?: string | null,
  frame?: FrameControls,
): JSX.Element {
  return (
    <div
      className="sv-app"
      style={frame?.height ? { height: `${frame.height}px` } : undefined}
    >
      <div className="sv-header">
        <div className="sv-title-wrap">
          <h1 className="sv-title">{data ? stripUntrustedMarkers(data.chart_name) : 'Chart'}</h1>
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
        {frame && (
          <button
            type="button"
            className="sv-btn sv-btn--subtle sv-maximize"
            onClick={frame.onToggleMaximize}
            aria-pressed={frame.maximized}
            aria-label={frame.maximized ? 'Restore chart size' : 'Maximize chart'}
            title={frame.maximized ? 'Restore size' : 'Maximize'}
          >
            {frame.maximized ? '⤡' : '⤢'}
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
      {frame && (
        <div
          className="sv-resize"
          onPointerDown={frame.onResizeStart}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize the chart"
          title="Drag to resize"
        />
      )}
    </div>
  );
}
