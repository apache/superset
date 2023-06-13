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
import { getRandomColor } from '../FacePile/utils';

interface InitialPileProps {
  name?: string;
  email?: string
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

function extractInitials(email:string) {
  let initials = '';
  const name = email.split('@')[0];
  if (name.includes('.')) {
    let nameParts = name.split('.');
    initials = nameParts.map((part:any) => part[0].toUpperCase()).join('');
  } else {
    initials = name.slice(0, 2).toUpperCase();
  }

  return initials;
}

const InitialPile = ({name,email}: InitialPileProps)  => {
  let nameInitials = ''
  if(email){
    nameInitials = extractInitials(email)
  }
  if(name){
    const nameParts = name.split(' ');
    nameInitials = nameParts[0][0] + nameParts[1][0]
  }
  const uniqueKey = email ? `${email}` : `${name}`;
  const color = getRandomColor(uniqueKey, colorList);
    return (

      <StyledGroup>
          <Tooltip key={email || name} title={email || name} placement="top">
            <StyledAvatar
              key={email || name}
              style={{
                backgroundColor: color,
                borderColor: color,
              }}
            >
              {nameInitials.toLocaleUpperCase()}
            </StyledAvatar>
          </Tooltip>


    </StyledGroup>)

}

export default InitialPile
