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
import { useFavoriteStatus } from 'src/views/CRUD/hooks';
import { SupersetClient, t } from '@superset-ui/core';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import Icon from 'src/components/Icon';
import Chart from 'src/types/Chart';

import ListViewCard from 'src/components/ListViewCard';
import Label from 'src/components/Label';
import { Dropdown, Menu } from 'src/common/components';
import FaveStar from 'src/components/FaveStar';
import FacePile from 'src/components/FacePile';

const FAVESTAR_BASE_URL = '/superset/favstar/slice';

interface ChartCardProps {
  chart: Chart;
  hasPerm: (perm: string) => boolean;
  openChartEditModal: (chart: Chart) => void;
  bulkSelectEnabled: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  refreshData: () => void;
  loading: boolean;
}

export default function ChartCard({
  chart,
  hasPerm,
  openChartEditModal,
  bulkSelectEnabled,
  addDangerToast,
  addSuccessToast,
  refreshData,
  loading,
}: ChartCardProps) {
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const [
    favoriteStatusRef,
    fetchFaveStar,
    saveFaveStar,
    favoriteStatus,
  ] = useFavoriteStatus({}, FAVESTAR_BASE_URL, addDangerToast);

  function handleChartDelete({ id, slice_name: sliceName }: Chart) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted: %s', sliceName));
      },
      () => {
        addDangerToast(t('There was an issue deleting: %s', sliceName));
      },
    );
  }

  const menu = (
    <Menu>
      {canDelete && (
        <Menu.Item>
          <ConfirmStatusChange
            title={t('Please Confirm')}
            description={
              <>
                {t('Are you sure you want to delete')} <b>{chart.slice_name}</b>
                ?
              </>
            }
            onConfirm={() => handleChartDelete(chart)}
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
      {canEdit && (
        <Menu.Item
          role="button"
          tabIndex={0}
          onClick={() => openChartEditModal(chart)}
        >
          <ListViewCard.MenuIcon name="edit-alt" /> Edit
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <ListViewCard
      loading={loading}
      title={chart.slice_name}
      url={bulkSelectEnabled ? undefined : chart.url}
      imgURL={chart.thumbnail_url ?? ''}
      imgFallbackURL="/static/assets/images/chart-card-fallback.png"
      description={t('Last modified %s', chart.changed_on_delta_humanized)}
      coverLeft={<FacePile users={chart.owners || []} />}
      coverRight={
        <Label bsStyle="secondary">{chart.datasource_name_text}</Label>
      }
      actions={
        <ListViewCard.Actions>
          <FaveStar
            itemId={chart.id}
            fetchFaveStar={fetchFaveStar}
            saveFaveStar={saveFaveStar}
            isStarred={!!favoriteStatus[chart.id]}
          />
          <Dropdown overlay={menu}>
            <Icon name="more-horiz" />
          </Dropdown>
        </ListViewCard.Actions>
      }
    />
  );
}
