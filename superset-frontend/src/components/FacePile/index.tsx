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
import {
  getCategoricalSchemeRegistry,
  styled,
  SupersetTheme,
} from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { Avatar } from 'src/components';
import { getRandomColor } from './utils';

interface FacePileProps {
  users: { first_name: string; last_name: string; id: number }[];
  maxCount?: number;
}

const colorList = getCategoricalSchemeRegistry().get()?.colors ?? [];

const customAvatarStyler = (theme: SupersetTheme) => `
  width: ${theme.gridUnit * 6}px;
  height: ${theme.gridUnit * 6}px;
  line-height: ${theme.gridUnit * 6}px;
  font-size: ${theme.typography.sizes.m}px;
`;

const StyledAvatar = styled(Avatar)`
  ${({ theme }) => customAvatarStyler(theme)}
`;

// to apply styling to the maxCount avatar
const StyledGroup = styled(Avatar.Group)`
  .ant-avatar {
    ${({ theme }) => customAvatarStyler(theme)}
  }
`;

export default function FacePile({ users, maxCount = 4 }: FacePileProps) {
  return (
    <StyledGroup maxCount={maxCount}>
      {users.map(({ first_name, last_name, id }) => {
        const name = `${first_name} ${last_name}`;
        const uniqueKey = `${id}-${first_name}-${last_name}`;
        const color = getRandomColor(uniqueKey, colorList);
        return (
          <Tooltip key={name} title={name} placement="top">
            <StyledAvatar
              key={name}
              style={{
                backgroundColor: color,
                borderColor: color,
              }}
            >
              {first_name?.[0]?.toLocaleUpperCase()}
              {last_name?.[0]?.toLocaleUpperCase()}
            </StyledAvatar>
          </Tooltip>
        );
      })}
    </StyledGroup>
  );
}
