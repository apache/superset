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
import { Table, Tr, Td, Thead, Th } from 'reactable-arc';
import { isEqual, isEmpty } from 'lodash';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { t } from '@superset-ui/translation';
import TooltipWrapper from './TooltipWrapper';
import ModalTrigger from './ModalTrigger';
import { safeStringify } from '../utils/safeStringify';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
};

function alterForComparison(value) {
  // Considering `[]`, `{}`, `null` and `undefined` as identical
  // for this purpose
  if (value === undefined || value === null || value === '') {
    return null;
  } else if (typeof value === 'object') {
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

    this.state = { diffs, hasDiffs: !isEmpty(diffs), controlsMap };
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    // Update differences if need be
    if (isEqual(this.props, newProps)) {
      return;
    }
    const diffs = this.getDiffs(newProps);
    this.setState({ diffs, hasDiffs: !isEmpty(diffs) });
  }

  getDiffs(props) {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = props.origFormData;
    const cfd = props.currentFormData;

    const fdKeys = Object.keys(cfd);
    const diffs = {};
    for (const fdKey of fdKeys) {
      // Ignore values that are undefined/nonexisting in either
      if (!ofd[fdKey] && !cfd[fdKey]) {
        continue;
      }
      // Ignore obsolete legacy filters
      if (['filters', 'having', 'having_filters', 'where'].includes(fdKey)) {
        continue;
      }
      if (!this.isEqualish(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    }
    return diffs;
  }

  isEqualish(val1, val2) {
    return isEqual(alterForComparison(val1), alterForComparison(val2));
  }

  formatValue(value, key) {
    // Format display value based on the control type
    // or the value type
    if (value === undefined) {
      return 'N/A';
    } else if (value === null) {
      return 'null';
    } else if (
      this.state.controlsMap[key] &&
      this.state.controlsMap[key].type === 'AdhocFilterControl'
    ) {
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
    } else if (
      this.state.controlsMap[key] &&
      this.state.controlsMap[key].type === 'BoundsControl'
    ) {
      return `Min: ${value[0]}, Max: ${value[1]}`;
    } else if (
      this.state.controlsMap[key] &&
      this.state.controlsMap[key].type === 'CollectionControl'
    ) {
      return value.map(v => safeStringify(v)).join(', ');
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    } else if (value.constructor === Array) {
      return value.length ? value.join(', ') : '[]';
    } else if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return safeStringify(value);
  }

  renderRows() {
    const diffs = this.state.diffs;
    const rows = [];
    for (const key in diffs) {
      rows.push(
        <Tr key={key}>
          <Td
            column="control"
            data={
              (this.state.controlsMap[key] &&
                this.state.controlsMap[key].label) ||
              key
            }
          />
          <Td column="before">{this.formatValue(diffs[key].before, key)}</Td>
          <Td column="after">{this.formatValue(diffs[key].after, key)}</Td>
        </Tr>,
      );
    }
    return rows;
  }

  renderModalBody() {
    return (
      <Table className="table" sortable>
        <Thead>
          <Th column="control">Control</Th>
          <Th column="before">Before</Th>
          <Th column="after">After</Th>
        </Thead>
        {this.renderRows()}
      </Table>
    );
  }

  renderTriggerNode() {
    return (
      <TooltipWrapper label="difference" tooltip={t('Click to see difference')}>
        <span
          className="label label-warning m-l-5"
          style={{ fontSize: '12px' }}
        >
          {t('Altered')}
        </span>
      </TooltipWrapper>
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
        animation
        triggerNode={this.renderTriggerNode()}
        modalTitle={t('Chart changes')}
        bsSize="large"
        modalBody={this.renderModalBody()}
      />
    );
  }
}

AlteredSliceTag.propTypes = propTypes;
