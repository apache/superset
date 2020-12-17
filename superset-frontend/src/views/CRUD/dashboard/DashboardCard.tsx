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
import React from 'react';
import { t } from '@superset-ui/core';
import {
  handleDashboardDelete,
  handleBulkDashboardExport,
  CardStyles,
} from 'src/views/CRUD/utils';
import { Dropdown, Menu } from 'src/common/components';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListViewCard from 'src/components/ListViewCard';
import Icon from 'src/components/Icon';
import Label from 'src/components/Label';
import FacePile from 'src/components/FacePile';
import FaveStar from 'src/components/FaveStar';
import { Dashboard } from 'src/views/CRUD/types';

interface DashboardCardProps {
  isChart?: boolean;
  dashboard: Dashboard;
  hasPerm: (name: string) => boolean;
  bulkSelectEnabled: boolean;
  refreshData: () => void;
  loading: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  openDashboardEditModal?: (d: Dashboard) => void;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  dashboardFilter?: string;
  userId?: number;
}

function DashboardCard({
  dashboard,
  hasPerm,
  bulkSelectEnabled,
  dashboardFilter,
  refreshData,
  userId,
  addDangerToast,
  addSuccessToast,
  openDashboardEditModal,
  favoriteStatus,
  saveFavoriteStatus,
}: DashboardCardProps) {
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_read');

  const menu = (
    <Menu>
      {canEdit && openDashboardEditModal && (
        <Menu.Item
          role="button"
          tabIndex={0}
          onClick={() =>
            openDashboardEditModal && openDashboardEditModal(dashboard)
          }
          data-test="dashboard-card-option-edit-button"
        >
          <ListViewCard.MenuIcon name="edit-alt" /> Edit
        </Menu.Item>
      )}
      {canExport && (
        <Menu.Item
          role="button"
          tabIndex={0}
          onClick={() => handleBulkDashboardExport([dashboard])}
        >
          <ListViewCard.MenuIcon name="share" /> Export
        </Menu.Item>
      )}
      {canDelete && (
        <Menu.Item>
          <ConfirmStatusChange
            title={t('Please Confirm')}
            description={
              <>
                {t('Are you sure you want to delete')}{' '}
                <b>{dashboard.dashboard_title}</b>?
              </>
            }
            onConfirm={() =>
              handleDashboardDelete(
                dashboard,
                refreshData,
                addSuccessToast,
                addDangerToast,
                dashboardFilter,
                userId,
              )
            }
          >
            {confirmDelete => (
              <div
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={confirmDelete}
                data-test="dashboard-card-option-delete-button"
              >
                <ListViewCard.MenuIcon name="trash" /> Delete
              </div>
            )}
          </ConfirmStatusChange>
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <CardStyles
      onClick={() => {
        window.location.href = dashboard.url;
      }}
    >
      <ListViewCard
        loading={dashboard.loading || false}
        title={dashboard.dashboard_title}
        titleRight={
          <Label>{dashboard.published ? 'published' : 'draft'}</Label>
        }
        url={bulkSelectEnabled ? undefined : dashboard.url}
        imgURL={dashboard.thumbnail_url}
        imgFallbackURL="/static/assets/images/dashboard-card-fallback.svg"
        description={t(
          'Last modified %s',
          dashboard.changed_on_delta_humanized,
        )}
        coverLeft={<FacePile users={dashboard.owners || []} />}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <FaveStar
              itemId={dashboard.id}
              saveFaveStar={saveFavoriteStatus}
              isStarred={favoriteStatus}
            />
            <Dropdown overlay={menu}>
              <Icon name="more-horiz" />
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}

export default DashboardCard;
