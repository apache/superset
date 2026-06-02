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
import { useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import useGetDatasetRelatedCounts from 'src/features/datasets/hooks/useGetDatasetRelatedCounts';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { setCurrentDataset } from 'src/core/dataset';
import { Badge } from '@superset-ui/core/components';
import Tabs from '@superset-ui/core/components/Tabs';

const StyledTabs = styled(Tabs)`
  ${({ theme }) => `
  margin-top: ${theme.sizeUnit * 8.5}px;
  padding-left: ${theme.sizeUnit * 4}px;
  padding-right: ${theme.sizeUnit * 4}px;

  .ant-tabs-top > .ant-tabs-nav::before {
    width: ${theme.sizeUnit * 50}px;
  }
  `}
`;

const TabStyles = styled.div`
  ${({ theme }) => `
  .ant-badge {
    width: ${theme.sizeUnit * 8}px;
    margin-left: ${theme.sizeUnit * 2.5}px;
  }
  `}
`;

interface EditPageProps {
  id: string;
}

// Stable no-op error handler so `useSingleViewResource`'s `fetchResource`
// keeps a stable identity across renders (it lists the handler in its deps).
// An inline handler would change every render and re-trigger the fetch effect,
// causing an update loop. Fetch failure is non-fatal here — the dataset
// context simply stays empty.
const noopErrorHandler = () => {};

const TRANSLATIONS = {
  USAGE_TEXT: t('Usage'),
  COLUMNS_TEXT: t('Columns'),
  METRICS_TEXT: t('Metrics'),
};

const TABS_KEYS = {
  COLUMNS: 'COLUMNS',
  METRICS: 'METRICS',
  USAGE: 'USAGE',
};

const EditPage = ({ id }: EditPageProps) => {
  const { usageCount } = useGetDatasetRelatedCounts(id);

  // Publish the focused dataset to the `dataset` extension namespace so chatbot
  // extensions can read which dataset the user is editing. Cleared on unmount.
  const {
    state: { resource: datasetResource },
    fetchResource,
  } = useSingleViewResource<{
    id: number;
    table_name?: string;
    schema?: string | null;
    catalog?: string | null;
    sql?: string | null;
    is_sqllab_view?: boolean;
    database?: { database_name?: string };
  }>('dataset', t('dataset'), noopErrorHandler);

  useEffect(() => {
    const datasetId = Number(id);
    if (!Number.isNaN(datasetId)) {
      fetchResource(datasetId);
    }
    // `fetchResource` is stable (noopErrorHandler keeps its identity fixed);
    // fetch only when the id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!datasetResource) return undefined;
    setCurrentDataset({
      datasetId: datasetResource.id,
      datasetName: datasetResource.table_name ?? String(datasetResource.id),
      schema: datasetResource.schema ?? null,
      catalog: datasetResource.catalog ?? null,
      databaseName: datasetResource.database?.database_name ?? null,
      isVirtual:
        Boolean(datasetResource.sql) || !!datasetResource.is_sqllab_view,
    });
    return () => setCurrentDataset(undefined);
  }, [datasetResource]);

  const usageTab = (
    <TabStyles>
      <span>{TRANSLATIONS.USAGE_TEXT}</span>
      {usageCount > 0 && <Badge count={usageCount} />}
    </TabStyles>
  );

  const items = [
    {
      key: TABS_KEYS.COLUMNS,
      label: TRANSLATIONS.COLUMNS_TEXT,
      children: null,
    },
    {
      key: TABS_KEYS.METRICS,
      label: TRANSLATIONS.METRICS_TEXT,
      children: null,
    },
    {
      key: TABS_KEYS.USAGE,
      label: usageTab,
      children: null,
    },
  ];

  return <StyledTabs moreIcon={null} items={items} />;
};

export default EditPage;
