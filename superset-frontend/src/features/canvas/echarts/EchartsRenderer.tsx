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

import { useEffect, useRef, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  getCategoricalSchemeRegistry,
  getClientErrorObject,
} from '@superset-ui/core';
import { applyStructuredChrome, EchartsChromeValue } from './chrome';
import { DataBinding, fetchRows, withFilters } from './chartData';
import { DataRow, resolveOption } from './resolveBindings';
import { themedOption, withLabelColors } from './themedOption';

const Chart = styled.div`
  width: 100%;
  height: 100%;
  min-height: 120px;
`;

const Message = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.sizeUnit * 2}px;
    color: ${theme.colorTextSecondary};
    text-align: center;
  `}
`;

const describe = async (error: unknown): Promise<string> => {
  if (error instanceof Error) return error.message;
  const { error: message } = await getClientErrorObject(
    error as Parameters<typeof getClientErrorObject>[0],
  );
  return message ?? t('Unknown error');
};

/**
 * Renders the `echarts` widget: any ECharts option, with `$bind` markers
 * filled from the widget's query and styled by the Superset theme and the
 * canvas's color scheme. ECharts is loaded on first use.
 */
export default function EchartsRenderer({
  props,
  refreshKey,
  colors,
  filters,
  crossFilters,
}: canvasApi.CanvasWidgetProps) {
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const bound = props?.dataBinding as DataBinding | undefined;
  const binding = bound && withFilters(bound, [...filters, ...crossFilters]);
  const option = (props?.echartsOptions ?? {}) as Record<string, unknown>;
  const bindingKey = JSON.stringify(binding ?? null);
  const optionKey = JSON.stringify([option, props?.chrome ?? null]);
  const { scheme } = colors;
  const labelColorsKey = JSON.stringify(colors.labelColors);

  useEffect(() => {
    let disposed = false;
    let chart: { dispose: () => void; resize: () => void } | undefined;
    let observer: ResizeObserver | undefined;
    (async () => {
      try {
        const [echarts, rows] = await Promise.all([
          import('echarts'),
          binding?.datasetId
            ? fetchRows(binding)
            : Promise.resolve<DataRow[]>([]),
        ]);
        if (disposed || !container.current) return;
        const resolved = resolveOption(option, {
          rows,
          theme: theme as unknown as Record<string, unknown>,
        });
        const palette =
          getCategoricalSchemeRegistry().get(scheme)?.colors ?? [];
        const instance = echarts.init(container.current);
        instance.setOption(
          themedOption(
            withLabelColors(
              applyStructuredChrome(
                resolved,
                props?.chrome as EchartsChromeValue | undefined,
              ),
              colors.labelColors,
            ),
            theme,
            palette,
          ),
        );
        chart = instance;
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(container.current);
        setError(undefined);
      } catch (e) {
        if (!disposed) setError(await describe(e));
      }
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      chart?.dispose();
    };
    // Keys stand in for the objects, which are recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey, optionKey, refreshKey, theme, scheme, labelColorsKey]);

  if (error) {
    return <Message>{t('This chart could not be drawn: %s', error)}</Message>;
  }
  return <Chart ref={container} data-test="canvas-echarts" />;
}
