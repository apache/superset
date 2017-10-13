import React from 'react';
import PropTypes from 'prop-types';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import TooltipWrapper from './TooltipWrapper';
import { controls } from '../explore/stores/controls';
import ModalTrigger from './ModalTrigger';
import { t } from '../locales';

export default class AlteredSliceTag extends React.Component {

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
    } else if (value.constructor === Object) {
      return JSON.stringify(value);
    }
    return value;
  }

  renderRows() {
    const altered = this.props.altered;
    const rows = [];
    for (const key in altered) {
      rows.push(
        <Tr key={key}>
          <Td column="control" data={(controls[key] && controls[key].label) || key} />
          <Td column="before">{this.formatValue(altered[key].before, key)}</Td>
          <Td column="after">{this.formatValue(altered[key].after, key)}</Td>
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

AlteredSliceTag.propTypes = {
  altered: PropTypes.object.isRequired,
};
