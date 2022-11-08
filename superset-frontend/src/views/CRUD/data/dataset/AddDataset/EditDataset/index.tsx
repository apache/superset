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
import { styled, SupersetClient, t } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import Badge from 'src/components/Badge';
import Tabs from 'src/components/Tabs';

const StyledTabs = styled(Tabs)`
  margin-top: 34px;
  padding-left: 16px;
  // display: inline-block;
  .ant-tabs-top > .ant-tabs-nav::before,
  .ant-tabs-top > .ant-tabs-nav::before {
    width: 200px;
  }
  .ant-tabs-nav-list > div:nth-last-child(2) {
    // margin-right: 0px;
  }
`;

const TabStyles = styled.div`
  .ant-badge {
    width: 32px;
    margin-left: 10px;
  }
`;

interface EditPageProps {
  id: string;
}

const EditPage = ({ id }: EditPageProps) => {
  const [usageCount, setUsageCount] = useState(0);
  useEffect(() => {
    // Todo: this useEffect should be used to call all count methods conncurently
    // when we populate data for the new tabs. For right separating out this
    // api call for building the usage page.
    if (id)
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}/related_objects`,
      })
        .then(({ json = {} }) => {
          setUsageCount(json.charts.count);
        })
        .catch(err => console.log(err));
  }, [id]);

  const Tab = (
    <TabStyles>
      <span>{t('Usage')}</span>
      <Badge count={usageCount + 1} />
    </TabStyles>
  );

  return (
    <>
      <StyledTabs moreIcon={null} fullWidth={false}>
        <Tabs.TabPane tab={t('Columns')} key="1" />
        <Tabs.TabPane tab={t('Metrics')} key="2" />
        <Tabs.TabPane tab={Tab} key="3">
          <div>placeholder</div>
        </Tabs.TabPane>
      </StyledTabs>
    </>
  );
};

export default EditPage;
