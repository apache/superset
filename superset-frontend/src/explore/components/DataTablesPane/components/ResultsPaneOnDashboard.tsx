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
import { t, styled } from '@superset-ui/core';
import Tabs from '@superset-ui/core/components/Tabs';
import { ResultTypes, ResultsPaneProps } from '../types';
import { useResultsPane } from './useResultsPane';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .ant-tabs {
    height: 100%;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    display: flex;
    flex-direction: column;
  }

  .table-condensed {
    overflow: auto;
  }
`;

export const ResultsPaneOnDashboard = ({
  isRequest,
  queryFormData,
  queryForce,
  ownState,
  errorMessage,
  setForceQuery,
  isVisible,
  dataSize = 50,
  canDownload,
}: ResultsPaneProps) => {
  const resultsPanes = useResultsPane({
    errorMessage,
    queryFormData,
    queryForce,
    ownState,
    isRequest,
    setForceQuery,
    dataSize,
    isVisible,
    canDownload,
  });

  if (resultsPanes.length === 1) {
    return <Wrapper>{resultsPanes[0]}</Wrapper>;
  }

  const items = resultsPanes.map((pane, idx) => ({
    key: idx === 0 ? ResultTypes.Results : `${ResultTypes.Results} ${idx + 1}`,
    label: idx === 0 ? t('Results') : t('Results %s', idx + 1),
    children: pane,
  }));

  return (
    <Wrapper>
      <Tabs items={items} />
    </Wrapper>
  );
};
