import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectControl from './SelectControl';
import { t } from '../../../locales';

const operatorsArr = [
  { val: 'in', type: 'array', useSelect: true, multi: true },
  { val: 'not in', type: 'array', useSelect: true, multi: true },
  { val: '==', type: 'string', useSelect: true, multi: false, havingOnly: true },
  { val: '!=', type: 'string', useSelect: true, multi: false, havingOnly: true },
  { val: '>=', type: 'string', havingOnly: true },
  { val: '<=', type: 'string', havingOnly: true },
  { val: '>', type: 'string', havingOnly: true },
  { val: '<', type: 'string', havingOnly: true },
  { val: 'regex', type: 'string', datasourceTypes: ['druid'] },
  { val: 'LIKE', type: 'string', datasourceTypes: ['table'] },
];
const operators = {};
operatorsArr.forEach((op) => {
  operators[op.val] = op;
});

const propTypes = {
  changeStyleMapping: PropTypes.func,
  removeStyleMapping: PropTypes.func,
  style: PropTypes.object.isRequired,
  datasource: PropTypes.object,
  having: PropTypes.bool,
  valuesLoading: PropTypes.bool,
  valueChoices: PropTypes.array,
};

const defaultProps = {
  changeStyleMapping: () => {},
  removeStyleMapping: () => {},
  datasource: null,
  having: false,
  valuesLoading: false,
  valueChoices: [],
};

export default class StyleMapping extends React.Component {

  switchStyleMappingValue(prevOp, nextOp) {
    if (operators[prevOp].type !== operators[nextOp].type) {
      // Switch from array to string or vice versa
      const val = this.props.style.val;
      let newVal;
      if (operators[nextOp].type === 'string') {
        if (!val || !val.length) {
          newVal = '';
        } else {
          newVal = val[0];
        }
      } else if (operators[nextOp].type === 'array') {
        if (!val || !val.length) {
          newVal = [];
        } else {
          newVal = [val];
        }
      }
      this.props.changeStyleMapping(['val', 'op'], [newVal, nextOp]);
    } else {
      // No value type change
      this.props.changeStyleMapping('op', nextOp);
    }
  }

  changeText(event) {
    this.props.changeStyleMapping('val', event.target.value);
  }

  changeSelect(value) {
    this.props.changeStyleMapping('val', value);
  }

  changeColumn(event) {
    this.props.changeStyleMapping('col', event.value);
  }

  changeOp(event) {
    this.switchStyleMappingValue(this.props.style.op, event.value);
  }

  removeStyleMapping(style) {
    this.props.removeStyleMapping(style);
  }

  renderStyleMappingFormControl(style) {
    const operator = operators[style.op];
    if (operator.useSelect && !this.props.having) {
      // TODO should use a simple Select, not a control here...
      return (
        <SelectControl
          multi={operator.multi}
          freeForm
          name="style-value"
          value={style.val}
          isLoading={this.props.valuesLoading}
          choices={this.props.valueChoices}
          onChange={this.changeSelect.bind(this)}
          showHeader={false}
        />
      );
    }
    return (
      <input
        type="text"
        onChange={this.changeText.bind(this)}
        value={style.val || ''}
        className="form-control input-sm"
        placeholder={t('Style value')}
      />
    );
  }
  render() {
    const datasource = this.props.datasource;
    const style = this.props.style;
    const opsChoices = operatorsArr
    .filter((o) => {
      if (this.props.having) {
        return !!o.havingOnly;
      }
      return (!o.datasourceTypes || o.datasourceTypes.indexOf(datasource.type) >= 0);
    })
    .map(o => ({ value: o.val, label: o.val }));
    let colChoices;
    if (datasource) {
      if (this.props.having) {
        colChoices = datasource.metrics_combo.map(c => ({ value: c[0], label: c[1] }));
      } else {
        colChoices = datasource.filterable_cols.map(c => ({ value: c[0], label: c[1] }));
      }
    }
    return (
      <div>
        <Row className="space-1">
          <Col md={12}>
            <Select
              id="select-col"
              placeholder={this.props.having ? t('Select metric') : t('Select column')}
              clearable={false}
              options={colChoices}
              value={style.col}
              onChange={this.changeColumn.bind(this)}
            />
          </Col>
        </Row>
        <Row className="space-1">
          <Col md={3}>
            <Select
              id="select-op"
              placeholder={t('Select operator')}
              options={opsChoices}
              clearable={false}
              value={style.op}
              onChange={this.changeOp.bind(this)}
            />
          </Col>
          <Col md={7}>
            {this.renderStyleMappingFormControl(style)}
          </Col>
          <Col md={2}>
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeStyleMapping.bind(this)}
            >
              <i className="fa fa-minus" />
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

StyleMapping.propTypes = propTypes;
StyleMapping.defaultProps = defaultProps;
