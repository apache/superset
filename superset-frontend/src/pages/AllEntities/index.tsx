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
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ensureIsArray, styled, t, css } from '@superset-ui/core';
import { NumberParam, StringParam, useQueryParam } from 'use-query-params';
import withToasts from 'src/components/MessageToasts/withToasts';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { SelectValue } from 'antd/lib/select';
import { loadTags } from 'src/components/Tags/utils';
import { getValue } from 'src/components/Select/utils';
import AllEntitiesTable from 'src/features/allEntities/AllEntitiesTable';
import Button from 'src/components/Button';
import MetadataBar, {
  MetadataType,
  Description,
  Owner,
  LastModified,
} from 'src/components/MetadataBar';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { fetchSingleTag } from 'src/features/tags/tags';
import { Tag } from 'src/views/CRUD/types';
import TagModal from 'src/features/tags/TagModal';

const additionalItemsStyles = theme => css`
  display: flex;
  align-items: center;
  margin-left: ${theme.gridUnit}px;
  & > span {
    margin-right: ${theme.gridUnit * 3}px;
  }
`;

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
  }
  .entities {
    margin: 30px 0px;
  }
  `}
`;

const AllEntitiesNav = styled.div`
  ${({ theme }) => `
  height: ${theme.gridUnit * 12.5}px;
  background-color: ${theme.colors.grayscale.light5};
  margin-bottom: ${theme.gridUnit * 4}px;
  .navbar-brand {
    margin-left: ${theme.gridUnit * 2}px;
    font-weight: ${theme.typography.weights.bold};
  }
  .header {
    font-weight: 600;
    margin-right: 12px;
    text-align: left;
    font-size: 18px;
    padding: 12px;
    display: inline-block;
    line-height: 36px;
  }
  `};
`;

function AllEntities() {
  const [tagsQuery, setTagsQuery] = useQueryParam('tags', StringParam);
  const [tagId, setTagId] = useQueryParam('id', NumberParam);
  const [tag, setTag] = useState<Tag>(null);
  const [showTagModal, setShowTagModal] = useState<boolean>(false);

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

  const editableTitleProps = {
    title: tag?.name,
    placeholder: 'testing',
    onSave: (newDatasetName: string) => {},
    canEdit: false,
    label: t('dataset name'),
  };

  const description: Description = {
    type: MetadataType.DESCRIPTION,
    value: tag?.description || '',
  };

  const owner: Owner = {
    type: MetadataType.OWNER,
    createdBy: `${tag?.created_by.first_name} ${tag?.created_by.last_name}`,
    createdOn: tag?.created_on_delta_humanized,
  };
  const lastModified: LastModified = {
    type: MetadataType.LAST_MODIFIED,
    value: tag?.changed_on_delta_humanized,
    modifiedBy: `${tag?.changed_by.first_name} ${tag?.changed_by.last_name}`,
  };
  const items = [description, owner, lastModified];

  useEffect(() => {
    // fetch single tag met
    if (tagId) {
      fetchSingleTag(
        tagId,
        (tag: Tag) => {
          setTag(tag);
        },
        (error: Response) => {
          addDangerToast('Error Fetching Tagged Objects');
          logging.log(error.text);
        },
      );
    }
  }, [tagId]);

  return (
    <AllEntitiesContainer>
      <TagModal
        show={showTagModal}
        onHide={() => {
          setShowTagModal(false);
        }}
        editTag={tag}
        // refreshData={refreshData}
        // addSuccessToast={addSuccessToast}
        // addDangerToast={addDangerToast}
      />
      <AllEntitiesNav>
        <PageHeaderWithActions
          editableTitleProps={editableTitleProps}
          showTitlePanelItems
          titlePanelAdditionalItems={
            <div css={additionalItemsStyles}>
              <MetadataBar items={items} tooltipPlacement="bottom" />
            </div>
          }
          rightPanelAdditionalItems={
            <>
              <Button
                data-test="bulk-select-action"
                buttonStyle="secondary"
                onClick={() => setShowTagModal(true)}
              >
                {t('Edit Tag')}{' '}
              </Button>
            </>
          }
        />
      </AllEntitiesNav>
      {/* <div className="select-control">
        <div className="select-control-label">{t('search by tags')}</div>
        <AsyncSelect
          ariaLabel="tags"
          value={tagsValue}
          onChange={onTagSearchChange}
          options={loadTags}
          placeholder="Select"
          mode="multiple"
        />
      </div> */}
      <div className="entities">
        <AllEntitiesTable search={tag?.name || ''} />
      </div>
    </AllEntitiesContainer>
  );
}

export default withToasts(AllEntities);
