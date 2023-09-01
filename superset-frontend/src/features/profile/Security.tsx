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
import Badge from 'src/components/Badge';
import { t } from '@superset-ui/core';

import Label from 'src/components/Label';
import { BootstrapUser } from 'src/types/bootstrapTypes';

interface SecurityProps {
  user: BootstrapUser;
}

export default function Security({ user }: SecurityProps) {
  return (
    <div>
      <div className="roles">
        <h4>
          {t('Roles')}{' '}
          <Badge count={Object.keys(user?.roles || {}).length} showZero />
        </h4>
        {Object.keys(user?.roles || {}).map(role => (
          <Label key={role}>{role}</Label>
        ))}
        <hr />
      </div>
      <div className="databases">
        {user?.permissions.database_access && (
          <div>
            <h4>
              {t('Databases')}{' '}
              <Badge count={user.permissions.database_access.length} showZero />
            </h4>
            {user.permissions.database_access.map(role => (
              <Label key={role}>{role}</Label>
            ))}
            <hr />
          </div>
        )}
      </div>
      <div className="datasources">
        {user?.permissions.datasource_access && (
          <div>
            <h4>
              {t('Datasets')}{' '}
              <Badge
                count={user.permissions.datasource_access.length}
                showZero
              />
            </h4>
            {user.permissions.datasource_access.map(role => (
              <Label key={role}>{role}</Label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
