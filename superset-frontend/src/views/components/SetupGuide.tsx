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
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  css,
  styled,
  SupersetClient,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import findPermission, { isUserAdmin } from 'src/dashboard/util/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import Icons from 'src/components/Icons';
import rison from 'rison';

const StyledIcon = (theme: SupersetTheme) => css`
  min-width: ${theme.gridUnit * 5}px;
  color: ${theme.colors.grayscale.base};
`;

export default function SetupGuide() {
  const [completedDatabase, setCompletedDatabase] = useState<boolean>(false);
  const [completedChart, setCompletedChart] = useState<boolean>(false);
  const [completedDashboard, setCompletedDashboard] = useState<boolean>(false);

  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const isAdmin = isUserAdmin(user);
  const { roles } = user;
  const canDashboard = findPermission('can_write', 'Dashboard', roles);
  const canChart = findPermission('can_write', 'Chart', roles);
  const canDatabase = findPermission('can_write', 'Database', roles);

  const hasCreatedDatabase = () => {
    const payload = {
      filters: [{ col: 'database_name', opr: 'neq', value: 'examples' }],
    };
    SupersetClient.get({
      endpoint: `/api/v1/database/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      setCompletedDatabase(json.count >= 1);
    });
  };

  const hasCreatedChart = () => {
    const payload = {
      filters: [{ col: 'created_by', opr: 'rel_m_m', value: `${user.userId}` }],
    };
    SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      setCompletedChart(json.count >= 1);
    });
  };

  const hasCreatedDashboard = () => {
    const payload = {
      filters: [{ col: 'created_by', opr: 'rel_m_m', value: `${user.userId}` }],
    };
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      setCompletedDashboard(json.count >= 1);
    });
  };

  useEffect(() => {
    if (canDatabase) {
      hasCreatedDatabase();
    }
    if (canChart) {
      hasCreatedChart();
    }
    if (canDashboard) {
      hasCreatedDashboard();
    }
  }, [canDatabase, canChart, canDashboard]);

  const steps = [
    { name: t('Create your workspace'), completed: true, show: isAdmin },
    {
      name: t('Create your data'),
      completed: completedDatabase,
      show: canDatabase,
    },
    {
      name: t('Create a chart'),
      completed: completedChart,
      show: canChart,
    },
    {
      name: t('Create a dashboard'),
      completed: completedDashboard,
      show: canDashboard,
    },
    { name: t('Invite teammates'), completed: true, show: isAdmin },
  ];
  return (
    <div>
      {steps.map(task => (
        <div>
          {task.name}{' '}
          {task.completed ? (
            <Icons.CircleCheckSolid css={theme => StyledIcon(theme)} />
          ) : (
            <Icons.CircleCheck css={theme => StyledIcon(theme)} />
          )}
        </div>
      ))}
    </div>
  );
}
