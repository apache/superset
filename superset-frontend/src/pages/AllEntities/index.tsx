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
import React, { useMemo } from 'react';
import { ensureIsArray, styled, t } from '@superset-ui/core';
import { StringParam, useQueryParam } from 'use-query-params';
import withToasts from 'src/components/MessageToasts/withToasts';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { SelectValue } from 'antd/lib/select';
import { loadTags } from 'src/components/Tags/utils';
import { getValue } from 'src/components/Select/utils';
import AllEntitiesTable from 'src/features/allEntities/AllEntitiesTable';

const AllEntitiesContainer = styled.div`
  ${({ theme }) => `
  background-color: ${theme.colors.grayscale.light4};
  .select-control {
    margin-left: ${theme.gridUnit * 4}px;
    margin-right: ${theme.gridUnit * 4}px;
    margin-bottom: ${theme.gridUnit * 2}px;
  }
  .select-control-label {
    text-transform: uppercase;
    font-size: ${theme.gridUnit * 3}px;
    color: ${theme.colors.grayscale.base};
    margin-bottom: ${theme.gridUnit * 1}px;
  }`}
`;

const AllEntitiesNav = styled.div`
  ${({ theme }) => `
  height: ${theme.gridUnit * 12.5}px;
  background-color: ${theme.colors.grayscale.light5};
  margin-bottom: ${theme.gridUnit * 4}px;
  .navbar-brand {
    margin-left: ${theme.gridUnit * 2}px;
    font-weight: ${theme.typography.weights.bold};
  }`};
`;

function AllEntities() {
  const [tagsQuery, setTagsQuery] = useQueryParam('tags', StringParam);

  const onTagSearchChange = (value: SelectValue) => {
    const tags = ensureIsArray(value).map(tag => getValue(tag));
    const tagSearch = tags.join(',');
    setTagsQuery(tagSearch);
  };

  const tagsValue = useMemo(
    () =>
      tagsQuery
        ? tagsQuery.split(',').map(tag => ({ value: tag, label: tag }))
        : [],
    [tagsQuery],
  );

  return (
    <AllEntitiesContainer>
      <AllEntitiesNav>
        <span className="navbar-brand">{t('All Entities')}</span>
      </AllEntitiesNav>
      <div className="select-control">
        <div className="select-control-label">{t('search by tags')}</div>
        <AsyncSelect
          ariaLabel="tags"
          value={tagsValue}
          onChange={onTagSearchChange}
          options={loadTags}
          placeholder="Select"
          mode="multiple"
        />
      </div>
      <AllEntitiesTable search={tagsQuery || ''} />
    </AllEntitiesContainer>
  );
}

export default withToasts(AllEntities);
