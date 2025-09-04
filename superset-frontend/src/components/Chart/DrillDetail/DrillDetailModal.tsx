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

import { useContext, useEffect, useMemo, useState } from 'react';
import {
  BinaryQueryObjectFilterClause,
  css,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import { getExploreUrl } from 'src/explore/exploreUtils';
import { Button, Modal } from '@superset-ui/core/components';
import { useSelector } from 'react-redux';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import { Slice } from 'src/types/Chart';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getFormDataWithDashboardContext } from 'src/explore/controlUtils/getFormDataWithDashboardContext';
import { useDashboardFormData } from 'src/dashboard/hooks/useDashboardFormData';
import { Dataset } from '../types';
import DrillDetailPane from './DrillDetailPane';

interface ModalFooterProps {
  canExplore: boolean;
  closeModal?: () => void;
  showEditButton: boolean;
  exploreUrl: string;
}

const ModalFooter = ({
  canExplore,
  closeModal,
  showEditButton,
  exploreUrl,
}: ModalFooterProps) => {
  const theme = useTheme();

  return (
    <>
      {!isEmbedded() && showEditButton && (
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          href={canExplore ? exploreUrl : undefined}
          disabled={!canExplore}
          tooltip={
            !canExplore
              ? t('You do not have sufficient permissions to explore the chart')
              : undefined
          }
        >
          {t('Explore')}
        </Button>
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
  const dashboardPageId = useContext(DashboardPageIdContext);
  const { addDangerToast } = useToasts();
  const [exploreUrl, setExploreUrl] = useState('');

  const { slice_name: chartName } = useSelector(
    (state: { sliceEntities: { slices: Record<number, Slice> } }) =>
      state.sliceEntities?.slices?.[chartId] || {},
  );
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );

  // Determine if we should show the Explore button
  const showEditButton = Boolean(dataset?.drill_through_chart_id);

  // Get dashboard context for the drill-through chart using the proper hook
  const dashboardContextFormData = useDashboardFormData(
    dataset?.drill_through_chart_id,
  );

  // Generate formData for drill-through chart using proper dashboard context resolution
  const drillThroughFormData = useMemo(() => {
    if (!dataset?.drill_through_chart_id || !dataset?.id) {
      return null;
    }

    // Create base formData for the drill-through chart
    const drillThroughBaseFormData = {
      slice_id: dataset.drill_through_chart_id,
      datasource: `${dataset.id}__table`,
      viz_type: 'table', // Default viz type
    };

    // Use the proper dashboard context mixing function
    return getFormDataWithDashboardContext(
      drillThroughBaseFormData,
      dashboardContextFormData,
    );
  }, [dataset?.drill_through_chart_id, dataset?.id, dashboardContextFormData]);

  // Generate simple explore URL for the drill-through chart
  useEffect(() => {
    // Early return if not ready to generate URL
    if (isEmbedded() || !showModal || !dataset?.drill_through_chart_id) {
      setExploreUrl('');
      return;
    }

    try {
      // Simple formData with just the drill-through chart ID and datasource
      const simpleFormData = {
        slice_id: dataset.drill_through_chart_id,
        datasource: `${dataset.id}__table`,
        viz_type: 'table', // Default to table for now
      };

      const url = getExploreUrl({
        formData: simpleFormData,
        method: 'GET',
        endpointType: 'base',
      });

      if (url) {
        // Add dashboard_page_id if available
        const finalUrl = dashboardPageId
          ? `${url}${url.includes('?') ? '&' : '?'}dashboard_page_id=${dashboardPageId}`
          : url;
        setExploreUrl(finalUrl);
      } else {
        setExploreUrl('');
      }
    } catch (error) {
      addDangerToast(t('Failed to generate chart explore URL'));
    }
  }, [
    showModal,
    dashboardPageId,
    dataset?.drill_through_chart_id,
    dataset?.id,
    addDangerToast,
  ]);

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
          canExplore={canExplore}
          showEditButton={showEditButton}
          exploreUrl={exploreUrl || ''}
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
        drillThroughFormData={drillThroughFormData}
      />
    </Modal>
  );
}
