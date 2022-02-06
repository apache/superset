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
import { t, useTheme } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import Icons from 'src/components/Icons';
import Chart from 'src/types/Chart';

import ListViewCard from 'src/components/ListViewCard';
import Label from 'src/components/Label';
import { Dropdown, Menu } from 'src/common/components';
import FaveStar from 'src/components/FaveStar';
import FacePile from 'src/components/FacePile';
import { handleChartDelete, CardStyles } from '../utils';

interface ChartCardProps {
  chart: Chart;
  hasPerm: (perm: string) => boolean;
  openChartEditModal: (chart: Chart) => void;
  bulkSelectEnabled: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  refreshData: () => void;
  loading?: boolean;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  chartFilter?: string;
  userId?: number;
  showThumbnails?: boolean;
  handleBulkChartExport: (chartsToExport: Chart[]) => void;
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
  showThumbnails,
  saveFavoriteStatus,
  favoriteStatus,
  chartFilter,
  userId,
  handleBulkChartExport,
}: ChartCardProps) {
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport =
    hasPerm('can_export') && isFeatureEnabled(FeatureFlag.VERSIONED_EXPORT);
  const theme = useTheme();

  const menu = (
    <Menu>
      {canDelete && (
        <Menu.Item>
          <ConfirmStatusChange
            title={t('Please confirm')}
            description={
              <>
                {t('Are you sure you want to delete')} <b>{chart.slice_name}</b>
                ?
              </>
            }
            onConfirm={() =>
              handleChartDelete(
                chart,
                addSuccessToast,
                addDangerToast,
                refreshData,
                chartFilter,
                userId,
              )
            }
          >
            {confirmDelete => (
              <div
                data-test="chart-list-delete-option"
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={confirmDelete}
              >
                <Icons.Trash iconSize="l" /> {t('Delete')}
              </div>
            )}
          </ConfirmStatusChange>
        </Menu.Item>
      )}
      {canExport && (
        <Menu.Item>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleBulkChartExport([chart])}
          >
            <Icons.Share iconSize="l" /> {t('Export')}
          </div>
        </Menu.Item>
      )}
      {canEdit && (
        <Menu.Item>
          <div
            data-test="chart-list-edit-option"
            role="button"
            tabIndex={0}
            onClick={() => openChartEditModal(chart)}
          >
            <Icons.EditAlt iconSize="l" /> {t('Edit')}
          </div>
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <CardStyles
      onClick={() => {
        if (!bulkSelectEnabled && chart.url) {
          window.location.href = chart.url;
        }
      }}
    >
      <ListViewCard
        loading={loading}
        title={chart.slice_name}
        certifiedBy={chart.certified_by}
        certificationDetails={chart.certification_details}
        cover={
          !isFeatureEnabled(FeatureFlag.THUMBNAILS) || !showThumbnails ? (
            <></>
          ) : null
        }
        url={bulkSelectEnabled ? undefined : chart.url}
        imgURL={chart.thumbnail_url || ''}
        imgFallbackURL="/static/assets/images/chart-card-fallback.svg"
        description={t('Modified %s', chart.changed_on_delta_humanized)}
        coverLeft={<FacePile users={chart.owners || []} />}
        coverRight={
          <Label type="secondary">{chart.datasource_name_text}</Label>
        }
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <FaveStar
              itemId={chart.id}
              saveFaveStar={saveFavoriteStatus}
              isStarred={favoriteStatus}
            />
            <Dropdown overlay={menu}>
              <Icons.MoreVert iconColor={theme.colors.grayscale.base} />
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}
