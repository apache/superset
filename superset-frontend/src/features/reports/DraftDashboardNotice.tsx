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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { useReportConfiguration } from 'src/features/alerts/hooks/useReportConfiguration';

type Props = {
  dashboardId?: number | string;
  executorName?: string;
  usesDefaultExecutor?: boolean;
  runsAsCurrentUser?: boolean;
  canChooseExecutor?: boolean;
};

export default function DraftDashboardNotice({
  dashboardId,
  executorName,
  usesDefaultExecutor = true,
  runsAsCurrentUser = false,
  canChooseExecutor = false,
}: Props) {
  const [draftId, setDraftId] = useState<number | string>();
  const { defaultExecutor } = useReportConfiguration(
    Boolean(dashboardId) && usesDefaultExecutor,
  );
  useEffect(() => {
    let active = true;
    setDraftId(undefined);
    if (dashboardId) {
      SupersetClient.get({ endpoint: `/api/v1/dashboard/${dashboardId}` })
        .then(({ json }) => {
          if (active && json.result?.published === false)
            setDraftId(dashboardId);
        })
        .catch(() => {
          // A failed metadata read is not evidence that a dashboard is Draft.
        });
    }
    return () => {
      active = false;
    };
  }, [dashboardId]);
  if (!dashboardId || draftId !== dashboardId) return null;
  const account =
    executorName || (usesDefaultExecutor ? defaultExecutor : null);
  const guidance = runsAsCurrentUser
    ? t(
        'This schedule runs with your permissions. You must be an Admin or an editor of this draft dashboard. Publish the dashboard when it is ready to share, or ask an administrator to give you dashboard editor access.',
      )
    : account
      ? t(
          'This dashboard is a draft. The schedule runs as "%s". Publish the dashboard when it is ready to share, or add "%s" as a dashboard editor. Draft dashboards require an Admin or dashboard editor.',
          account,
          account,
        )
      : t(
          'This dashboard is a draft. The execution account must be an Admin or dashboard editor. Publish the dashboard when it is ready to share, or ask an administrator to identify the execution account and add it as a dashboard editor.',
        );
  return (
    <Alert
      type="info"
      showIcon
      message={t('Draft dashboard access')}
      description={
        <>
          {guidance}
          {canChooseExecutor && (
            <> {t('You can also select an authorized account in Run as.')}</>
          )}
        </>
      }
    />
  );
}
