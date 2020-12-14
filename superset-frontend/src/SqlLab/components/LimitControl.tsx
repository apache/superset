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
import { FormGroup, FormControl, FormControlProps } from 'react-bootstrap';
import { t, styled } from '@superset-ui/core';

import Popover from 'src/common/components/Popover';
import Button from 'src/components/Button';
import Label from 'src/components/Label';
import ControlHeader from '../../explore/components/ControlHeader';

export interface LimitControlProps {
  value?: number;
  defaultQueryLimit: number;
  maxRow: number;
  onChange: (value: number) => void;
}

interface LimitControlState {
  textValue: string;
  showOverlay: boolean;
}

const StyledPopoverContent = styled.div`
  width: 150px;
`;

export default class LimitControl extends React.PureComponent<
  LimitControlProps,
  LimitControlState
> {
  constructor(props: LimitControlProps) {
    super(props);
    const { value, defaultQueryLimit } = props;
    this.state = {
      textValue: (value || defaultQueryLimit).toString(),
      showOverlay: false,
    };
    this.handleVisibleChange = this.handleVisibleChange.bind(this);
    this.handleToggle = this.handleToggle.bind(this);
    this.submitAndClose = this.submitAndClose.bind(this);
  }

  setValueAndClose(val: string) {
    this.setState({ textValue: val }, this.submitAndClose);
  }

  submitAndClose() {
    const value =
      parseInt(this.state.textValue, 10) || this.props.defaultQueryLimit;
    this.props.onChange(value);
    this.setState({ showOverlay: false });
  }

  isValidLimit(limit: string) {
    const value = parseInt(limit, 10);
    return !(
      Number.isNaN(value) ||
      value <= 0 ||
      (this.props.maxRow && value > this.props.maxRow)
    );
  }

  handleToggle() {
    this.setState(prevState => ({ showOverlay: !prevState.showOverlay }));
  }

  handleVisibleChange(visible: boolean) {
    this.setState({ showOverlay: visible });
  }

  renderPopover() {
    const { textValue } = this.state;
    const isValid = this.isValidLimit(textValue);
    const errorMsg =
      t('Row limit must be positive integer') +
      (this.props.maxRow
        ? t(' and not greater than %s', this.props.maxRow)
        : '');
    return (
      <StyledPopoverContent id="sqllab-limit-results">
        <ControlHeader
          label={t('Row limit')}
          validationErrors={!isValid ? [errorMsg] : []}
        />
        <FormGroup>
          <FormControl
            type="text"
            value={textValue}
            placeholder={t(`Max: ${this.props.maxRow}`)}
            bsSize="small"
            onChange={(
              event: React.FormEvent<FormControl & FormControlProps>,
            ) =>
              this.setState({
                textValue: (event.currentTarget?.value as string) ?? '',
              })
            }
          />
        </FormGroup>
        <div className="clearfix">
          <Button
            buttonSize="small"
            buttonStyle="primary"
            className="float-right"
            data-test="limit-control-confirm"
            disabled={!isValid}
            onClick={this.submitAndClose}
          >
            {t('Ok')}
          </Button>
          <Button
            buttonSize="small"
            className="float-right m-r-3"
            data-test="limit-control-cancel"
            onClick={this.setValueAndClose.bind(
              this,
              this.props.defaultQueryLimit.toString(),
            )}
          >
            {t('Cancel')}
          </Button>
        </div>
      </StyledPopoverContent>
    );
  }

  render() {
    return (
      <div>
        <Popover
          content={this.renderPopover()}
          visible={this.state.showOverlay}
          placement="right"
          onVisibleChange={this.handleVisibleChange}
          trigger="click"
        >
          <Label onClick={this.handleToggle}>
            LIMIT {this.props.value || this.props.maxRow}
          </Label>
        </Popover>
      </div>
    );
  }
}
