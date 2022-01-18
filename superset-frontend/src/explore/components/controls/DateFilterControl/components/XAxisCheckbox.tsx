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
import { styled, t, css } from '@superset-ui/core';
import Checkbox from 'src/components/Checkbox';
import { Tooltip } from 'src/components/Tooltip';
import { noOp } from 'src/utils/common';

const Styles = styled.div<{ disabled: boolean | undefined }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  line-height: 1;
  svg,
  span[role='checkbox'] {
    width: ${({ theme }) => theme.gridUnit * 4}px;
    height: ${({ theme }) => theme.gridUnit * 4}px;

    path:first-child {
      ${({ disabled, theme }) =>
        disabled &&
        css`
          fill: ${theme.colors.primary.light1};
        `}
    }
  }
  .checkbox-label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    color: rgba(0, 0, 0, 0.85);
  }
`;

interface XAxisCheckboxI {
  checked: boolean;
  setChecked: (value: boolean | undefined) => void;
  disabled: boolean | undefined;
}
export const XAxisCheckbox = ({
  checked,
  setChecked,
  disabled,
}: XAxisCheckboxI) => (
  <Tooltip
    title={t(
      'In timeseries charts one time column has to be selected as X-Axis. If you want to change X-Axis, select another Time Filter.',
    )}
    placement="bottom"
  >
    <Styles
      onClick={() => !disabled && setChecked(!checked)}
      disabled={disabled}
    >
      <Checkbox checked={checked} onChange={noOp} />
      <span className="checkbox-label">{t('Use as X-Axis')}</span>
    </Styles>
  </Tooltip>
);
