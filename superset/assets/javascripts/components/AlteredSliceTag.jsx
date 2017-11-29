import React from 'react';
import PropTypes from 'prop-types';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import { isEqual, isEmpty } from 'underscore';

import TooltipWrapper from './TooltipWrapper';
import { controls } from '../explore/stores/controls';
import ModalTrigger from './ModalTrigger';
import { t } from '../locales';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
};

export default class AlteredSliceTag extends React.Component {

  constructor(props) {
    super(props);
    const diffs = this.getDiffs(props);
    this.state = { diffs, hasDiffs: !isEmpty(diffs) };
  }

  componentWillReceiveProps(newProps) {
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
      if (!isEqual(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = { before: ofd[fdKey], after: cfd[fdKey] };
      }
    }
    return diffs;
  }

  formatValue(value, key) {
    // Format display value based on the control type
    // or the value type
    if (value === undefined) {
      return 'N/A';
    } else if (value === null) {
      return 'null';
    } else if (controls[key] && controls[key].type === 'FilterControl') {
      if (!value.length) {
        return '[]';
      }
      return value.map((v) => {
        const filterVal = v.val.constructor === Array ? `[${v.val.join(', ')}]` : v.val;
        return `${v.col} ${v.op} ${filterVal}`;
      }).join(', ');
    } else if (controls[key] && controls[key].type === 'BoundsControl') {
      return `Min: ${value[0]}, Max: ${value[1]}`;
    } else if (controls[key] && controls[key].type === 'CollectionControl') {
      return value.map(v => JSON.stringify(v)).join(', ');
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    } else if (value.constructor === Array) {
      return value.length ? value.join(', ') : '[]';
    } else if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return JSON.stringify(value);
  }

  renderRows() {
    const diffs = this.state.diffs;
    const rows = [];
    for (const key in diffs) {
      rows.push(
        <Tr key={key}>
          <Td column="control" data={(controls[key] && controls[key].label) || key} />
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
      <TooltipWrapper
        label="difference"
        tooltip={t('Click to see difference')}
      >
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
        modalTitle={t('Slice changes')}
        bsSize="large"
        modalBody={this.renderModalBody()}
      />
    );
  }
}

AlteredSliceTag.propTypes = propTypes;
