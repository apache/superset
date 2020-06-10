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
import React, { PureComponent } from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import Avatar, { ConfigProvider } from 'react-avatar';

interface Props {
  firstName: string;
  iconSize: string;
  lastName: string;
  tableName: string;
  userName: string;
}

export default class AvatarIcon extends PureComponent<Props> {
  render() {
    const { tableName, firstName, lastName, userName, iconSize } = this.props;
    const uniqueKey = tableName.concat('_', userName);
    const fullName = firstName.concat(' ', lastName);
    const colors = [
      '#20A7C9',
      '#59C189',
      '#A868B6',
      '#E04355',
      '#FBC700',
      '#FF7F43',
    ];
    return (
      <ConfigProvider colors={colors}>
        <OverlayTrigger
          placement="right"
          overlay={<Tooltip id={`${uniqueKey}-tooltip`}>{fullName}</Tooltip>}
        >
          <Avatar
            key={`${uniqueKey}`}
            name={fullName}
            size={iconSize}
            round
            style={{ margin: '0px 5px' }}
          />
        </OverlayTrigger>
      </ConfigProvider>
    );
  }
}
