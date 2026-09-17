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
import { isFeatureEnabled, FeatureFlag, t, useTheme } from '@superset-ui/core';
import { CardStyles } from 'src/views/CRUD/utils';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListViewCard from 'src/components/ListViewCard';
import Icons from 'src/components/Icons';
import { Tag } from 'src/views/CRUD/types';
import { deleteTags } from 'src/features/tags/tags';

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
  bulkSelectEnabled,
  tagFilter,
  refreshData,
  userId,
  addDangerToast,
  addSuccessToast,
  showThumbnails,
}: TagCardProps) {
  const canDelete = hasPerm('can_write');

  const handleTagDelete = (tag: Tag) => {
    deleteTags([tag], addSuccessToast, addDangerToast);
    refreshData();
  };

  const theme = useTheme();
  const menu = (
    <Menu>
      {canDelete && (
        <Menu.Item>
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
                <Icons.Trash iconSize="l" /> {t('Delete')}
              </div>
            )}
          </ConfirmStatusChange>
        </Menu.Item>
      )}
    </Menu>
  );
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
        imgFallbackURL="/static/assets/images/dashboard-card-fallback.svg"
        description={t('Modified %s', tag.changed_on_delta_humanized)}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <AntdDropdown overlay={menu}>
              <Icons.MoreVert iconColor={theme.colors.grayscale.base} />
            </AntdDropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}

export default TagCard;
