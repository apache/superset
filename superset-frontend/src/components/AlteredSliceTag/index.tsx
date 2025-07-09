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
import { useEffect, useMemo, useState, FC } from 'react';
import { isEmpty } from 'lodash';
import { t } from '@superset-ui/core';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import {
  Label,
  Icons,
  Tooltip,
  ModalTrigger,
  TableView,
} from '@superset-ui/core/components';
import type { AlteredSliceTagProps, ControlMap, RowType } from './types';
import { getRowsFromDiffs } from './utils';

export const AlteredSliceTag: FC<AlteredSliceTagProps> = props => {
  const [rows, setRows] = useState<RowType[]>([]);
  const [hasDiffs, setHasDiffs] = useState<boolean>(false);

  useEffect(() => {
    const controlsMap = getControlsForVizType(
      props.origFormData?.viz_type,
    ) as ControlMap;

    setRows(getRowsFromDiffs(props.diffs, controlsMap));
    setHasDiffs(!isEmpty(props.diffs));
  }, [props.diffs, props.origFormData?.viz_type]);

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
