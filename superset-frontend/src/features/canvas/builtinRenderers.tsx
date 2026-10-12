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
import type { ComponentType } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SafeMarkdown, Tabs, Typography } from '@superset-ui/core/components';
import { canvas } from 'src/core';
import EchartsRenderer from './echarts/EchartsRenderer';
import type { DataBinding } from './echarts/chartData';
import { renderTemplate } from './markdownTemplate';
import { MetricTileRenderer, TableRenderer } from './dataRenderers';
import { useWidgetRows } from './useWidgetRows';
import FilterSelectRenderer from './FilterSelectRenderer';

type Props = canvasApi.CanvasWidgetProps;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const TabsRenderer = ({ childNodes }: Props) => (
  <Tabs
    items={childNodes.map(child => ({
      key: child.nodeId,
      label: text(child.props?.title) || t('Untitled tab'),
      children: child.element,
    }))}
  />
);

const GridRenderer = ({ renderGrid }: Props) => <>{renderGrid()}</>;

const GroupRenderer = ({ props, renderGrid }: Props) => (
  <section>
    {text(props?.title) && (
      <Typography.Title level={5}>{text(props?.title)}</Typography.Title>
    )}
    {renderGrid()}
  </section>
);

const Markdown = styled.div`
  ${({ theme }) => css`
    height: 100%;
    overflow: auto;
    color: ${theme.colorText};

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      color: ${theme.colorTextHeading};
    }

    a {
      color: ${theme.colorLink};
    }

    code {
      background: ${theme.colorFillTertiary};
      border-radius: ${theme.borderRadiusSM}px;
      padding: 0 ${theme.sizeUnit}px;
    }

    table {
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    }
  `}
`;

const MarkdownRenderer = ({ props, filters, refreshKey }: Props) => {
  const binding = props?.dataBinding as DataBinding | undefined;
  const { rows, error } = useWidgetRows(binding, filters, refreshKey);

  const content = text(props?.content);
  return (
    <Markdown>
      <SafeMarkdown
        source={
          error
            ? `${t('Data unavailable')}: ${error}`
            : binding?.datasetId
              ? renderTemplate(content, rows)
              : content
        }
      />
    </Markdown>
  );
};

/** Renderers for the core containers, filters, text and the ECharts widget. */
export const BUILTIN_RENDERERS: Record<string, ComponentType<Props>> = {
  tabs: TabsRenderer,
  tab: GridRenderer,
  group: GroupRenderer,
  'filter.bar': GridRenderer,
  'filter.select': FilterSelectRenderer,
  markdown: MarkdownRenderer,
  echarts: EchartsRenderer,
  'metric-tile': MetricTileRenderer,
  'ag-grid-table': TableRenderer,
};

let registered = false;

/** Registers the built-in renderers once, before the first canvas renders. */
export function registerBuiltinRenderers(): void {
  if (registered) return;
  registered = true;
  Object.entries(BUILTIN_RENDERERS).forEach(([widgetType, component]) =>
    canvas.registerWidgetRenderer(widgetType, component),
  );
}
