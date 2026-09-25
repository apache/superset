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
  Component,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { Flex, Loading, Typography } from '@superset-ui/core/components';
import { useWidgetBus } from '../bus';
import { useWidgetDataClient } from '../dataClient';
import { getWidgetComponent } from '../registry';
import type { DataBindingSpec, SavedWidget } from '../types';
import { useExtensionWidget } from './extensionLoader';

export interface CommonWidgetProps {
  /** Identity on the bus; defaults to a stable generated id. */
  instanceId?: string;
  className?: string;
  style?: CSSProperties;
  /** Shown while a saved widget loads. */
  fallback?: ReactNode;
  renderError?: (error: Error) => ReactNode;
  /**
   * Render the widget's own title above it. In a dashboard the title lives in
   * the builder's widget header, so the widget itself never draws it.
   */
  showTitle?: boolean;
}

export type WidgetElementProps = CommonWidgetProps &
  (
    | { type: string; props?: Record<string, unknown>; id?: never }
    | { id: string; type?: never; props?: never }
  );

function widgetTitle(
  type: string,
  props: Record<string, unknown>,
): string | undefined {
  if (type !== 'echarts') return undefined;
  const chromeText = (props.chrome as { titleText?: unknown } | undefined)
    ?.titleText;
  const rawTitle = (props.echartsOptions as { title?: unknown } | undefined)
    ?.title;
  const first = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;
  const text =
    typeof chromeText === 'string' && chromeText.trim() !== ''
      ? chromeText
      : (first as { text?: unknown } | undefined)?.text;
  return typeof text === 'string' && text.trim() !== ''
    ? text.trim()
    : undefined;
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

function DefaultError({ error }: { error: Error }) {
  return (
    <Flex
      align="center"
      justify="center"
      style={{ width: '100%', height: '100%' }}
    >
      <Typography.Text type="danger">{error.message}</Typography.Text>
    </Flex>
  );
}

class WidgetErrorBoundary extends Component<
  { renderError?: (error: Error) => ReactNode; children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error: toError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[superset-widgets]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return this.props.renderError?.(error) ?? <DefaultError error={error} />;
    }
    return this.props.children;
  }
}

/**
 * One Superset widget, rendered in place: either an inline definition
 * (`type` + `props`) or a widget saved in Superset (`id`). Must be inside a
 * `SupersetProvider`.
 */
export function Widget(widgetProps: WidgetElementProps) {
  const {
    instanceId,
    className,
    style,
    fallback,
    renderError,
    showTitle = true,
    id,
  } = widgetProps;
  const generatedId = useId();
  const busId = instanceId ?? `widget${generatedId}`;
  const bus = useWidgetBus();
  const client = useWidgetDataClient();
  const [saved, setSaved] = useState<SavedWidget>();
  const [loadError, setLoadError] = useState<Error>();

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setSaved(undefined);
    setLoadError(undefined);
    if (!client.getSavedWidget) {
      setLoadError(new Error('This data client cannot load saved widgets.'));
      return undefined;
    }
    client.getSavedWidget(id).then(
      widget => {
        if (!cancelled) setSaved(widget);
      },
      error => {
        if (!cancelled) setLoadError(toError(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, id]);

  // A widget that leaves must not keep filtering the ones that stay.
  useEffect(
    () => () => {
      const value = bus.getValue(busId, dashboardApi.VALUE_CHANGED_EVENT) as
        { resolved?: unknown } | undefined;
      if (value?.resolved) {
        bus.emit(busId, dashboardApi.VALUE_CHANGED_EVENT, {
          selection: null,
          resolved: null,
        });
      }
    },
    [bus, busId],
  );

  const type = id ? saved?.widget_type : widgetProps.type;
  const props = id ? saved?.props : (widgetProps.props ?? {});
  const registered = type ? getWidgetComponent(type) : undefined;
  // A type the registry does not have may still belong to an extension, whose
  // frontend is fetched from Superset the first time one of its widgets renders.
  const extension = useExtensionWidget(registered ? undefined : type);
  const WidgetComponent = registered ?? extension.component;

  let content: ReactNode;
  if (loadError) {
    content = renderError?.(loadError) ?? <DefaultError error={loadError} />;
  } else if (extension.error) {
    content = renderError?.(extension.error) ?? (
      <DefaultError error={extension.error} />
    );
  } else if (!type || !props || extension.loading) {
    content = fallback ?? <Loading position="inline-centered" size="s" />;
  } else if (!WidgetComponent) {
    const error = new Error(`Unknown widget type "${type}"`);
    content = renderError?.(error) ?? <DefaultError error={error} />;
  } else {
    content = (
      <WidgetErrorBoundary renderError={renderError}>
        <WidgetComponent instanceId={busId} props={props} savedId={id} />
      </WidgetErrorBoundary>
    );
  }

  const title =
    showTitle && type && props ? widgetTitle(type, props) : undefined;

  return (
    <Flex
      vertical
      gap="small"
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      data-superset-widget={type}
    >
      {title && (
        <Typography.Text strong ellipsis style={{ flex: 'none' }}>
          {title}
        </Typography.Text>
      )}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {content}
      </div>
    </Flex>
  );
}

function splitCommon<T extends CommonWidgetProps>(
  all: T,
): [CommonWidgetProps, Omit<T, keyof CommonWidgetProps>] {
  const {
    instanceId,
    className,
    style,
    fallback,
    renderError,
    showTitle,
    ...rest
  } = all;
  return [
    { instanceId, className, style, fallback, renderError, showTitle },
    rest,
  ];
}

export interface ChartProps extends CommonWidgetProps {
  dataBinding: DataBindingSpec;
  /** A near-raw ECharts option; `$bind` markers splice in query results. */
  echartsOptions?: Record<string, unknown>;
  chartType?: 'bar' | 'line' | 'scatter';
  chrome?: Record<string, unknown>;
  customize?: Record<string, unknown>;
  crossFilter?: boolean;
}

export interface MetricTileProps extends CommonWidgetProps {
  dataBinding: DataBindingSpec;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export interface TableProps extends CommonWidgetProps {
  dataBinding: DataBindingSpec;
  columnDefs?: Record<string, unknown>[];
}

export interface FilterSelectProps extends CommonWidgetProps {
  datasetId: number;
  column: string;
  options?: string[];
  defaultSelection?: string[];
  scope?: { targets?: string[] };
}

export interface MarkdownProps extends CommonWidgetProps {
  content: string;
}

export function Chart(chartProps: ChartProps) {
  const [common, props] = splitCommon(chartProps);
  return <Widget {...common} type="echarts" props={{ ...props }} />;
}

export function MetricTile(tileProps: MetricTileProps) {
  const [common, props] = splitCommon(tileProps);
  return <Widget {...common} type="metric-tile" props={{ ...props }} />;
}

export function Table(tableProps: TableProps) {
  const [common, props] = splitCommon(tableProps);
  return <Widget {...common} type="ag-grid-table" props={{ ...props }} />;
}

export function FilterSelect(filterProps: FilterSelectProps) {
  const [common, props] = splitCommon(filterProps);
  return <Widget {...common} type="filter.select" props={{ ...props }} />;
}

export function Markdown(markdownProps: MarkdownProps) {
  const [common, props] = splitCommon(markdownProps);
  return <Widget {...common} type="markdown" props={{ ...props }} />;
}

Widget.displayName = 'Widget';
Chart.displayName = 'Chart';
MetricTile.displayName = 'MetricTile';
Table.displayName = 'Table';
FilterSelect.displayName = 'FilterSelect';
Markdown.displayName = 'Markdown';
