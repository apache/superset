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
import { t, styled, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { DropdownButton } from 'src/components/DropdownButton';
import Button from 'src/components/Button';
import { DropdownButtonProps } from 'antd/lib/dropdown';

interface Props {
  toggleSave: () => void;
  overlayMenu: JSX.Element | null;
}

export default function SaveDatasetActionButton({
  toggleSave,
  overlayMenu,
}: Props) {
  const theme = useTheme();

  const ButtonComponentStyles = styled(
    DropdownButton as React.FC<DropdownButtonProps>,
  )`
    button.ant-btn.ant-btn-default {
      &:first-of-type {
        width: ${theme.gridUnit * 16}px;
      }
      background-color: ${theme.colors.primary.light4};
      color: ${theme.colors.primary.dark1};
      &:nth-child(2) {
        &:before,
        &:hover:before {
          border-left: 1px solid ${theme.colors.primary.dark2};
        }
      }
    }
    span[name='caret-down'] {
      margin-left: ${theme.gridUnit * 1}px;
      color: ${theme.colors.primary.dark2};
    }
  `;

  return overlayMenu ? (
    <ButtonComponentStyles
      onClick={toggleSave}
      overlay={overlayMenu}
      icon={
        <Icons.CaretDown
          iconColor={theme.colors.grayscale.light5}
          name="caret-down"
        />
      }
      trigger={['click']}
    >
      {t('Save')}
    </ButtonComponentStyles>
  ) : (
    <Button
      onClick={toggleSave}
      buttonStyle="primary"
      css={{ width: theme.gridUnit * 25 }}
    >
      {t('Save')}
    </Button>
  );
}
