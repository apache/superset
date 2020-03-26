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
import PropTypes from 'prop-types';
import Gravatar from 'react-gravatar';
import moment from 'moment';
import { Panel } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

const propTypes = {
  user: PropTypes.object.isRequired,
};
const UserInfo = ({ user }) => (
  <div>
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
    <Panel>
      <Panel.Body>
        <h3>
          <strong>
            {user.firstName} {user.lastName}
          </strong>
        </h3>
        <h4 className="username">
          <i className="fa fa-user-o" /> {user.username}
        </h4>
        <hr />
        <p>
          <i className="fa fa-clock-o" /> {t('joined')}{' '}
          {moment(user.createdOn, 'YYYYMMDD').fromNow()}
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
      </Panel.Body>
    </Panel>
  </div>
);
UserInfo.propTypes = propTypes;
export default UserInfo;
