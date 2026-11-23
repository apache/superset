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
import { useContext, useEffect, useMemo, useState } from 'react';
import type { CanvasRendererProps } from 'src/core/canvas/types';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Select, Typography } from '@superset-ui/core/components';
import type { SelectFilterValue } from './echarts/chartData';
import { LOG_ACTIONS_CANVAS_ERROR } from 'src/logger/LogUtils';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';
import { useCanvasLogger } from './useCanvasLogger';

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

function FilterSelect({
  datasetId,
  column,
  props,
  refreshKey,
  setFilterValue,
  canvasId,
  nodeId,
}: CanvasRendererProps & { datasetId: number; column: string }) {
  const draftToken = useContext(CanvasDraftContext);
  const versionUuid = useContext(CanvasVersionContext);
  const log = useCanvasLogger(canvasId, {
    isDraft: Boolean(draftToken),
    versionUuid,
  });
  const staticOptions = strings(props?.options);
  const optionsKey = JSON.stringify([
    staticOptions,
    draftToken ?? null,
    versionUuid ?? null,
  ]);
  const [fetched, setFetched] = useState<{ key: string; values: string[] }>({
    key: optionsKey,
    values: [],
  });
  const [selected, setSelected] = useState(() =>
    strings(props?.defaultSelection),
  );

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
      .catch(async response => {
        if (cancelled) return;
        setFetched({ key: optionsKey, values: [] });
        // Worth reporting even though nothing is thrown: the filter renders
        // as an empty dropdown, so the failure is invisible to the user as
        // well as to us, and shows up later as "the data looks wrong".
        const error = await getClientErrorObject(response);
        log(LOG_ACTIONS_CANVAS_ERROR, {
          scope: 'filter_values',
          placement_id: nodeId,
          status: error.status,
          error_type: error.errors?.[0]?.error_type,
          has_err: true,
        });
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

  // The keyed component owns one binding's selection. Always publish its
  // initial value, including an empty default that clears a parent's old value.
  // Draft transitions and refreshes preserve this component and its selection.
  useEffect(() => {
    publish(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

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
          setSelected(values);
        }}
      />
    </Wrapper>
  );
}

/**
 * A multi-select over one dataset column. Its value reaches the widgets in
 * its scope as `{datasetId, column, values}`, or clears when nothing is
 * selected.
 */
export default function FilterSelectRenderer(widget: CanvasRendererProps) {
  const datasetId = Number(widget.props?.datasetId);
  const column =
    typeof widget.props?.column === 'string' ? widget.props.column : '';
  const sourceKey = JSON.stringify([
    widget.canvasId,
    widget.nodeId,
    datasetId,
    column,
  ]);
  return (
    <FilterSelect
      key={sourceKey}
      {...widget}
      datasetId={datasetId}
      column={column}
    />
  );
}
