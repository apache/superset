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
import { useCallback, useEffect, useMemo, useState, FC } from 'react';

import { isEqual, isEmpty } from 'lodash';
import { t } from '@superset-ui/core';
import { sanitizeFormData } from 'src/explore/exploreUtils/formData';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { safeStringify } from 'src/utils/safeStringify';
import {
  Label,
  Icons,
  Tooltip,
  ModalTrigger,
  TableView,
} from '@superset-ui/core/components';
import type {
  AlteredSliceTagProps,
  ControlMap,
  DiffItemType,
  DiffType,
  FilterItemType,
  RowType,
} from './types';

export const alterForComparison = (
  value?: string | null | [],
): string | null => {
  // Treat `null`, `undefined`, and empty strings as equivalent
  if (value === undefined || value === null || value === '') {
    return null;
  }
  // Treat empty arrays and objects as equivalent to null
  if (Array.isArray(value) && value.length === 0) {
    return null;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return null;
  }
  return value;
};

export const formatValueHandler = (
  value: DiffItemType,
  key: string,
  controlsMap: ControlMap,
): string | number => {
  if (value === undefined) {
    return 'N/A';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (controlsMap[key]?.type === 'AdhocFilterControl' && Array.isArray(value)) {
    if (!value.length) {
      return '[]';
    }
    return value
      .map((v: FilterItemType) => {
        const filterVal =
          v.comparator && v.comparator.constructor === Array
            ? `[${v.comparator.join(', ')}]`
            : v.comparator;
        return `${v.subject} ${v.operator} ${filterVal}`;
      })
      .join(', ');
  }
  if (controlsMap[key]?.type === 'BoundsControl' && Array.isArray(value)) {
    return `Min: ${value[0]}, Max: ${value[1]}`;
  }
  if (controlsMap[key]?.type === 'CollectionControl' && Array.isArray(value)) {
    return value.map((v: FilterItemType) => safeStringify(v)).join(', ');
  }
  if (
    controlsMap[key]?.type === 'MetricsControl' &&
    value.constructor === Array
  ) {
    const formattedValue = value.map((v: FilterItemType) => v?.label ?? v);
    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }
  if (Array.isArray(value)) {
    const formattedValue = value.map((v: FilterItemType) => v?.label ?? v);
    return formattedValue.length ? formattedValue.join(', ') : '[]';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return safeStringify(value);
};

export const getRowsFromDiffs = (
  diffs: { [key: string]: DiffType },
  controlsMap: ControlMap,
): RowType[] =>
  Object.entries(diffs).map(([key, diff]) => ({
    control: controlsMap[key]?.label || key,
    before: formatValueHandler(diff.before, key, controlsMap),
    after: formatValueHandler(diff.after, key, controlsMap),
  }));

export const isEqualish = (val1: string, val2: string): boolean =>
  isEqual(alterForComparison(val1), alterForComparison(val2));

export const AlteredSliceTag: FC<AlteredSliceTagProps> = props => {
  const [rows, setRows] = useState<RowType[]>([]);
  const [hasDiffs, setHasDiffs] = useState<boolean>(false);

  const getDiffs = useCallback(() => {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = sanitizeFormData(props.origFormData);
    const cfd = sanitizeFormData(props.currentFormData);

    const fdKeys = Object.keys(cfd);
    const diffs: { [key: string]: DiffType } = {};
    fdKeys.forEach(fdKey => {
      if (!ofd[fdKey] && !cfd[fdKey]) {
        return;
      }
      if (['filters', 'having', 'where'].includes(fdKey)) {
        return;
      }
      if (!isEqualish(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    });
    return diffs;
  }, [props.currentFormData, props.origFormData]);

  useEffect(() => {
    const diffs = getDiffs();
    const controlsMap = getControlsForVizType(
      props.origFormData?.viz_type,
    ) as ControlMap;
    setRows(getRowsFromDiffs(diffs, controlsMap));
    setHasDiffs(!isEmpty(diffs));
  }, [getDiffs, props.origFormData?.viz_type]);

  const modalBody = useMemo(() => {
    const columns = [
      {
        accessor: 'control',
        Header: t('Control'),
        id: 'control',
      },
      {
        accessor: 'before',
        Header: t('Before'),
        id: 'before',
      },
      {
        accessor: 'after',
        Header: t('After'),
        id: 'after',
      },
    ];
    // set the wrap text in the specific columns.
    const columnsForWrapText = ['control', 'before', 'after'];

    return (
      <TableView
        columns={columns}
        data={rows}
        pageSize={50}
        className="table-condensed"
        columnsForWrapText={columnsForWrapText}
      />
    );
  }, [rows]);

  const triggerNode = useMemo(
    () => (
      <Tooltip id="difference-tooltip" title={t('Click to see difference')}>
        <Label
          icon={<Icons.ExclamationCircleOutlined iconSize="m" />}
          className="label"
          type="warning"
          onClick={() => {}}
        >
          {t('Altered')}
        </Label>
      </Tooltip>
    ),
    [],
  );

  if (!hasDiffs) {
    return null;
  }

  return (
    <ModalTrigger
      triggerNode={triggerNode}
      modalTitle={t('Chart changes')}
      modalBody={modalBody}
      responsive
    />
  );
};

export type { AlteredSliceTagProps };
