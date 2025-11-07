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
import { styled, t } from '@superset-ui/core';
import useGetDatasetRelatedCounts from 'src/features/datasets/hooks/useGetDatasetRelatedCounts';
import { Badge } from '@superset-ui/core/components';
import Tabs from '@superset-ui/core/components/Tabs';
import UsageTab from './UsageTab';

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
      children: <UsageTab datasetId={id} />,
    },
  ];

  return <StyledTabs moreIcon={null} items={items} />;
};

export default EditPage;
