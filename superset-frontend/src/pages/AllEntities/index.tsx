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
import AllEntitiesTable, {
  TaggedObjects,
} from 'src/features/allEntities/AllEntitiesTable';
import Button from 'src/components/Button';
import MetadataBar, {
  MetadataType,
  Description,
  Owner,
  LastModified,
} from 'src/components/MetadataBar';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { Tag } from 'src/views/CRUD/types';
import TagModal from 'src/features/tags/TagModal';
import withToasts, { useToasts } from 'src/components/MessageToasts/withToasts';
import { fetchObjectsByTagIds, fetchSingleTag } from 'src/features/tags/tags';
import Loading from 'src/components/Loading';
import getOwnerName from 'src/utils/getOwnerName';

interface TaggedObject {
  id: number;
  type: string;
  name: string;
  url: string;
  changed_on: moment.MomentInput;
  created_by: number | undefined;
  creator: string;
  owners: Owner[];
  tags: Tag[];
}

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
  .pagination-container {
    background-color: transparent;
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
  const [isLoading, setLoading] = useState<boolean>(false);
  const [objects, setObjects] = useState<TaggedObjects>({
    dashboard: [],
    chart: [],
    query: [],
  });

  const editableTitleProps = {
    title: tag?.name || '',
    placeholder: 'testing',
    onSave: (newDatasetName: string) => {},
    canEdit: false,
    label: t('dataset name'),
  };

  const items = [];
  if (tag?.description) {
    const description: Description = {
      type: MetadataType.DESCRIPTION,
      value: tag?.description || '',
    };
    items.push(description);
  }

  const owner: Owner = {
    type: MetadataType.OWNER,
    createdBy: getOwnerName(tag?.created_by),
    createdOn: tag?.created_on_delta_humanized || '',
  };
  items.push(owner);

  const lastModified: LastModified = {
    type: MetadataType.LAST_MODIFIED,
    value: tag?.changed_on_delta_humanized || '',
    modifiedBy: getOwnerName(tag?.changed_by),
  };
  items.push(lastModified);

  const fetchTaggedObjects = () => {
    setLoading(true);
    if (!tag) {
      addDangerToast('Error tag object is not referenced!');
      return;
    }
    fetchObjectsByTagIds(
      { tagIds: [tag?.id] || '', types: null },
      (data: TaggedObject[]) => {
        const objects = { dashboard: [], chart: [], query: [] };
        data.forEach(function (object) {
          const object_type = object.type;
          objects[object_type].push(object);
        });
        setObjects(objects);
        setLoading(false);
      },
      (error: Response) => {
        addDangerToast('Error Fetching Tagged Objects');
        setLoading(false);
      },
    );
  };

  const fetchTag = (tagId: number) => {
    fetchSingleTag(
      tagId,
      (tag: Tag) => {
        setTag(tag);
        setLoading(false);
      },
      (error: Response) => {
        addDangerToast(t('Error Fetching Tagged Objects'));
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    // fetch single tag met
    if (tagId) {
      setLoading(true);
      fetchTag(tagId);
    }
  }, [tagId]);

  useEffect(() => {
    if (tag) fetchTaggedObjects();
  }, [tag]);

  if (isLoading) return <Loading />;
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
        refreshData={() => {
          fetchTaggedObjects();
          if (tagId) fetchTag(tagId);
        }}
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
                showMarginRight={false}
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
          objects={objects}
        />
      </div>
    </AllEntitiesContainer>
  );
}

export default withToasts(AllEntities);
