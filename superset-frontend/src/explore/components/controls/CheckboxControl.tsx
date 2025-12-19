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
import { Component, type ReactNode } from 'react';
import { styled, css } from '@apache-superset/core/ui';
import { Checkbox } from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

interface CheckboxControlProps {
  value?: boolean;
  label?: ReactNode;
  name?: string;
  description?: ReactNode;
  hovered?: boolean;
  onChange?: (value: boolean) => void;
}

const CheckBoxControlWrapper = styled.div`
  ${({ theme }) => css`
    .ControlHeader label {
      color: ${theme.colorText};
    }
    span:has(label) {
      padding-right: ${theme.sizeUnit * 2}px;
    }
    .ant-checkbox-wrapper {
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

export default class CheckboxControl extends Component<CheckboxControlProps> {
  static defaultProps = {
    value: false,
    onChange: () => {},
  };

  onChange = (): void => {
    this.props.onChange?.(!this.props.value);
  };

  renderCheckbox(): ReactNode {
    return <Checkbox onChange={this.onChange} checked={!!this.props.value} />;
  }

  render(): ReactNode {
    if (this.props.label) {
      return (
        <CheckBoxControlWrapper>
          <ControlHeader
            {...this.props}
            leftNode={this.renderCheckbox()}
            onClick={this.onChange}
          />
        </CheckBoxControlWrapper>
      );
    }
    return this.renderCheckbox();
  }
}
