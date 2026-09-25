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
import { dashboard as dashboardApi } from '@apache-superset/core';
import { Flex, Select, Typography } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { useWidgetBus, useWidgetBusRevision } from '../bus';
import { useWidgetDataClient, widgetRef } from '../dataClient';
import { useWidgetApplySource } from '../deferredApply';
import { FILTER_BAR_APPLY_EVENT } from '../filterVocabulary';
import type {
  FilterValueChangedPayload,
  ResolvedFilter,
} from '../filterVocabulary';
import type { WidgetProps } from '../types';

const TYPE = 'filter.select';

/** Distinct values of the target column, unless the author listed `options`. */
function useDistinctColumnValues(
  instanceId: string,
  props: Record<string, unknown>,
  savedId: string | undefined,
  datasetId: number | undefined,
  column: string | undefined,
): string[] {
  const client = useWidgetDataClient();
  const [values, setValues] = useState<string[]>([]);
  // Props are read when the lookup runs; only what changes the answer
  // re-runs it, so an inline `props` literal does not refetch every render.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (datasetId == null || !column) {
      setValues([]);
      return undefined;
    }
    let cancelled = false;
    client
      .fetchValues({
        instanceId,
        widget: widgetRef(TYPE, propsRef.current, savedId),
      })
      .then(result => {
        if (!cancelled) {
          setValues(result.filter(v => v != null).map(v => String(v)));
        }
      })
      .catch(() => {
        if (!cancelled) setValues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, instanceId, savedId, datasetId, column]);

  return values;
}

function resolveSelectFilter(
  column: string,
  selection: string[],
  datasource?: number,
): ResolvedFilter | null {
  if (!selection.length) return null;
  return selection.length === 1
    ? { column, operator: 'EQUALS', value: selection[0], datasource }
    : { column, operator: 'IN', value: selection, datasource };
}

/**
 * The built-in `filter.select` widget. A viewer's selection is session state,
 * so it is emitted on the bus (`valueChanged`), never written back to props.
 * Inside a builder filter bar (see `WidgetApplySourceContext`) a change is
 * held until the bar's Apply fires.
 */
export default function FilterSelectWidget({
  instanceId,
  props,
  savedId,
}: WidgetProps) {
  const bus = useWidgetBus();
  useWidgetBusRevision(bus);
  const applySourceId = useWidgetApplySource();
  const inFilterBar = applySourceId !== undefined;

  const column = props.column as string | undefined;
  const datasetId = props.datasetId as number | undefined;
  const authoredOptions = props.options as string[] | undefined;
  const queriedOptions = useDistinctColumnValues(
    instanceId,
    props,
    savedId,
    datasetId,
    column,
  );
  const options = authoredOptions?.length ? authoredOptions : queriedOptions;
  const defaultSelection = props.defaultSelection as string[] | undefined;
  const scopeTargets = (
    props.scope as { targets?: string[] } | undefined
  )?.targets?.filter(target => target !== '');

  const payloadFor = (selection: string[]): FilterValueChangedPayload => ({
    selection,
    resolved: column ? resolveSelectFilter(column, selection, datasetId) : null,
    ...(scopeTargets?.length ? { targets: scopeTargets } : {}),
  });

  const [pendingSelection, setPendingSelection] = useState<
    string[] | undefined
  >(undefined);

  const currentValue = bus.getValue(
    instanceId,
    dashboardApi.VALUE_CHANGED_EVENT,
  ) as FilterValueChangedPayload | undefined;

  // The author's default applies once, the first time there is no live
  // selection; editing the default later never overrides a viewer's choice.
  useEffect(() => {
    if (
      column &&
      defaultSelection?.length &&
      bus.getValue(instanceId, dashboardApi.VALUE_CHANGED_EVENT) === undefined
    ) {
      bus.emit(
        instanceId,
        dashboardApi.VALUE_CHANGED_EVENT,
        payloadFor(defaultSelection),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, instanceId]);

  useEffect(() => {
    if (!inFilterBar) return undefined;
    const subscription = bus.on(FILTER_BAR_APPLY_EVENT, event => {
      if (event.nodeId !== applySourceId || pendingSelection === undefined) {
        return;
      }
      bus.emit(
        instanceId,
        dashboardApi.VALUE_CHANGED_EVENT,
        payloadFor(pendingSelection),
      );
      setPendingSelection(undefined);
    });
    return () => subscription.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bus,
    inFilterBar,
    applySourceId,
    pendingSelection,
    column,
    datasetId,
    instanceId,
  ]);

  if (!column || datasetId == null) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ width: '100%', height: '100%', padding: 8 }}
      >
        <Typography.Text type="secondary">
          {t('This filter has no target column configured')}.
        </Typography.Text>
      </Flex>
    );
  }

  const value =
    pendingSelection ??
    (currentValue?.selection as string[] | undefined) ??
    defaultSelection ??
    [];

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Select
        mode="multiple"
        allowClear
        ariaLabel={`Filter by ${column}`}
        placeholder={`Filter by ${column}`}
        options={options.map(option => ({ label: option, value: option }))}
        value={value}
        // The container clips overflow, so the dropdown renders at body level.
        getPopupContainer={() => document.body}
        onChange={next => {
          const selection = Array.isArray(next) ? (next as string[]) : [];
          if (inFilterBar) {
            setPendingSelection(selection);
            return;
          }
          bus.emit(
            instanceId,
            dashboardApi.VALUE_CHANGED_EVENT,
            payloadFor(selection),
          );
        }}
        // The shared Select caps its tag row at one line; a filter needs to
        // show everything selected, up to the room the widget has.
        css={{
          width: '100%',
          '.ant-select-content': { maxHeight: 'none !important' },
          '.ant-select-selection-item': { maxHeight: 'none !important' },
        }}
      />
    </div>
  );
}
