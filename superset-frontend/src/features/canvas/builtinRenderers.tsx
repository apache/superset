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
import WithQuery from './WithQuery';
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

/**
 * A container's box, with its grid filling whatever its own chrome leaves.
 *
 * A container is as tall as it was placed. A grid left at its content height
 * would end at the last row its children fill, so the space below them --
 * plainly inside the container -- would belong to the grid outside it, and
 * the rows the container really has room for could not be measured. Anything
 * the container draws for itself, such as a title, comes off the top.
 */
/**
 * A container's title, clear of the grip above it.
 *
 * The grip is a `sizeUnit * 8` square pinned to the container's top left (see
 * `Grip`), so a title flush with the top would be covered by it the moment
 * anyone hovered. Reserving the strip rather than dodging on hover keeps the
 * container's contents from shifting under the pointer.
 */
const GroupTitle = styled(Typography.Title)`
  ${({ theme }) => css`
    /*
     * Exactly the row the server keeps for it, so the grid below starts where
     * the container's own box says it does. Taller than that and the last row
     * of the group is drawn past the container's edge, which clips it.
     *
     * Doubled selector because the heading's own margins come from Ant
     * Design's rule for h5, which outranks a plain class: left to itself its
     * bottom margin is added to the height below and overflows the row again.
     *
     * The fallback is that row at the default metrics, for a title rendered
     * outside a canvas grid.
     */
    && {
      height: var(--canvas-chrome-rows, ${theme.sizeUnit * 14}px);
      box-sizing: border-box;
      margin-top: 0;
      margin-bottom: 0;
      /* Sat at the bottom of the strip, clear of the grip at the top of it. */
      display: flex;
      align-items: flex-end;
    }
  `}
`;

const Container = styled.section`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const GridRenderer = ({ renderGrid }: Props) => (
  <Container>{renderGrid()}</Container>
);

const GroupRenderer = ({ props, renderGrid }: Props) => {
  const title = text(props?.title);
  return (
    <Container>
      {title && <GroupTitle level={5}>{title}</GroupTitle>}
      {/* A title takes the strip the group's own handles sit in, so no child
          of it has handles to clear; see `stepsAside`. */}
      {renderGrid({ chromeAbove: Boolean(title) })}
    </Container>
  );
};

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

const MarkdownRenderer = (widget: Props) => {
  const { props, filters, refreshKey } = widget;
  const binding = props?.dataBinding as DataBinding | undefined;
  const { rows, error, query, language, datasource } = useWidgetRows(
    widget,
    filters,
    refreshKey,
  );

  const content = text(props?.content);
  return (
    <WithQuery query={query} language={language} datasource={datasource}>
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
    </WithQuery>
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
