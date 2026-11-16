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
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Select, Typography } from '@superset-ui/core/components';
import type { SelectFilterValue } from './echarts/chartData';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';

const Wrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    min-width: ${theme.sizeUnit * 50}px;
  `}
`;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/**
 * A multi-select over one dataset column. Its value reaches the widgets in
 * its scope as `{datasetId, column, values}`, or clears when nothing is
 * selected.
 */
export default function FilterSelectRenderer({
  canvasId,
  nodeId,
  props,
  refreshKey,
  setFilterValue,
}: canvasApi.CanvasWidgetProps) {
  const datasetId = Number(props?.datasetId);
  const column = typeof props?.column === 'string' ? props.column : '';
  const draftToken = useContext(CanvasDraftContext);
  const versionUuid = useContext(CanvasVersionContext);
  const sourceKey = JSON.stringify([canvasId, nodeId, datasetId, column]);
  const staticOptions = strings(props?.options);
  const optionsKey = JSON.stringify([
    sourceKey,
    staticOptions,
    draftToken ?? null,
    versionUuid ?? null,
  ]);
  const [fetched, setFetched] = useState<{ key: string; values: string[] }>({
    key: optionsKey,
    values: [],
  });
  const [selection, setSelection] = useState(() => ({
    key: sourceKey,
    values: strings(props?.defaultSelection),
  }));
  const selected =
    selection.key === sourceKey
      ? selection.values
      : strings(props?.defaultSelection);
  const publishedSource = useRef<string>();

  useEffect(() => {
    setFetched(previous =>
      previous.key === optionsKey ? previous : { key: optionsKey, values: [] },
    );
    if (staticOptions.length || !datasetId || !column) return undefined;
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/datasource/table/${datasetId}/column/${encodeURIComponent(column)}/values/`,
    })
      .then(({ json }) => {
        if (!cancelled) {
          setFetched({
            key: optionsKey,
            values: strings(json?.result).filter(value => value !== 'null'),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: optionsKey, values: [] });
      });
    return () => {
      cancelled = true;
    };
    // Keep options during a refresh, but cancel any older pending request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, refreshKey]);

  const publish = (values: string[]) => {
    const value: SelectFilterValue | null = values.length
      ? { datasetId, column, values }
      : null;
    setFilterValue(value);
  };

  // A new binding initializes from its own defaults. Draft transitions and
  // refreshes keep the current selection when the binding is unchanged.
  useEffect(() => {
    if (publishedSource.current === sourceKey) return;
    setSelection({ key: sourceKey, values: selected });
    if (selected.length || publishedSource.current !== undefined) {
      publish(selected);
    }
    publishedSource.current = sourceKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const options = useMemo(
    () =>
      (staticOptions.length
        ? staticOptions
        : fetched.key === optionsKey
          ? fetched.values
          : []
      ).map(value => ({
        label: value,
        value,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetched, optionsKey],
  );

  return (
    <Wrapper>
      <Typography.Text strong>{column || t('Filter')}</Typography.Text>
      <Select
        ariaLabel={column || t('Filter')}
        mode="multiple"
        allowClear
        placeholder={t('All')}
        options={options}
        value={selected}
        onChange={value => {
          const values = strings(value);
          setSelection({ key: sourceKey, values });
          publish(values);
        }}
      />
    </Wrapper>
  );
}
