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
import { t } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { css } from '@apache-superset/core/theme';
import { Link, useHistory } from 'react-router-dom';
import {
  ConfirmStatusChange,
  FaveStar,
  Icons,
  Label,
  ListViewCard,
  MenuItem,
  Tooltip,
} from '@superset-ui/core/components';
import Chart from 'src/types/Chart';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import { KebabMenuButton } from 'src/components';
import { handleChartDelete, CardStyles } from 'src/views/CRUD/utils';
import { assetUrl } from 'src/utils/assetUrl';
import type { ListViewFetchDataConfig as FetchDataConfig } from 'src/components';
import { TableTab } from 'src/views/CRUD/types';
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

interface ChartCardProps {
  chart: Chart;
  hasPerm: (perm: string) => boolean;
  openChartEditModal: (chart: Chart) => void;
  bulkSelectEnabled: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  refreshData: (config?: FetchDataConfig | null) => void;
  loading?: boolean;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  chartFilter?: string;
  user?: UserWithPermissionsAndRoles;
  showThumbnails?: boolean;
  handleBulkChartExport: (chartsToExport: Chart[]) => void;
  getData?: (tab: TableTab) => void;
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
  user,
  handleBulkChartExport,
  getData,
}: ChartCardProps) {
  const userId = user?.userId;

  const history = useHistory();
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const allowEdit = isUserEditorOrAdmin(user, chart.editors);
  const menuItems: MenuItem[] = [];

  if (canEdit) {
    menuItems.push({
      key: 'edit',
      label: (
        <Tooltip
          title={
            allowEdit
              ? null
              : t(
                  'You must be a chart editor in order to edit. Please reach out to a chart editor to request modifications or edit access.',
                )
          }
        >
          <button
            type="button"
            css={menuItemButtonCss}
            data-test="chart-list-edit-option"
            onClick={allowEdit ? () => openChartEditModal(chart) : undefined}
          >
            <Icons.EditOutlined
              iconSize="l"
              css={css`
                vertical-align: text-top;
              `}
            />{' '}
            {t('Edit')}
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
          data-test="chart-list-export-option"
          onClick={() => handleBulkChartExport([chart])}
        >
          <Icons.UploadOutlined
            iconSize="l"
            css={css`
              vertical-align: text-top;
            `}
          />{' '}
          {t('Export')}
        </button>
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
              getData,
            )
          }
        >
          {confirmDelete => (
            <Tooltip
              title={
                allowEdit
                  ? null
                  : t(
                      'You must be a chart editor in order to delete. Please reach out to a chart editor to request modifications or edit access.',
                    )
              }
            >
              <button
                type="button"
                css={menuItemButtonCss}
                data-test="chart-list-delete-option"
                className="action-button"
                onClick={allowEdit ? confirmDelete : undefined}
              >
                <Icons.DeleteOutlined
                  iconSize="l"
                  css={css`
                    vertical-align: text-top;
                  `}
                />{' '}
                {t('Delete')}
              </button>
            </Tooltip>
          )}
        </ConfirmStatusChange>
      ),
      disabled: !allowEdit,
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
        coverLeft={<SubjectPile subjects={chart.editors || []} />}
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
            <KebabMenuButton menuItems={menuItems} dataTest="chart-card-menu" />
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}
