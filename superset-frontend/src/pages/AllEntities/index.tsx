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
import { styled, t, css, SupersetTheme } from '@superset-ui/core';
import { NumberParam, useQueryParam } from 'use-query-params';
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
import withToasts, { useToasts } from 'src/components/MessageToasts/withToasts';

const additionalItemsStyles = (theme: SupersetTheme) => css`
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
    margin: ${theme.gridUnit * 6}px; 0px;
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
    font-weight: ${theme.typography.weights.bold};
    margin-right:  ${theme.gridUnit * 3}px;
    text-align: left;
    font-size: ${theme.gridUnit * 4.5}px;
    padding: ${theme.gridUnit * 3}px;
    display: inline-block;
    line-height: ${theme.gridUnit * 9}px;
  }
  `};
`;

function AllEntities() {
  const [tagId] = useQueryParam('id', NumberParam);
  const [tag, setTag] = useState<Tag | null>(null);
  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const { addSuccessToast, addDangerToast } = useToasts();

  const editableTitleProps = {
    title: tag?.name || '',
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
    createdOn: tag?.created_on_delta_humanized || '',
  };
  const lastModified: LastModified = {
    type: MetadataType.LAST_MODIFIED,
    value: tag?.changed_on_delta_humanized || '',
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
          addDangerToast(t('Error Fetching Tagged Objects'));
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
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        refreshData={() => {}} // todo(hugh): implement refreshData on table reload
      />
      <AllEntitiesNav>
        <PageHeaderWithActions
          additionalActionsMenu={<></>}
          editableTitleProps={editableTitleProps}
          faveStarProps={{ itemId: 1, saveFaveStar: () => {} }}
          showFaveStar={false}
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
          menuDropdownProps={{
            disabled: true,
          }}
          showMenuDropdown={false}
        />
      </AllEntitiesNav>
      <div className="entities">
        <AllEntitiesTable
          search={tag?.name || ''}
          setShowTagModal={setShowTagModal}
        />
      </div>
    </AllEntitiesContainer>
  );
}

export default withToasts(AllEntities);
