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
import { isFeatureEnabled, FeatureFlag, t, css } from '@superset-ui/core';
import { Link, useHistory } from 'react-router-dom';
import {
  ConfirmStatusChange,
  Button,
  Dropdown,
  FaveStar,
  Label,
  ListViewCard,
  Icons,
  MenuItem,
} from '@superset-ui/core/components';
import Chart from 'src/types/Chart';
import { FacePile } from 'src/components';
import { handleChartDelete, CardStyles } from 'src/views/CRUD/utils';
import { assetUrl } from 'src/utils/assetUrl';

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
  userId?: string | number;
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
  const history = useHistory();
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const menuItems: MenuItem[] = [];

  if (canEdit) {
    menuItems.push({
      key: 'edit',
      label: (
        <div
          data-test="chart-list-edit-option"
          role="button"
          tabIndex={0}
          onClick={() => openChartEditModal(chart)}
        >
          <Icons.EditOutlined
            iconSize="l"
            css={css`
              vertical-align: text-top;
            `}
          />{' '}
          {t('Edit')}
        </div>
      ),
    });
  }

  if (canExport) {
    menuItems.push({
      key: 'export',
      label: (
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleBulkChartExport([chart])}
        >
          <Icons.UploadOutlined
            iconSize="l"
            css={css`
              vertical-align: text-top;
            `}
          />{' '}
          {t('Export')}
        </div>
      ),
    });
  }

  if (canDelete) {
    menuItems.push({
      key: 'delete',
      label: (
        <ConfirmStatusChange
          title={t('Please confirm')}
          description={
            <>
              {t('Are you sure you want to delete')} <b>{chart.slice_name}</b>?
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
              <Icons.DeleteOutlined
                iconSize="l"
                css={css`
                  vertical-align: text-top;
                `}
              />{' '}
              {t('Delete')}
            </div>
          )}
        </ConfirmStatusChange>
      ),
    });
  }

  return (
    <CardStyles
      onClick={() => {
        if (!bulkSelectEnabled && chart.url) {
          history.push(chart.url);
        }
      }}
    >
      <ListViewCard
        loading={loading}
        title={chart.slice_name}
        certifiedBy={chart.certified_by}
        certificationDetails={chart.certification_details}
        cover={
          !isFeatureEnabled(FeatureFlag.Thumbnails) || !showThumbnails ? (
            <></>
          ) : null
        }
        url={bulkSelectEnabled ? undefined : chart.url}
        imgURL={chart.thumbnail_url || ''}
        imgFallbackURL={assetUrl(
          '/static/assets/images/chart-card-fallback.svg',
        )}
        description={t('Modified %s', chart.changed_on_delta_humanized)}
        coverLeft={<FacePile users={chart.owners || []} />}
        coverRight={<Label>{chart.datasource_name_text}</Label>}
        linkComponent={Link}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {userId && (
              <FaveStar
                itemId={chart.id}
                saveFaveStar={saveFavoriteStatus}
                isStarred={favoriteStatus}
              />
            )}
            <Dropdown menu={{ items: menuItems }} trigger={['click', 'hover']}>
              <Button buttonSize="xsmall" type="link" buttonStyle="link">
                <Icons.MoreOutlined iconSize="xl" />
              </Button>
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}
