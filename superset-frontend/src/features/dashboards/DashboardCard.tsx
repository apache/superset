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
import { Link, useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
import { CardStyles } from 'src/views/CRUD/utils';
import {
  FaveStar,
  Icons,
  PublishedLabel,
  ListViewCard,
  Tooltip,
} from '@superset-ui/core/components';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { Dashboard } from 'src/views/CRUD/types';
import { assetUrl } from 'src/utils/assetUrl';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import { KebabMenuButton } from 'src/components';
import { isUserEditorOrAdmin } from 'src/dashboard/util/permissionUtils';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

const menuItemButtonCss = css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  width: 100%;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

interface DashboardCardProps {
  isChart?: boolean;
  dashboard: Dashboard;
  hasPerm: (name: string) => boolean;
  bulkSelectEnabled: boolean;
  loading: boolean;
  openDashboardEditModal?: (d: Dashboard) => void;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  user?: UserWithPermissionsAndRoles;
  showThumbnails?: boolean;
  handleBulkDashboardExport: (dashboardsToExport: Dashboard[]) => void;
  onDelete: (dashboard: Dashboard) => void;
}

function DashboardCard({
  dashboard,
  hasPerm,
  bulkSelectEnabled,
  user,
  openDashboardEditModal,
  favoriteStatus,
  saveFavoriteStatus,
  showThumbnails,
  handleBulkDashboardExport,
  onDelete,
}: DashboardCardProps) {
  const userId = user?.userId;

  const history = useHistory();
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const allowEdit = isUserEditorOrAdmin(user, dashboard.editors);
  const digest = dashboard.changed_on_utc || dashboard.changed_on;
  const thumbnailUrl =
    isFeatureEnabled(FeatureFlag.Thumbnails) && dashboard.id && digest
      ? `/api/v1/dashboard/${dashboard.id}/thumbnail/${encodeURIComponent(digest)}/`
      : '';

  const menuItems: MenuItem[] = [];

  if (canEdit && openDashboardEditModal) {
    menuItems.push({
      key: 'edit',
      label: (
        <Tooltip
          title={
            allowEdit
              ? null
              : t(
                  'You must be a dashboard editor in order to edit. Please reach out to a dashboard editor to request modifications or edit access.',
                )
          }
        >
          <button
            type="button"
            css={menuItemButtonCss}
            className="action-button"
            onClick={
              allowEdit ? () => openDashboardEditModal(dashboard) : undefined
            }
            data-test="dashboard-card-option-edit-button"
          >
            <Icons.EditOutlined iconSize="l" data-test="edit-alt" /> {t('Edit')}
          </button>
        </Tooltip>
      ),
      disabled: !allowEdit,
    });
  }

  if (canExport) {
    menuItems.push({
      key: 'export',
      label: (
        <button
          type="button"
          css={menuItemButtonCss}
          onClick={() => handleBulkDashboardExport([dashboard])}
          className="action-button"
          data-test="dashboard-card-option-export-button"
        >
          <Icons.UploadOutlined iconSize="l" /> {t('Export')}
        </button>
      ),
    });
  }

  if (canDelete) {
    menuItems.push({
      key: 'delete',
      label: (
        <Tooltip
          title={
            allowEdit
              ? null
              : t(
                  'You must be a dashboard editor in order to delete. Please reach out to a dashboard editor to request modifications or edit access.',
                )
          }
        >
          <button
            type="button"
            css={menuItemButtonCss}
            className="action-button"
            onClick={allowEdit ? () => onDelete(dashboard) : undefined}
            data-test="dashboard-card-option-delete-button"
          >
            <Icons.DeleteOutlined iconSize="l" /> {t('Delete')}
          </button>
        </Tooltip>
      ),
      disabled: !allowEdit,
    });
  }

  return (
    <CardStyles
      onClick={() => {
        if (!bulkSelectEnabled) {
          history.push(dashboard.url);
        }
      }}
    >
      <ListViewCard
        loading={dashboard.loading || false}
        title={dashboard.dashboard_title}
        certifiedBy={dashboard.certified_by}
        certificationDetails={dashboard.certification_details}
        titleRight={<PublishedLabel isPublished={dashboard.published} />}
        cover={
          !isFeatureEnabled(FeatureFlag.Thumbnails) || !showThumbnails ? (
            <></>
          ) : null
        }
        url={bulkSelectEnabled ? undefined : dashboard.url}
        linkComponent={Link}
        imgURL={thumbnailUrl}
        imgFallbackURL={assetUrl(
          '/static/assets/images/dashboard-card-fallback.svg',
        )}
        description={t('Modified %s', dashboard.changed_on_delta_humanized)}
        coverLeft={<SubjectPile subjects={dashboard.editors || []} />}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {userId && (
              <FaveStar
                itemId={dashboard.id}
                saveFaveStar={saveFavoriteStatus}
                isStarred={favoriteStatus}
              />
            )}
            <KebabMenuButton
              menuItems={menuItems}
              dataTest="dashboard-card-menu"
            />
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}

export default DashboardCard;
