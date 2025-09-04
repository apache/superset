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

import { useContext, useMemo, useState } from 'react';
import {
  BinaryQueryObjectFilterClause,
  css,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
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
import { postFormData } from 'src/explore/exploreUtils/formData';
import { mountExploreUrl } from 'src/explore/exploreUtils';
import { URL_PARAMS } from 'src/constants';
import { Dataset } from '../types';
import DrillDetailPane from './DrillDetailPane';

interface ModalFooterProps {
  canExplore: boolean;
  closeModal?: () => void;
  showEditButton: boolean;
  onExploreClick?: (event: React.MouseEvent) => void;
  isGeneratingUrl: boolean;
}

const ModalFooter = ({
  canExplore,
  closeModal,
  showEditButton,
  onExploreClick,
  isGeneratingUrl,
}: ModalFooterProps) => {
  const theme = useTheme();

  return (
    <>
      {!isEmbedded() && showEditButton && (
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          onClick={canExplore ? onExploreClick : undefined}
          disabled={!canExplore || isGeneratingUrl}
          loading={isGeneratingUrl}
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
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

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

    // Use the enhanced dashboard context function that handles drill-to-detail filters
    return getFormDataWithDashboardContext(
      drillThroughBaseFormData,
      dashboardContextFormData,
      undefined, // saveAction
      initialFilters, // drillToDetailFilters - drill-down filters from context menu
    );
  }, [
    dataset?.drill_through_chart_id,
    dataset?.id,
    dashboardContextFormData,
    initialFilters,
  ]);

  // Handle explore button click - generate URL and navigate
  const handleExploreClick = async (event: React.MouseEvent) => {
    event.preventDefault();

    if (
      !dataset?.drill_through_chart_id ||
      !drillThroughFormData ||
      !dataset?.id
    ) {
      return;
    }

    setIsGeneratingUrl(true);

    try {
      const key = await postFormData(
        dataset.id, // datasourceId
        'table', // datasourceType
        drillThroughFormData, // our perfectly crafted formData with dashboard context + drill-down filters
        dataset.drill_through_chart_id, // chartId
      );

      const baseUrl = mountExploreUrl(null, {
        [URL_PARAMS.formDataKey.name]: key,
      });

      // Add dashboard_page_id if available
      const finalUrl = dashboardPageId
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}dashboard_page_id=${dashboardPageId}`
        : baseUrl;

      // Navigate to the explore page
      window.location.href = finalUrl;
    } catch (error) {
      console.error('Failed to generate chart explore URL:', error);
      addDangerToast(t('Failed to generate chart explore URL'));
      setIsGeneratingUrl(false);
    }
  };

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
          onExploreClick={handleExploreClick}
          isGeneratingUrl={isGeneratingUrl}
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
