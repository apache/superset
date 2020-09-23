import React from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { Dropdown, Menu } from 'src/common/components';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListViewCard from 'src/components/ListViewCard';
import Icon from 'src/components/Icon';
import Label from 'src/components/Label';
import FacePile from 'src/components/FacePile';
import FaveStar from 'src/components/FaveStar';
import Owner from 'src/types/Owner';

import { createErrorHandler } from 'src/views/CRUD/utils';
import { useFavoriteStatus } from 'src/views/CRUD/hooks';

const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';

interface Dashboard {
  changed_by_name: string;
  changed_by_url: string;
  changed_on_delta_humanized: string;
  changed_by: string;
  dashboard_title: string;
  slice_name: string;
  id: number;
  published: boolean;
  url: string;
  thumbnail_url: string;
  owners: Owner[];
  loading: boolean;
}

interface DashboardCardProps {
  isChart?: boolean;
  dashboard: Dashboard;
  hasPerm: (name: string) => boolean;
  bulkSelectEnabled: boolean;
  refreshData: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  openDashboardEditModal?: (d: Dashboard) => void;
}

function DashboardCard({
  isChart,
  dashboard,
  hasPerm,
  bulkSelectEnabled,
  refreshData,
  addDangerToast,
  addSuccessToast,
  openDashboardEditModal,
}: DashboardCardProps) {
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const canExport = hasPerm('can_mulexport');
  const [favoriteStatusRef, fetchFaveStar, saveFaveStar] = useFavoriteStatus(
    {},
    FAVESTAR_BASE_URL,
    addDangerToast,
  );

  function handleDashboardDelete({
    id,
    dashboard_title: dashboardTitle,
  }: Dashboard) {
    return SupersetClient.delete({
      endpoint: `/api/v1/dashboard/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', dashboardTitle));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', dashboardTitle, errMsg),
        ),
      ),
    );
  }

  function handleBulkDashboardExport(dashboardsToExport: Dashboard[]) {
    return window.location.assign(
      `/api/v1/dashboard/export/?q=${rison.encode(
        dashboardsToExport.map(({ id }) => id),
      )}`,
    );
  }

  const cardTitle = isChart ? dashboard.slice_name : dashboard.dashboard_title;

  const menu = (
    <Menu>
      {canDelete && (
        <Menu.Item>
          <ConfirmStatusChange
            title={t('Please Confirm')}
            description={
              <>
                {t('Are you sure you want to delete')} <b>{cardTitle}</b>?
              </>
            }
            onConfirm={() => handleDashboardDelete(dashboard)}
          >
            {confirmDelete => (
              <div
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={confirmDelete}
              >
                <ListViewCard.MenuIcon name="trash" /> Delete
              </div>
            )}
          </ConfirmStatusChange>
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
      {canEdit && openDashboardEditModal && (
        <Menu.Item
          role="button"
          tabIndex={0}
          onClick={() =>
            openDashboardEditModal && openDashboardEditModal(dashboard)
          }
        >
          <ListViewCard.MenuIcon name="pencil" /> Edit
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <ListViewCard
      loading={dashboard.loading}
      title={dashboard.dashboard_title}
      titleRight={<Label>{dashboard.published ? 'published' : 'draft'}</Label>}
      url={bulkSelectEnabled ? undefined : dashboard.url}
      imgURL={dashboard.thumbnail_url}
      imgFallbackURL="/static/assets/images/dashboard-card-fallback.png"
      description={t('Last modified %s', dashboard.changed_on_delta_humanized)}
      coverLeft={<FacePile users={dashboard.owners || []} />}
      actions={
        <ListViewCard.Actions>
          <FaveStar
            itemId={dashboard.id}
            fetchFaveStar={fetchFaveStar}
            saveFaveStar={saveFaveStar}
            isStarred={!!favoriteStatusRef.current[dashboard.id]}
          />
          <Dropdown overlay={menu}>
            <Icon name="more-horiz" />
          </Dropdown>
        </ListViewCard.Actions>
      }
      showImg
    />
  );
}

export default DashboardCard;
