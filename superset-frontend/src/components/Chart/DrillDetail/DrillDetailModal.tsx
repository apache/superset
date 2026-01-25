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

import { useCallback, useContext, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core';
import {
  BinaryQueryObjectFilterClause,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Button, Modal, Dropdown } from '@superset-ui/core/components';
import { useSelector, useDispatch } from 'react-redux';
import { Icons } from '@superset-ui/core/components/Icons';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import { Slice } from 'src/types/Chart';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { safeStringify } from 'src/utils/safeStringify';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { Dataset } from '../types';
import DrillDetailPane from './DrillDetailPane';
import { getDrillPayload } from './utils';

interface ModalFooterProps {
  canExplore: boolean;
  canDownload: boolean;
  closeModal?: () => void;
  exploreChart: () => void;
  onDownloadCSV: () => void;
  onDownloadXLSX: () => void;
}

const ModalFooter = ({
  canExplore,
  canDownload,
  closeModal,
  exploreChart,
  onDownloadCSV,
  onDownloadXLSX,
}: ModalFooterProps) => {
  const theme = useTheme();

  return (
    <>
      {!isEmbedded() && (
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          onClick={exploreChart}
          disabled={!canExplore}
          tooltip={
            !canExplore
              ? t('You do not have sufficient permissions to edit the chart')
              : undefined
          }
        >
          {t('Edit chart')}
        </Button>
      )}
      {canDownload && (
        <Dropdown
          trigger={['click']}
          menu={{
            onClick: ({ key }) => {
              if (key === 'csv') {
                onDownloadCSV();
              } else if (key === 'xlsx') {
                onDownloadXLSX();
              }
            },
            items: [
              {
                key: 'csv',
                label: t('Export to CSV'),
                icon: <Icons.FileOutlined />,
              },
              {
                key: 'xlsx',
                label: t('Export to Excel'),
                icon: <Icons.FileOutlined />,
              },
            ],
          }}
        >
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            css={css`
              margin-left: ${theme.sizeUnit * 2}px;
            `}
            data-test="drill-detail-download-btn"
          >
            {t('Download')} <Icons.DownOutlined />
          </Button>
        </Dropdown>
      )}
      <Button
        buttonStyle="primary"
        buttonSize="small"
        onClick={closeModal}
        data-test="close-drilltodetail-modal"
        css={css`
          margin-left: ${theme.sizeUnit * 2}px;
        `}
      >
        {t('Close')}
      </Button>
    </>
  );
};

interface DrillDetailModalProps {
  chartId: number;
  formData: QueryFormData;
  initialFilters: BinaryQueryObjectFilterClause[];
  showModal: boolean;
  onHideModal: () => void;
  dataset?: Dataset;
}

export default function DrillDetailModal({
  chartId,
  formData,
  initialFilters,
  showModal,
  onHideModal,
  dataset,
}: DrillDetailModalProps) {
  const theme = useTheme();
  const history = useHistory();
  const dispatch = useDispatch();
  const dashboardPageId = useContext(DashboardPageIdContext);
  const { slice_name: chartName } = useSelector(
    (state: { sliceEntities: { slices: Record<number, Slice> } }) =>
      state.sliceEntities?.slices?.[chartId] || {},
  );
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );
  const canDownload = useSelector((state: RootState) =>
    findPermission('can_csv', 'Superset', state.user?.roles),
  );
  const samplesRowLimit = useSelector(
    (state: { common: { conf: { SAMPLES_ROW_LIMIT?: number } } }) =>
      state.common?.conf?.SAMPLES_ROW_LIMIT ?? 1000,
  );

  const exploreUrl = useMemo(
    () => `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${chartId}`,
    [chartId, dashboardPageId],
  );

  const exploreChart = useCallback(() => {
    history.push(exploreUrl);
  }, [exploreUrl, history]);

  const handleDownload = useCallback(
    (exportType: 'csv' | 'xlsx') => {
      const drillPayload = getDrillPayload(formData, initialFilters);

      if (!drillPayload) {
        dispatch(addDangerToast(t('Unable to generate download payload')));
        return;
      }

      if (!formData.datasource || typeof formData.datasource !== 'string') {
        dispatch(addDangerToast(t('Invalid datasource configuration')));
        return;
      }

      const datasourceParts = formData.datasource.split('__');
      if (datasourceParts.length !== 2) {
        dispatch(addDangerToast(t('Invalid datasource format')));
        return;
      }

      const [datasourceId, datasourceType] = datasourceParts;

      // Build a QueryContext for drill detail (raw samples, not aggregated)
      // This matches what DrillDetailPane does when fetching data
      const payload = {
        datasource: {
          id: parseInt(datasourceId, 10),
          type: datasourceType,
        },
        queries: [
          {
            ...drillPayload,
            columns: [],
            metrics: [],
            orderby: [],
            row_limit: samplesRowLimit,
            row_offset: 0,
          },
        ],
        result_type: 'drill_detail',
        result_format: exportType,
        force: false,
      };

      // Use postForm to trigger browser download directly (no progress modal)
      // This matches the behavior of existing chart exports
      SupersetClient.postForm(ensureAppRoot('/api/v1/chart/data'), {
        form_data: safeStringify(payload),
      }).catch(error => {
        dispatch(
          addDangerToast(
            t('Failed to generate download: %s', error.message || error),
          ),
        );
      });
    },
    [formData, initialFilters, dispatch, samplesRowLimit],
  );

  const handleDownloadCSV = useCallback(() => {
    handleDownload('csv');
  }, [handleDownload]);

  const handleDownloadXLSX = useCallback(() => {
    handleDownload('xlsx');
  }, [handleDownload]);

  return (
    <Modal
      show={showModal}
      onHide={onHideModal ?? (() => null)}
      css={css`
        .ant-modal-body {
          display: flex;
          flex-direction: column;
        }
      `}
      name={t('Drill to detail: %s', chartName)}
      title={t('Drill to detail: %s', chartName)}
      footer={
        <ModalFooter
          exploreChart={exploreChart}
          canExplore={canExplore}
          canDownload={canDownload}
          onDownloadCSV={handleDownloadCSV}
          onDownloadXLSX={handleDownloadXLSX}
          closeModal={onHideModal}
        />
      }
      responsive
      resizable
      resizableConfig={{
        minHeight: theme.sizeUnit * 128,
        minWidth: theme.sizeUnit * 128,
        defaultSize: {
          width: 'auto',
          height: '75vh',
        },
      }}
      draggable
      destroyOnHidden
      maskClosable={false}
    >
      <DrillDetailPane
        formData={formData}
        initialFilters={initialFilters}
        dataset={dataset}
      />
    </Modal>
  );
}
