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
import styled from '@superset-ui/style';
import { getCategoricalSchemeRegistry } from '@superset-ui/color';
import Avatar, { ConfigProvider } from 'react-avatar';
import TooltipWrapper from 'src/components/TooltipWrapper';

interface Props {
  firstName: string;
  lastName: string;
  tableName: string;
  userName: string;
  iconSize: number;
  textSize: number;
}

const colorList = getCategoricalSchemeRegistry().get();

const StyledAvatar = styled(Avatar)`
  margin: 0px 5px;
`;

export default function AvatarIcon({
  tableName,
  firstName,
  lastName,
  userName,
  iconSize,
  textSize,
}: Props) {
  const uniqueKey = `${tableName}-${userName}`;
  const fullName = `${firstName} ${lastName}`;

  return (
    <TooltipWrapper
      placement="bottom"
      label={`${uniqueKey}-tooltip`}
      tooltip={fullName}
    >
      <ConfigProvider colors={colorList && colorList.colors}>
        <StyledAvatar
          key={uniqueKey}
          name={fullName}
          size={String(iconSize)}
          textSizeRatio={iconSize / textSize}
          round
        />
      </ConfigProvider>
    </TooltipWrapper>
  );
}
