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
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import Avatar, { ConfigProvider } from 'react-avatar';

interface Props {
  firstName: string;
  iconSize: string;
  lastName: string;
  tableName: string;
  userName: string;
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
}: Props) {
  const uniqueKey = `${tableName}-${userName}`;
  const fullName = `${firstName} ${lastName}`;

  return (
    <ConfigProvider colors={colorList && colorList.colors}>
      <OverlayTrigger
        placement="right"
        overlay={<Tooltip id={`${uniqueKey}-tooltip`}>{fullName}</Tooltip>}
      >
        <StyledAvatar key={uniqueKey} name={fullName} size={iconSize} round />
      </OverlayTrigger>
    </ConfigProvider>
  );
}
