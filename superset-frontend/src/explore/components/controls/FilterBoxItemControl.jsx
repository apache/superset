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
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import FormRow from '../../../components/FormRow';
import SelectControl from './SelectControl';
import CheckboxControl from './CheckboxControl';
import TextControl from './TextControl';

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  asc: PropTypes.bool,
  clearable: PropTypes.bool,
  multiple: PropTypes.bool,
  column: PropTypes.string,
  metric: PropTypes.string,
  defaultValue: PropTypes.string,
};

const defaultProps = {
  onChange: () => {},
  asc: true,
  clearable: true,
  multiple: true,
};

const STYLE_WIDTH = { width: 350 };

export default class FilterBoxItemControl extends React.Component {
  constructor(props) {
    super(props);
    const { column, metric, asc, clearable, multiple, defaultValue } = props;
    const state = { column, metric, asc, clearable, multiple, defaultValue };
    this.state = state;
    this.onChange = this.onChange.bind(this);
    this.onControlChange = this.onControlChange.bind(this);
  }
  onChange() {
    this.props.onChange(this.state);
  }
  onControlChange(attr, value) {
    this.setState({ [attr]: value }, this.onChange);
  }
  setType() {}
  textSummary() {
    return this.state.column || 'N/A';
  }
  renderForm() {
    return (
      <div>
        <FormRow
          label={t('Column')}
          control={
            <SelectControl
              value={this.state.column}
              name="column"
              clearable={false}
              options={this.props.datasource.columns
                .filter(col => col !== this.state.column)
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
        />
        <FormRow
          label={t('Label')}
          control={
            <TextControl
              value={this.state.label}
              name="label"
              onChange={v => this.onControlChange('label', v)}
            />
          }
        />
        <FormRow
          label={t('Default')}
          tooltip={t(
            '(optional) default value for the filter, when using ' +
              'the multiple option, you can use a semicolon-delimited list ' +
              'of options.',
          )}
          control={
            <TextControl
              value={this.state.defaultValue}
              name="defaultValue"
              onChange={v => this.onControlChange('defaultValue', v)}
            />
          }
        />
        <FormRow
          label={t('Sort Metric')}
          tooltip={t('Metric to sort the results by')}
          control={
            <SelectControl
              value={this.state.metric}
              name="column"
              options={this.props.datasource.metrics
                .filter(metric => metric !== this.state.metric)
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
          label={t('Sort Ascending')}
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
          label={t('Allow Multiple Selections')}
          isCheckbox
          tooltip={t(
            'Multiple selections allowed, otherwise filter ' +
              'is limited to a single value',
          )}
          control={
            <CheckboxControl
              value={this.state.multiple}
              onChange={v => this.onControlChange('multiple', v)}
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
        />
      </div>
    );
  }
  renderPopover() {
    return (
      <Popover id="ts-col-popo" title={t('Filter Configuration')}>
        <div style={STYLE_WIDTH}>{this.renderForm()}</div>
      </Popover>
    );
  }
  render() {
    return (
      <span>
        {this.textSummary()}{' '}
        <OverlayTrigger
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            label="edit-ts-column"
          />
        </OverlayTrigger>
      </span>
    );
  }
}

FilterBoxItemControl.propTypes = propTypes;
FilterBoxItemControl.defaultProps = defaultProps;
