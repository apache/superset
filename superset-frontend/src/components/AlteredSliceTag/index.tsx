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
import { styled, t } from '@superset-ui/core';
import { sanitizeFormData } from 'src/explore/exploreUtils/formData';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { safeStringify } from 'src/utils/safeStringify';
import { Tooltip } from 'src/components/Tooltip';
import ModalTrigger from '../ModalTrigger';
import TableView from '../TableView';

// Define interfaces for props and state
interface FormData {
  [key: string]: any; // Use a more specific type if possible for your form data
}

interface AlteredSliceTagProps {
  origFormData: FormData;
  currentFormData: FormData;
}

interface ControlMap {
  [key: string]: {
    label?: string;
    type?: string;
  };
}

interface Diff {
  before: any; // Specify a more precise type if possible
  after: any; // Specify a more precise type if possible
}

interface Row {
  control: string;
  before: string;
  after: string;
}

interface AlteredSliceTagState {
  rows: Row[];
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

function alterForComparison(value: any): any {
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
  // Return the value unchanged if it doesn't meet the above conditions
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
    );
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
    diffs: { [key: string]: Diff },
    controlsMap: ControlMap,
  ): Row[] {
    return Object.entries(diffs).map(([key, diff]) => ({
      control: (controlsMap[key] && controlsMap[key].label) || key,
      before: this.formatValue(diff.before, key, controlsMap),
      after: this.formatValue(diff.after, key, controlsMap),
    }));
  }

  getDiffs(props: AlteredSliceTagProps): { [key: string]: Diff } {
    const ofd = sanitizeFormData(props.origFormData);
    const cfd = sanitizeFormData(props.currentFormData);
    const fdKeys = Object.keys(cfd);
    const diffs: { [key: string]: Diff } = {};
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

  isEqualish(val1: any, val2: any): boolean {
    // Consider refining 'any' types
    return isEqual(alterForComparison(val1), alterForComparison(val2));
  }

  formatValue(value: any, key: string, controlsMap: ControlMap): string {
    // Consider refining 'any' types
    // Format display value based on the control type
    // or the value type
    if (value === undefined) {
      return 'N/A';
    }
    if (value === null) {
      return 'null';
    }
    if (controlsMap[key]?.type === 'AdhocFilterControl') {
      if (!value.length) {
        return '[]';
      }
      return value
        .map(v => {
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
    if (controlsMap[key]?.type === 'CollectionControl') {
      return value.map(v => safeStringify(v)).join(', ');
    }
    if (
      controlsMap[key]?.type === 'MetricsControl' &&
      value.constructor === Array
    ) {
      const formattedValue = value.map(v => v?.label ?? v);
      return formattedValue.length ? formattedValue.join(', ') : '[]';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value.constructor === Array) {
      const formattedValue = value.map(v => v?.label ?? v);
      return formattedValue.length ? formattedValue.join(', ') : '[]';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return safeStringify(value);
  }

  renderModalBody(): JSX.Element {
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

  renderTriggerNode(): JSX.Element {
    return (
      <Tooltip id="difference-tooltip" title={t('Click to see difference')}>
        <StyledLabel className="label">{t('Altered')}</StyledLabel>
      </Tooltip>
    );
  }

  render(): JSX.Element | null {
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
