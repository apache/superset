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
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import Popover from 'src/components/Popover';
// import FormRow from 'src/components/FormRow';
import { Select } from 'src/components';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
// import FilterControl from 'src/explore/components/controls/FilterControl';
import { FILTER_CONFIG_ATTRIBUTES } from 'src/explore/constants';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import { AddControlLabel } from '../OptionControls';


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
 import { Row, Col } from 'src/common/components';
 
 
 const STYLE_ROW = { marginTop: '5px', minHeight: '30px' };
 const STYLE_RALIGN = { textAlign: 'right' };

 
 export function FormRow({ label, tooltip, control, isCheckbox }) {
   const labelAndTooltip = (
     <span>
       {label}{' '}
       {tooltip && (
         <InfoTooltipWithTrigger
           placement="top"
           label={label}
           tooltip={tooltip}
         />
       )}
     </span>
   );
  //  if (isCheckbox) {
  //    return (
  //      <Row style={STYLE_ROW} gutter={16}>
  //        <Col xs={24} md={8} style={STYLE_RALIGN}>
  //          {control}
  //        </Col>
  //        <Col xs={24} md={16}>
  //          {labelAndTooltip}
  //        </Col>
  //      </Row>
  //    );
  //  }
   return (
     <Row style={STYLE_ROW} gutter={16}>
       {/* <Col xs={24} md={8} style={STYLE_RALIGN}>
         {labelAndTooltip}
       </Col> */}
       <Col xs={24} md={16}>
         {control}
       </Col>
     </Row>
   );
 }
 FormRow.propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  control: PropTypes.node.isRequired,
  isCheckbox: PropTypes.bool,
};
 FormRow.defaultProps = {
  tooltip: null,
  isCheckbox: false,
};;
 

const INTEGRAL_TYPES = new Set([
  'TINYINT',
  'SMALLINT',
  'INT',
  'INTEGER',
  'BIGINT',
  'LONG',
]);
const DECIMAL_TYPES = new Set([
  'FLOAT',
  'DOUBLE',
  'REAL',
  'NUMERIC',
  'DECIMAL',
  'MONEY',
]);

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  asc: PropTypes.bool,
  clearable: PropTypes.bool,
  multiple: PropTypes.bool,
  column: PropTypes.string,
  label: PropTypes.string,
  metric: PropTypes.string,
  searchAllOptions: PropTypes.bool,
  defaultValue: PropTypes.string,
};

const defaultProps = {
  onChange: () => {},
  asc: true,
  clearable: true,
  multiple: true,
  searchAllOptions: false,
};

const STYLE_WIDTH = { width: 350 };

export default class ScoreCardGroupControl extends React.Component {
  constructor(props) {
    super(props);
    const {
      column,
      metric,
      asc,
      clearable,
      multiple,
      searchAllOptions,
      label,
      defaultValue,
      controlLabel,
      controlValue,
      ...otherProps
    } = props;
    const filters = null; 
    console.log(props, 'ScoreCardGroupControl');
    // const {datasource, form_data} = props;

    // const columns = datasource?.columns.filter(c => c.filterable) || [];
    // const savedMetrics = datasource?.metrics || [];
    // // current active adhoc metrics
    // const selectedMetrics = form_data.metrics || (form_data.metric ? [form_data.metric] : []);
    
    this.state = {
      column,
      metric,
      asc,
      clearable,
      multiple,
      searchAllOptions,
      label,
      defaultValue,
      controlLabel,
      controlValue,
      filters
    };
    this.onChange = this.onChange.bind(this);
    // this.onControlChange = this.onControlChange.bind(this);
  }

  onChange() {
    this.props.onChange(this.state);
  }

  // onControlChange(attr, value) {
  //   let typedValue = value;
  //   const { column: selectedColumnName, multiple } = this.state;
  //   if (value && !multiple && attr === FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE) {
  //     // if single value filter_box,
  //     // convert input value string to the column's data type
  //     const { datasource } = this.props;
  //     const selectedColumn = datasource.columns.find(
  //       col => col.column_name === selectedColumnName,
  //     );

  //     if (selectedColumn && selectedColumn.type) {
  //       const type = selectedColumn.type.toUpperCase();
  //       if (type === 'BOOLEAN') {
  //         typedValue = value === 'true';
  //       } else if (INTEGRAL_TYPES.has(type)) {
  //         typedValue = Number.isNaN(Number(value)) ? null : parseInt(value, 10);
  //       } else if (DECIMAL_TYPES.has(type)) {
  //         typedValue = Number.isNaN(Number(value)) ? null : parseFloat(value);
  //       }
  //     }
  //   }
  //   this.setState({ [attr]: typedValue }, this.onChange);
  // }

  setType() {}

  textSummary() {
    return this.state.label || 'N/A';
  }

  renderForm() {
    return (
      <div>
        <FormRow
          // label={t('Label')}
          control={
            <TextControl
              label = 'group label'
              value={this.state.label}
              name="label"
              onChange={v => this.onControlChange('label', v)}
            />
          }
        />
        {/* <FormRow
          label={t('Column')}
          control={
            <Select
              ariaLabel={t('Column')}
              value={this.state.column}
              name="column"
              options={this.props.datasource.columns
                .filter(col => col.column_name !== this.state.column)
                .map(col => ({
                  value: col.column_name,
                  label: col.column_name,
                }))
                .concat([
                  { value: this.state.column, label: this.state.column },
                ])}
              onChange={v => this.onControlChange('column', v)}
            />
          }
        /> */}

        <FormRow


          control={
            <AdhocFilterControl {...this.props} label={t('group_'+this.ith)} type='AdhocFilterControl' value={this.state.controlValue} onChange={this.onChange}
              // value={this.state.defaultValue}
              // name="defaultValue"+
              // // onChange={v =>
              // //   this.onControlChange(FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE, v)
              // // }
              // onChange = { this.onChange }
            />
          }
        />


        {/* <FormRow
          label={t('Sort metric')}
          tooltip={t('Metric to sort the results by')}
          control={
            <Select
              ariaLabel={t('Sort metric')}
              value={this.state.metric}
              name="column"
              options={this.props.datasource.metrics
                .filter(m => m.metric_name !== this.state.metric)
                .map(m => ({
                  value: m.metric_name,
                  label: m.metric_name,
                }))
                .concat([
                  { value: this.state.metric, label: this.state.metric },
                ])}
              onChange={v => this.onControlChange('metric', v)}
            />
          }
        />
        <FormRow
          label={t('Sort ascending')}
          tooltip={t('Check for sorting ascending')}
          isCheckbox
          control={
            <CheckboxControl
              value={this.state.asc}
              onChange={v => this.onControlChange('asc', v)}
            />
          }
        />
        <FormRow
          label={t('Allow multiple selections')}
          isCheckbox
          tooltip={t(
            'Multiple selections allowed, otherwise filter ' +
              'is limited to a single value',
          )}
          control={
            <CheckboxControl
              value={this.state.multiple}
              onChange={v =>
                this.onControlChange(FILTER_CONFIG_ATTRIBUTES.MULTIPLE, v)
              }
            />
          }
        />
        <FormRow
          label={t('Search all filter options')}
          tooltip={t(
            'By default, each filter loads at most 1000 choices at the initial page load. ' +
              'Check this box if you have more than 1000 filter values and want to enable dynamically ' +
              'searching that loads filter values as users type (may add stress to your database).',
          )}
          isCheckbox
          control={
            <CheckboxControl
              value={this.state.searchAllOptions}
              onChange={v =>
                this.onControlChange(
                  FILTER_CONFIG_ATTRIBUTES.SEARCH_ALL_OPTIONS,
                  v,
                )
              }
            />
          }
        />
        <FormRow
          label={t('Required')}
          tooltip={t('User must select a value for this filter')}
          isCheckbox
          control={
            <CheckboxControl
              value={!this.state.clearable}
              onChange={v => this.onControlChange('clearable', !v)}
            />
          }
        /> */}
      </div>
    );
  }

  renderPopover() {
    return (
      <div id="ts-col-popo" style={STYLE_WIDTH}>
        {this.renderForm()}
      </div>
    );
  }

  render() {
    return (
      <span data-test="FilterBoxItemControl">
        {/* <Popover
          trigger="click"
          placement="right"
          content={this.renderPopover()}
          title={t('Filter configuration')}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            label="edit-ts-column"
          />
        </Popover>
        {' '}{this.textSummary()} */}
        <AdhocFilterControl 
        {...this.props} 
        label={'group_' + this.props.ith} 
        type='AdhocFilterControl' 
        value={this.state.filters} />
      </span>
    );
  }
}

ScoreCardGroupControl.propTypes = propTypes;
ScoreCardGroupControl.defaultProps = defaultProps;
