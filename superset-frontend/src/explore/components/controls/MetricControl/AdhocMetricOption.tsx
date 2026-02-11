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
import { useMemo, MouseEvent } from 'react';
import { useSelector } from 'react-redux';
import { Metric } from '@superset-ui/core';
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';
import { DndItemType } from 'src/explore/components/DndItemType';
import { Datasource } from 'src/explore/types';
import { ISaveableDatasource } from 'src/SqlLab/components/SaveDatasetModal';
import { getLocalizedValue } from 'src/components/TranslationEditor';
import AdhocMetric from './AdhocMetric';
import AdhocMetricPopoverTrigger from './AdhocMetricPopoverTrigger';
import { savedMetricType as SavedMetricTypeDef } from './types';

interface AdhocMetricOptionProps {
  adhocMetric: AdhocMetric;
  onMetricEdit: (newMetric: Metric, oldMetric: Metric) => void;
  onRemoveMetric?: (index: number) => void;
  columns?: { column_name: string; type: string }[];
  savedMetricsOptions?: SavedMetricTypeDef[];
  savedMetric?: SavedMetricTypeDef | Record<string, never>;
  datasource?: Datasource & ISaveableDatasource;
  onMoveLabel?: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel?: () => void;
  index?: number;
  type?: string;
  multi?: boolean;
  datasourceWarningMessage?: string;
}

const AdhocMetricOption = ({
  adhocMetric,
  onMetricEdit,
  onRemoveMetric,
  columns,
  savedMetricsOptions,
  savedMetric = {} as SavedMetricTypeDef,
  datasource,
  onMoveLabel,
  onDropLabel,
  index,
  type,
  multi,
  datasourceWarningMessage,
}: AdhocMetricOptionProps) => {
  const userLocale = useSelector(
    (state: { common: { locale: string } }) => state.common.locale,
  );

  // Get localized label for display
  const localizedLabel = useMemo(
    () =>
      getLocalizedValue(
        adhocMetric.translations,
        'label',
        userLocale,
        adhocMetric.label,
      ),
    [adhocMetric.translations, adhocMetric.label, userLocale],
  );

  const handleRemoveMetric = (e?: MouseEvent): void => {
    e?.stopPropagation();
    onRemoveMetric?.(index ?? 0);
  };

  const withCaret = !(savedMetric as SavedMetricTypeDef).error_text;

  return (
    <AdhocMetricPopoverTrigger
      adhocMetric={adhocMetric}
      onMetricEdit={onMetricEdit}
      columns={columns ?? []}
      savedMetricsOptions={savedMetricsOptions ?? []}
      savedMetric={savedMetric}
      datasource={datasource!}
    >
      <OptionControlLabel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        savedMetric={savedMetric as any}
        adhocMetric={adhocMetric}
        label={localizedLabel}
        onRemove={handleRemoveMetric}
        onMoveLabel={onMoveLabel}
        onDropLabel={onDropLabel}
        index={index ?? 0}
        type={type ?? DndItemType.AdhocMetricOption}
        withCaret={withCaret}
        isFunction
        multi={multi}
        datasourceWarningMessage={datasourceWarningMessage}
      />
    </AdhocMetricPopoverTrigger>
  );
};

export default AdhocMetricOption;
