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
import { PureComponent } from 'react';
import cx from 'classnames';
import { css, styled, t } from '@superset-ui/core';

import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import PopoverDropdown, {
  OptionProps,
  OnChangeHandler,
} from 'src/components/PopoverDropdown';

interface BackgroundStyleDropdownProps {
  id: string;
  value: string;
  onChange: OnChangeHandler;
}

const BackgroundStyleOption = styled.div`
  ${({ theme }) => css`
    display: inline-block;

    &:before {
      content: '';
      width: 1em;
      height: 1em;
      margin-right: ${theme.gridUnit * 2}px;
      display: inline-block;
      vertical-align: middle;
    }

    &.background--white {
      padding-left: 0;
      background: transparent;

      &:before {
        background: ${theme.colors.grayscale.light5};
        border: 1px solid ${theme.colors.grayscale.light2};
      }
    }

    /* Create the transparent rect icon */
    &.background--transparent:before {
      background-image: linear-gradient(
          45deg,
          ${theme.colors.text.label} 25%,
          transparent 25%
        ),
        linear-gradient(-45deg, ${theme.colors.text.label} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${theme.colors.text.label} 75%),
        linear-gradient(-45deg, transparent 75%, ${theme.colors.text.label} 75%);
      background-size: ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px;
      background-position:
        0 0,
        0 ${theme.gridUnit}px,
        ${theme.gridUnit}px ${-theme.gridUnit}px,
        ${-theme.gridUnit}px 0px;
    }
  `}
`;

function renderButton(option: OptionProps) {
  const BACKGROUND_TEXT = t('background');
  return (
    <BackgroundStyleOption
      className={cx('background-style-option', option.className)}
    >
      {`${option.label} ${BACKGROUND_TEXT}`}
    </BackgroundStyleOption>
  );
}

function renderOption(option: OptionProps) {
  return (
    <BackgroundStyleOption
      className={cx('background-style-option', option.className)}
    >
      {option.label}
    </BackgroundStyleOption>
  );
}

export default class BackgroundStyleDropdown extends PureComponent<BackgroundStyleDropdownProps> {
  render() {
    const { id, value, onChange } = this.props;
    return (
      <PopoverDropdown
        id={id}
        options={backgroundStyleOptions}
        value={value}
        onChange={onChange}
        renderButton={renderButton}
        renderOption={renderOption}
      />
    );
  }
}
