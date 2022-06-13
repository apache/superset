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
import rison from 'rison';
import {
  SupersetClient,
  SupersetTheme,
  css,
  getUiOverrideRegistry,
  t,
  useTheme,
} from '@superset-ui/core';
import findPermission from 'src/dashboard/util/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import Card from 'src/components/Card';
import Icons from 'src/components/Icons';
import ProgressBar from 'src/components/ProgressBar';
import { getUserOwnedObjects, mq } from 'src/views/CRUD/utils';

const uiOverrideRegistry = getUiOverrideRegistry();

const workspaceUrl = uiOverrideRegistry.get('setup.workspace.url');
const inviteUrl = uiOverrideRegistry.get('setup.invites.url');

const StyledIcon = () => css`
  float: right;
  margin-left: auto;
`;

export default function SetupGuide({ isTeamAdmin }: SetupGuideProps) {
  const theme = useTheme();
  const [hideTaskCard, setHideTaskCard] = useState<boolean>(false);
  const [completedDatabase, setCompletedDatabase] = useState<boolean>(false);
  const [completedChart, setCompletedChart] = useState<boolean>(false);
  const [completedDashboard, setCompletedDashboard] = useState<boolean>(false);
  const [completedInvite, setCompletedInvite] = useState<boolean>(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState<boolean>(false);

  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
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

  useEffect(() => {
    if (canDatabase) {
      hasCreatedDatabase();
    }

    if (user.userId) {
      if (canChart) {
        getUserOwnedObjects(user.userId, 'chart').then(
          (result: Record<string, any>) => {
            setCompletedChart(result.length >= 1);
          },
        );
      }
      if (canDashboard) {
        getUserOwnedObjects(user.userId, 'dashboard').then(
          (result: Record<string, any>) => {
            setCompletedDashboard(result.length >= 1);
          },
        );
      }
    }
  }, [canDatabase, canChart, canDashboard, user.userId]);

  const tasks = [
    {
      completed: true,
      name: t('Create your workspace'),
      path: workspaceUrl,
      show: isAdmin && workspaceUrl,
    },
    {
      completed: completedDatabase,
      name: t('Create your data'),
      path: '/databaseview/list/',
      show: canDatabase,
    },
    {
      completed: completedChart,
      name: t('Create a chart'),
      path: '/chart/add',
      show: canChart,
    },
    {
      completed: completedDashboard,
      name: t('Create a dashboard'),
      path: '/dashboard/new/',
      show: canDashboard,
    },
    {
      completed: completedInvite,
      name: t('Invite teammates'),
      path: inviteUrl,
      show: isAdmin && inviteUrl,
    },
  ];
  const allTasks = tasks.filter(task => task.show);
  const percentCompleted = (
    (tasks.filter(task => task.completed && task.show).length * 100) /
    allTasks.length
  ).toFixed(0);

  const openTaskUrl = (path: string) => {
    window.open(path);
  };

  if (!user.userId || allTasks.length < 1) {
    return <></>;
  }

  return (
    <div
      css={(theme: SupersetTheme) =>
        css`
          background: url('../../static/assets/images/icons/lines.svg')
            no-repeat left bottom ${theme.colors.primary.base};
          background-size: cover;
          border-radius: ${theme.gridUnit}px;
          color: ${theme.colors.grayscale.light4};
          margin: ${theme.gridUnit * 6}px ${theme.gridUnit * 4}px;
          padding: ${theme.gridUnit * 4}px;
        `
      }
    >
      <div
        css={(theme: SupersetTheme) =>
          css`
            align-items: center;
            display: flex;
            gap: ${theme.gridUnit * 4}px;
            font-size: ${theme.typography.sizes.s}px;
            font-weight: ${theme.typography.weights.bold};
            ${mq[0]} {
              align-items: flex-start;
            }
          `
        }
      >
        <div
          css={(theme: SupersetTheme) =>
            css`
              align-items: center;
              display: flex;
              gap: ${theme.gridUnit * 4}px;
              width: 85%;
              ${mq[0]} {
                display: block;
              }
            `
          }
        >
          <h4>Workspace setup guide</h4>
          <ProgressBar
            css={(theme: SupersetTheme) =>
              css`
                max-width: 350px;
                .ant-progress-outer {
                  display: inline-block;
                }
                .ant-progress-text {
                  color: ${theme.colors.grayscale.light4};
                }
              `
            }
            percent={parseInt(percentCompleted, 10)}
            strokeColor={theme.colors.primary.dark3}
            format={percent => `${percent}% complete`}
          />
        </div>
        <Icons.CaretUp
          css={() => StyledIcon()}
          onClick={() => setHideTaskCard(!hideTaskCard)}
        />
      </div>
      <div
        css={() =>
          css`
            display: ${hideTaskCard ? 'none' : 'block'};
          `
        }
      >
        Not sure where to start? Check out our suggestions for getting your
        first dashboard up and running.
      </div>
      <div
        css={(theme: SupersetTheme) =>
          css`
            display: ${hideTaskCard ? 'none' : 'flex'};
            gap: ${theme.gridUnit * 4}px;
            margin-top: ${theme.gridUnit * 4}px;
            ${mq[1]} {
              display: ${hideTaskCard ? 'none' : 'block'};
            }
          `
        }
      >
        {allTasks.map((task, index) => (
          <Card
            css={(theme: SupersetTheme) =>
              css`
                border-radius: ${theme.gridUnit}px;
                flex: 1 1 0px;
                overflow: hidden;
                padding: ${theme.gridUnit * 2}px ${theme.gridUnit * 3}px;
                background: ${theme.colors.grayscale.light5};
                ${mq[1]} {
                  margin-bottom: ${theme.gridUnit * 2}px;
                }
                .ant-card-body {
                  align-items: center;
                  display: flex;
                }
              `
            }
            size="small"
            onClick={() => task.path && openTaskUrl(task.path)}
          >
            <p
              css={(theme: SupersetTheme) =>
                css`
                  align-items: center;
                  color: ${theme.colors.primary.dark2};
                  display: flex;
                  font-size: ${theme.typography.sizes.s}px;
                  font-weight: ${theme.typography.weights.bold};
                  margin: 0;
                `
              }
            >
              {index + 1}. {task.name} <Icons.CaretRight />
            </p>
            {task.completed ? (
              <Icons.CircleCheckSolid
                iconColor={theme.colors.primary.base}
                css={() => StyledIcon()}
              />
            ) : (
              <Icons.CircleCheckSolid
                iconColor={theme.colors.grayscale.light2}
                css={() => StyledIcon()}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
