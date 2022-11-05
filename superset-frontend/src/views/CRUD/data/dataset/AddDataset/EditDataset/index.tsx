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
import { css, styled, SupersetClient, t } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import Badge from 'src/components/Badge';
import Tabs from 'src/components/Tabs';

const StyledTabs = styled(Tabs)`
  margin-top: 34px;
  padding-left: 16px;
  div[role='tablist'] {
    width: 307px;
  }
`;

const TabStyles = styled.div`
  .ant-badge {
    width: 32px;
  }
`;

const EditPage = ({ id }) => {
  const [usageCount, setUsageCount] = useState(0);
  useEffect(() => {
    if (id)
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}/related_objects`,
      })
        .then(({ json = {} }) => {
          console.log('JSON', json);
        })
        .catch(err => console.log(err));
  }, [id]);

  const Tab = (
    <TabStyles>
      <span>{t('Usage')}</span>
      <Badge count={1} />
    </TabStyles>
  );

  return (
    <>
      <StyledTabs>
        <Tabs.TabPane tab={t('Columns')}>
          <div>placeholder</div>
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Metrics')}>
          <div>placeholder</div>
        </Tabs.TabPane>
        <Tabs.TabPane tab={Tab}>
          <div>placeholder</div>
        </Tabs.TabPane>

      </StyledTabs>
    </>
  );
};

export default EditPage;
