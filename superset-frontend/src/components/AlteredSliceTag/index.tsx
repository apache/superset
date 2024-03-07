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
import React from 'react';
import { isEqual, isEmpty } from 'lodash';
import { QueryFormData, styled, t } from '@superset-ui/core';
import { sanitizeFormData } from 'src/explore/exploreUtils/formData';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { safeStringify } from 'src/utils/safeStringify';
import { Tooltip } from 'src/components/Tooltip';
import ModalTrigger from '../ModalTrigger';
import TableView from '../TableView';

interface AlteredSliceTagProps {
  origFormData: QueryFormData;
  currentFormData: QueryFormData;
}

export interface ControlMap {
  [key: string]: {
    label?: string;
    type?: string;
  };
}

type FilterItemType = {
  comparator?: string | string[];
  subject: string;
  operator: string;
  label?: string;
};

export type DiffItemType<
  T = FilterItemType | number | string | Record<string | number, any>,
> =
  | T[]
  | boolean
  | number
  | string
  | Record<string | number, any>
  | null
  | undefined;

export type DiffType = {
  before: DiffItemType;
  after: DiffItemType;
};

export type RowType = {
  before: string | number;
  after: string | number;
  control: string;
};

interface AlteredSliceTagState {
  rows: RowType[];
  hasDiffs: boolean;
  controlsMap: ControlMap;
}

const StyledLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.dark1};
    background-color: ${theme.colors.alert.base};

    &:hover {
      background-color: ${theme.colors.alert.dark1};
    }
  `}
`;

function alterForComparison(value?: string | null | []): string | null {
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
}

class AlteredSliceTag extends React.Component<
  AlteredSliceTagProps,
  AlteredSliceTagState
> {
  constructor(props: AlteredSliceTagProps) {
    super(props);
    const diffs = this.getDiffs(props);
    const controlsMap: ControlMap = getControlsForVizType(
      props.origFormData.viz_type,
    ) as ControlMap;
    const rows = this.getRowsFromDiffs(diffs, controlsMap);

    this.state = { rows, hasDiffs: !isEmpty(diffs), controlsMap };
  }

  UNSAFE_componentWillReceiveProps(newProps: AlteredSliceTagProps): void {
    if (isEqual(this.props, newProps)) {
      return;
    }
    const diffs = this.getDiffs(newProps);
    this.setState(prevState => ({
      rows: this.getRowsFromDiffs(diffs, prevState.controlsMap),
      hasDiffs: !isEmpty(diffs),
    }));
  }

  getRowsFromDiffs(
    diffs: { [key: string]: DiffType },
    controlsMap: ControlMap,
  ): RowType[] {
    return Object.entries(diffs).map(([key, diff]) => ({
      control: controlsMap[key]?.label || key,
      before: this.formatValue(diff.before, key, controlsMap),
      after: this.formatValue(diff.after, key, controlsMap),
    }));
  }

  getDiffs(props: AlteredSliceTagProps): { [key: string]: DiffType } {
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
      if (!this.isEqualish(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    });
    return diffs;
  }

  isEqualish(val1: string, val2: string): boolean {
    return isEqual(alterForComparison(val1), alterForComparison(val2));
  }

  formatValue(
    value: DiffItemType,
    key: string,
    controlsMap: ControlMap,
  ): string | number {
    if (value === undefined) {
      return 'N/A';
    }
    if (value === null) {
      return 'null';
    }
    if (
      controlsMap[key]?.type === 'AdhocFilterControl' &&
      Array.isArray(value)
    ) {
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
    if (controlsMap[key]?.type === 'BoundsControl') {
      return `Min: ${value[0]}, Max: ${value[1]}`;
    }
    if (
      controlsMap[key]?.type === 'CollectionControl' &&
      Array.isArray(value)
    ) {
      return value.map(v => safeStringify(v)).join(', ');
    }
    if (controlsMap[key]?.type === 'MetricsControl' && Array.isArray(value)) {
      const formattedValue = value.map((v: FilterItemType) => v?.label ?? v);
      return formattedValue.length ? formattedValue.join(', ') : '[]';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      const formattedValue = value.map((v: FilterItemType) => v?.label ?? v);
      return formattedValue.length ? formattedValue.join(', ') : '[]';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return safeStringify(value);
  }

  renderModalBody(): React.ReactNode {
    const columns = [
      {
        accessor: 'control',
        Header: t('Control'),
      },
      {
        accessor: 'before',
        Header: t('Before'),
      },
      {
        accessor: 'after',
        Header: t('After'),
      },
    ];
    // set the wrap text in the specific columns.
    const columnsForWrapText = ['Control', 'Before', 'After'];

    return (
      <TableView
        columns={columns}
        data={this.state.rows}
        pageSize={50}
        className="table-condensed"
        columnsForWrapText={columnsForWrapText}
      />
    );
  }

  renderTriggerNode(): React.ReactNode {
    return (
      <Tooltip id="difference-tooltip" title={t('Click to see difference')}>
        <StyledLabel className="label">{t('Altered')}</StyledLabel>
      </Tooltip>
    );
  }

  render() {
    // Return nothing if there are no differences
    if (!this.state.hasDiffs) {
      return null;
    }
    // Render the label-warning 'Altered' tag which the user may
    // click to open a modal containing a table summarizing the
    // differences in the slice
    return (
      <ModalTrigger
        triggerNode={this.renderTriggerNode()}
        modalTitle={t('Chart changes')}
        modalBody={this.renderModalBody()}
        responsive
      />
    );
  }
}

export default AlteredSliceTag;
