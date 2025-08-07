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
import { Link } from 'react-router-dom';
import { isFeatureEnabled, FeatureFlag, t } from '@superset-ui/core';
import { CardStyles } from 'src/views/CRUD/utils';
import {
  Button,
  Dropdown,
  ConfirmStatusChange,
  ListViewCard,
} from '@superset-ui/core/components';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tag } from 'src/views/CRUD/types';
import { deleteTags } from 'src/features/tags/tags';
import { assetUrl } from 'src/utils/assetUrl';

interface TagCardProps {
  tag: Tag;
  hasPerm: (name: string) => boolean;
  bulkSelectEnabled: boolean;
  refreshData: () => void;
  loading: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  tagFilter?: string;
  userId?: string | number;
  showThumbnails?: boolean;
}

function TagCard({
  tag,
  hasPerm,
  refreshData,
  addDangerToast,
  addSuccessToast,
  showThumbnails,
}: TagCardProps) {
  const canDelete = hasPerm('can_write');

  const handleTagDelete = (tag: Tag) => {
    deleteTags([tag], addSuccessToast, addDangerToast);
    refreshData();
  };

  const menuItems: MenuItem[] = [];
  if (canDelete) {
    menuItems.push({
      key: 'delete-tag',
      label: (
        <ConfirmStatusChange
          title={t('Please confirm')}
          description={
            <>
              {t('Are you sure you want to delete')} <b>{tag.name}</b>?
            </>
          }
          onConfirm={() => handleTagDelete(tag)}
        >
          {confirmDelete => (
            <div
              role="button"
              tabIndex={0}
              className="action-button"
              onClick={confirmDelete}
              data-test="dashboard-card-option-delete-button"
            >
              <Icons.DeleteOutlined iconSize="l" /> {t('Delete')}
            </div>
          )}
        </ConfirmStatusChange>
      ),
    });
  }
  return (
    <CardStyles>
      <ListViewCard
        title={tag.name}
        cover={
          !isFeatureEnabled(FeatureFlag.Thumbnails) || !showThumbnails ? (
            <></>
          ) : null
        }
        url={undefined}
        linkComponent={Link}
        imgFallbackURL={assetUrl(
          '/static/assets/images/dashboard-card-fallback.svg',
        )}
        description={t('Modified %s', tag.changed_on_delta_humanized)}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <Dropdown menu={{ items: menuItems }} trigger={['click', 'hover']}>
              <Button buttonSize="xsmall" buttonStyle="link">
                <Icons.MoreOutlined iconSize="xl" />
              </Button>
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}

export default TagCard;
