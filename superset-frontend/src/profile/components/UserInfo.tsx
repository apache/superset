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
import Gravatar from 'react-gravatar';
import moment from 'moment';
import { t, styled } from '@superset-ui/core';
import { UserWithPermissionsAndRoles } from '../../types/bootstrapTypes';

interface UserInfoProps {
  user: UserWithPermissionsAndRoles;
}

const StyledContainer = styled.div`
  .panel {
    padding: ${({ theme }) => theme.gridUnit * 6}px;
  }
`;

export default function UserInfo({ user }: UserInfoProps) {
  return (
    <StyledContainer>
      <a href="https://en.gravatar.com/">
        <Gravatar
          email={user.email}
          width="100%"
          height=""
          size={220}
          alt={t('Profile picture provided by Gravatar')}
          className="img-rounded"
          style={{ borderRadius: 15 }}
        />
      </a>
      <hr />
      <div className="panel">
        <div className="header">
          <h3>
            <strong>
              {user.firstName} {user.lastName}
            </strong>
          </h3>
          <h4 className="username">
            <i className="fa fa-user-o" /> {user.username}
          </h4>
        </div>
        <hr />
        <p>
          <i className="fa fa-clock-o" data-test="clock-icon-test" />{' '}
          {t('joined')} {moment(user.createdOn, 'YYYYMMDD').fromNow()}
        </p>
        <p className="email">
          <i className="fa fa-envelope-o" /> {user.email}
        </p>
        <p className="roles">
          <i className="fa fa-lock" /> {Object.keys(user.roles).join(', ')}
        </p>
        <p>
          <i className="fa fa-key" />
          &nbsp;
          <span className="text-muted">{t('id:')}</span>&nbsp;
          <span className="user-id">{user.userId}</span>
        </p>
      </div>
    </StyledContainer>
  );
}
