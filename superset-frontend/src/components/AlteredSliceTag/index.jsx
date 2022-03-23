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
import PropTypes from 'prop-types';
import { isEqual, isEmpty } from 'lodash';
import { t } from '@superset-ui/core';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { safeStringify } from 'src/utils/safeStringify';
import { Tooltip } from 'src/components/Tooltip';
import ModalTrigger from '../ModalTrigger';
import TableView from '../TableView';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
};

function alterForComparison(value) {
  // Considering `[]`, `{}`, `null` and `undefined` as identical
  // for this purpose
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value) && value.length === 0) {
      return null;
    }
    const keys = Object.keys(value);
    if (keys && keys.length === 0) {
      return null;
    }
  }
  return value;
}

export default class AlteredSliceTag extends React.Component {
  constructor(props) {
    super(props);
    const diffs = this.getDiffs(props);
    const controlsMap = getControlsForVizType(this.props.origFormData.viz_type);
    const rows = this.getRowsFromDiffs(diffs, controlsMap);

    this.state = { rows, hasDiffs: !isEmpty(diffs), controlsMap };
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    // Update differences if need be
    if (isEqual(this.props, newProps)) {
      return;
    }
    const diffs = this.getDiffs(newProps);
    this.setState(prevState => ({
      rows: this.getRowsFromDiffs(diffs, prevState.controlsMap),
      hasDiffs: !isEmpty(diffs),
    }));
  }

  getRowsFromDiffs(diffs, controlsMap) {
    return Object.entries(diffs).map(([key, diff]) => ({
      control: (controlsMap[key] && controlsMap[key].label) || key,
      before: this.formatValue(diff.before, key, controlsMap),
      after: this.formatValue(diff.after, key, controlsMap),
    }));
  }

  getDiffs(props) {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = props.origFormData;
    const cfd = props.currentFormData;

    const fdKeys = Object.keys(cfd);
    const diffs = {};
    fdKeys.forEach(fdKey => {
      if (!ofd[fdKey] && !cfd[fdKey]) {
        return;
      }
      if (['filters', 'having', 'having_filters', 'where'].includes(fdKey)) {
        return;
      }
      if (!this.isEqualish(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    });
    return diffs;
  }

  isEqualish(val1, val2) {
    return isEqual(alterForComparison(val1), alterForComparison(val2));
  }

  formatValue(value, key, controlsMap) {
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
    if (controlsMap[key]?.type === 'MetricsControl' && Array.isArray(value)) {
      const formattedValue = value.map(v => (v.label ? v.label : v));
      return formattedValue.length ? formattedValue.join(', ') : '[]';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value.constructor === Array) {
      return value.length ? value.join(', ') : '[]';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return safeStringify(value);
  }

  renderModalBody() {
    const columns = [
      {
        accessor: 'control',
        Header: 'Control',
      },
      {
        accessor: 'before',
        Header: 'Before',
      },
      {
        accessor: 'after',
        Header: 'After',
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

  renderTriggerNode() {
    return (
      <Tooltip id="difference-tooltip" title={t('Click to see difference')}>
        <span
          className="label label-warning m-l-5"
          style={{ fontSize: '12px' }}
        >
          {t('Altered')}
        </span>
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

AlteredSliceTag.propTypes = propTypes;
