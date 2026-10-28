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
import { FC } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { SupersetApiError } from '@superset-ui/core';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { DashboardPage } from 'src/dashboard/containers/DashboardPage';
import { useDashboard } from 'src/hooks/apiResources/dashboards';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { RoutePaths } from 'src/views/routePaths';
import { useHistory } from 'react-router-dom';

const PaneFrame = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

type DashboardWorkspacePaneProps = {
  idOrSlug: string;
};

export const DashboardWorkspacePane: FC<DashboardWorkspacePaneProps> = ({
  idOrSlug,
}) => {
  const history = useHistory();
  const { error, status } = useDashboard(idOrSlug);
  const apiError = error as SupersetApiError | null;

  if (status === ResourceStatus.Loading) {
    return (
      <PaneFrame>
        <Loading />
      </PaneFrame>
    );
  }

  if (apiError?.status === 403) {
    return (
      <PaneFrame>
        <EmptyState
          size="large"
          image="empty.svg"
          title={t('You do not have access to this dashboard')}
          description={t(
            'Choose another dashboard from the list or contact an admin for access.',
          )}
        />
      </PaneFrame>
    );
  }

  if (apiError?.status === 404) {
    return (
      <PaneFrame>
        <EmptyState
          size="large"
          image="empty-dashboard.svg"
          title={t('This dashboard does not exist')}
          description={t(
            'The dashboard may have been deleted or is not visible in your list.',
          )}
          buttonText={t('See all dashboards')}
          buttonAction={() => history.push(RoutePaths.DASHBOARD_LIST)}
        />
      </PaneFrame>
    );
  }

  if (apiError) {
    return (
      <PaneFrame>
        <EmptyState
          size="large"
          title={t('Unable to load dashboard')}
          description={apiError.message || t('An unexpected error occurred.')}
        />
      </PaneFrame>
    );
  }

  return (
    <PaneFrame>
      <DashboardPage idOrSlug={idOrSlug} key={idOrSlug} />
    </PaneFrame>
  );
};
