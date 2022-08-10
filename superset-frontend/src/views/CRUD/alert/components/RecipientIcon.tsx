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
import { SupersetTheme, css } from '@superset-ui/core';
import React, { ReactElement } from 'react';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { RecipientIconName } from '../types';

const StyledIcon = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light1};
  margin-right: ${theme.gridUnit * 2}px;
`;

export default function RecipientIcon({ type }: { type: string }) {
  const recipientIconConfig: { icon: null | ReactElement; label: string } = {
    icon: null,
    label: '',
  };
  switch (type) {
    case RecipientIconName.Email:
      recipientIconConfig.icon = <Icons.Email css={StyledIcon} />;
      recipientIconConfig.label = RecipientIconName.Email;
      break;
    case RecipientIconName.Slack:
      recipientIconConfig.icon = <Icons.Slack css={StyledIcon} />;
      recipientIconConfig.label = RecipientIconName.Slack;
      break;
    default:
      recipientIconConfig.icon = null;
      recipientIconConfig.label = '';
  }
  return recipientIconConfig.icon ? (
    <Tooltip title={recipientIconConfig.label} placement="bottom">
      {recipientIconConfig.icon}
    </Tooltip>
  ) : null;
}
