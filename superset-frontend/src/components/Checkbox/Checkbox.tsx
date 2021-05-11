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
import { styled } from '@superset-ui/core';
import { CheckboxChecked, CheckboxUnchecked } from 'src/components/Checkbox';

interface CheckboxProps {
  checked: boolean;
  onChange: (val?: boolean) => void;
  style?: React.CSSProperties;
  label?: string;
}

const Styles = styled.span`
  &,
  & svg {
    vertical-align: top;
  }

  & {
    display: inline-block;
    width: 18px;
    height: 18px;
  }

  &:focus {
    border-radius: 1px;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075),
      0 0 0 3px rgba(0, 0, 0, 0.1);
  }
`;

export const Checkbox = React.forwardRef<HTMLSpanElement, CheckboxProps>(
  ({ checked, onChange, style, label }, ref) => {
    function doChange(event: React.KeyboardEvent | React.MouseEvent) {
      event.preventDefault();
      onChange(!checked);
    }
    return (
      <Styles
        style={style}
        onClick={doChange}
        onKeyDown={event => {
          if (event.key === ' ' || event.key === 'Enter') {
            doChange(event);
          }
        }}
        role="checkbox"
        tabIndex={0}
        aria-checked={checked}
        aria-label={label}
        ref={ref}
      >
        {checked ? <CheckboxChecked /> : <CheckboxUnchecked />}
      </Styles>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export default Checkbox;
