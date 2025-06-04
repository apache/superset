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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { styled, css } from '@superset-ui/core';
import { Checkbox } from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

const propTypes = {
  value: PropTypes.bool,
  label: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: false,
  onChange: () => {},
};

const CheckBoxControlWrapper = styled.div`
  ${({ theme }) => css`
    .ControlHeader label {
      color: ${theme.colorText};
    }
    span:has(label) {
      padding-right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

export default class CheckboxControl extends Component {
  onChange() {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(!this.props.value);
  }

  renderCheckbox() {
    return (
      <Checkbox
        onChange={this.onChange.bind(this)}
        // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
        checked={!!this.props.value}
      />
    );
  }

  render() {
    // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
    if (this.props.label) {
      return (
        <CheckBoxControlWrapper>
          <ControlHeader
            {...this.props}
            leftNode={this.renderCheckbox()}
            onClick={this.onChange.bind(this)}
          />
        </CheckBoxControlWrapper>
      );
    }
    return this.renderCheckbox();
  }
}
// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
CheckboxControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
CheckboxControl.defaultProps = defaultProps;
