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
import {
  Button,
  FormGroup,
  FormControl,
  Overlay,
  Popover,
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import Label from 'src/components/Label';
import ControlHeader from '../../explore/components/ControlHeader';

const propTypes = {
  value: PropTypes.number,
  defaultQueryLimit: PropTypes.number.isRequired,
  maxRow: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default class LimitControl extends React.PureComponent {
  constructor(props) {
    super(props);
    const { value, defaultQueryLimit } = props;
    this.state = {
      textValue: (value || defaultQueryLimit).toString(),
      showOverlay: false,
    };
    this.handleHide = this.handleHide.bind(this);
    this.handleToggle = this.handleToggle.bind(this);
    this.submitAndClose = this.submitAndClose.bind(this);
  }

  setValueAndClose(val) {
    this.setState({ textValue: val }, this.submitAndClose);
  }

  submitAndClose() {
    const value =
      parseInt(this.state.textValue, 10) || this.props.defaultQueryLimit;
    this.props.onChange(value);
    this.setState({ showOverlay: false });
  }

  isValidLimit(limit) {
    const value = parseInt(limit, 10);
    return !(
      Number.isNaN(value) ||
      value <= 0 ||
      (this.props.maxRow && value > this.props.maxRow)
    );
  }

  handleToggle() {
    this.setState({ showOverlay: !this.state.showOverlay });
  }

  handleHide() {
    this.setState({ showOverlay: false });
  }

  renderPopover() {
    const textValue = this.state.textValue;
    const isValid = this.isValidLimit(textValue);
    const errorMsg =
      t('Row limit must be positive integer') +
      (this.props.maxRow
        ? t(' and not greater than %s', this.props.maxRow)
        : '');
    return (
      <Popover id="sqllab-limit-results">
        <div style={{ width: '100px' }}>
          <ControlHeader
            label={t('Row limit')}
            validationErrors={!isValid ? [t(errorMsg)] : []}
          />
          <FormGroup>
            <FormControl
              type="text"
              value={textValue}
              placeholder={t(`Max: ${this.props.maxRow}`)}
              bsSize="small"
              onChange={e => this.setState({ textValue: e.target.value })}
            />
          </FormGroup>
          <div className="clearfix">
            <Button
              bsSize="small"
              bsStyle="primary"
              className="float-left ok"
              disabled={!isValid}
              onClick={this.submitAndClose}
            >
              Ok
            </Button>
            <Button
              bsSize="small"
              className="float-right reset"
              onClick={this.setValueAndClose.bind(
                this,
                this.props.defaultQueryLimit.toString(),
              )}
            >
              Reset
            </Button>
          </div>
        </div>
      </Popover>
    );
  }

  render() {
    return (
      <div>
        <Label className="pointer" onClick={this.handleToggle}>
          LIMIT {this.props.value || this.props.maxRow}
        </Label>
        <Overlay
          rootClose
          show={this.state.showOverlay}
          onHide={this.handleHide}
          trigger="click"
          placement="right"
          target={this}
        >
          {this.renderPopover()}
        </Overlay>
      </div>
    );
  }
}

LimitControl.propTypes = propTypes;
