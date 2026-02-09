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
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { QueryFormData, JsonObject } from '@superset-ui/core';
import {
  Tooltip,
  Button,
  DeleteModal,
  UnsavedChangesModal,
} from '@superset-ui/core/components';
import { AlteredSliceTag } from 'src/components';
import {
  SupersetClient,
  isMatrixifyEnabled,
  MatrixifyFormData,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core';
import { css, t, SupersetTheme } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import { PageHeaderWithActions } from '@superset-ui/core/components/PageHeaderWithActions';
import { setSaveChartModalVisibility } from 'src/explore/actions/saveModalActions';
import { applyColors, resetColors } from 'src/utils/colorScheme';
import ReportModal from 'src/features/reports/ReportModal';
import { deleteActiveReport } from 'src/features/reports/ReportModal/actions';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { getChartFormDiffs } from 'src/utils/getChartFormDiffs';
import { StreamingExportModal } from 'src/components/StreamingExportModal';
import { Tag } from 'src/components/Tag';
import { ChartState, ExplorePageInitialData } from 'src/explore/types';
import { Slice } from 'src/types/Chart';
import { ReportObject } from 'src/features/reports/types';
import { User } from 'src/types/bootstrapTypes';
import { useExploreAdditionalActionsMenu } from '../useExploreAdditionalActionsMenu';
import { useExploreMetadataBar } from './useExploreMetadataBar';

interface ExploreActions {
  updateChartTitle: (title: string) => void;
  fetchFaveStar: (sliceId: number) => void;
  saveFaveStar: (sliceId: number, isStarred: boolean) => void;
  redirectSQLLab: (
    formData: QueryFormData,
    history?: ReturnType<typeof useHistory> | false,
  ) => void;
}

export interface ExploreChartHeaderProps {
  actions: ExploreActions;
  canOverwrite: boolean;
  canDownload: boolean;
  dashboardId?: number;
  colorScheme?: string;
  isStarred: boolean;
  slice?: Slice | null;
  sliceName?: string;
  table_name?: string;
  formData?: QueryFormData;
  ownState?: JsonObject;
  timeout?: number;
  chart: ChartState;
  user: User;
  saveDisabled?: boolean;
  metadata?: ExplorePageInitialData['metadata'];
  isSaveModalVisible?: boolean;
}

const saveButtonStyles = (theme: SupersetTheme) => css`
  color: ${theme.colorPrimaryText};
  & > span[role='img'] {
    margin-right: 0;
  }
`;

const additionalItemsStyles = (theme: SupersetTheme) => css`
  display: flex;
  align-items: center;
  margin-left: ${theme.sizeUnit}px;
  & > span {
    margin-right: ${theme.sizeUnit * 3}px;
  }
`;

export const ExploreChartHeader: FC<ExploreChartHeaderProps> = ({
  dashboardId,
  colorScheme: dashboardColorScheme,
  slice,
  actions,
  formData,
  ownState,
  chart,
  user,
  canOverwrite,
  canDownload,
  isStarred,
  sliceName,
  saveDisabled,
  metadata,
  isSaveModalVisible,
}) => {
  const dispatch = useDispatch();
  const { latestQueryFormData, sliceFormData } = chart;
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentReportDeleting, setCurrentReportDeleting] =
    useState<ReportObject | null>(null);
  const [shouldForceCloseModal, setShouldForceCloseModal] = useState(false);

  const updateCategoricalNamespace = useCallback(async () => {
    const { dashboards } = metadata || {};
    const dashboard =
      dashboardId && dashboards && dashboards.find(d => d.id === dashboardId);

    if (!dashboard || !dashboardColorScheme) {
      // clean up color namespace and shared color maps
      // to avoid colors spill outside of dashboard context
      resetColors(metadata?.color_namespace);
    }

    if (dashboard) {
      try {
        // Dashboards from metadata don't contain the json_metadata field
        // to avoid unnecessary payload. Here we query for the dashboard json_metadata.
        const response = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboard.id}`,
        });
        const result = response?.json?.result;

        // setting the chart to use the dashboard custom label colors if any
        const dashboardMetadata = JSON.parse(result.json_metadata);
        // ensure consistency with the dashboard
        applyColors(dashboardMetadata);
      } catch (error) {
        logging.info(t('Unable to retrieve dashboard colors'));
      }
    }
  }, [dashboardColorScheme, dashboardId, metadata]);

  useEffect(() => {
    updateCategoricalNamespace();
  }, [updateCategoricalNamespace]);

  const openPropertiesModal = () => {
    setIsPropertiesModalOpen(true);
  };

  const closePropertiesModal = () => {
    setIsPropertiesModalOpen(false);
  };

  const showReportModal = () => {
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);
  };

  const updateSlice = useCallback(
    (updatedSlice: Slice) => {
      dispatch(sliceUpdated(updatedSlice));
    },
    [dispatch],
  );

  const handleReportDelete = async (report: ReportObject) => {
    await dispatch(deleteActiveReport(report));
    setCurrentReportDeleting(null);
  };

  const history = useHistory();
  const { redirectSQLLab } = actions;

  const redirectToSQLLab = useCallback(
    (redirectFormData: QueryFormData, openNewWindow = false) => {
      redirectSQLLab(redirectFormData, !openNewWindow && history);
    },
    [redirectSQLLab, history],
  );

  const [menu, isDropdownVisible, setIsDropdownVisible, streamingExportState] =
    useExploreAdditionalActionsMenu(
      latestQueryFormData,
      canDownload,
      slice,
      redirectToSQLLab,
      openPropertiesModal,
      ownState,
      metadata?.dashboards,
      showReportModal,
      setCurrentReportDeleting,
    );

  const metadataBar = useExploreMetadataBar(metadata, slice ?? null);
  const oldSliceName = slice?.slice_name;

  // Capture initial form data for new charts
  const [initialFormDataForNewChart] = useState(() =>
    !slice ? { ...formData, chartTitle: oldSliceName } : null,
  );

  const originalFormData = useMemo(() => {
    // For new charts (no slice), use the captured initial formData
    if (!slice && initialFormDataForNewChart) {
      return initialFormDataForNewChart;
    }
    // For existing charts, use the saved sliceFormData if available
    if (!sliceFormData) return {};
    return {
      ...sliceFormData,
      chartTitle: oldSliceName,
    };
  }, [sliceFormData, oldSliceName, slice, initialFormDataForNewChart]);

  const currentFormData = useMemo(
    () => ({ ...formData, chartTitle: sliceName }),
    [formData, sliceName],
  );

  const formDiffs = useMemo(
    () => getChartFormDiffs(originalFormData, currentFormData),
    [originalFormData, currentFormData],
  );

  const hasUnsavedChanges = Object.keys(formDiffs).length > 0;

  const {
    showModal: showUnsavedChangesModal,
    setShowModal: setShowUnsavedChangesModal,
    handleConfirmNavigation,
    handleSaveAndCloseModal,
    triggerManualSave,
  } = useUnsavedChangesPrompt({
    hasUnsavedChanges,
    onSave: () => {
      dispatch(setSaveChartModalVisibility(true));
    },
    isSaveModalVisible,
    manualSaveOnUnsavedChanges: true,
  });

  const showModal = useCallback(() => {
    triggerManualSave();
  }, [triggerManualSave]);

  useEffect(() => {
    if (!isSaveModalVisible) setShouldForceCloseModal(true);
  }, [isSaveModalVisible, setShowUnsavedChangesModal]);

  useEffect(() => {
    if (!showUnsavedChangesModal && shouldForceCloseModal) {
      setShouldForceCloseModal(false);
    }
  }, [showUnsavedChangesModal, shouldForceCloseModal]);

  return (
    <>
      <PageHeaderWithActions
        editableTitleProps={{
          title: sliceName ?? '',
          canEdit:
            !slice ||
            canOverwrite ||
            (user?.userId !== undefined &&
              (slice?.owners || []).includes(user.userId)),
          onSave: actions.updateChartTitle,
          placeholder: t('Add the name of the chart'),
          label: t('Chart title'),
        }}
        showTitlePanelItems={!!slice}
        certificatiedBadgeProps={{
          certifiedBy: slice?.certified_by,
          details: slice?.certification_details,
        }}
        showFaveStar={!!user?.userId && slice?.slice_id !== undefined}
        faveStarProps={{
          itemId: slice?.slice_id ?? 0,
          fetchFaveStar: actions.fetchFaveStar,
          saveFaveStar: actions.saveFaveStar,
          isStarred,
          showTooltip: true,
        }}
        titlePanelAdditionalItems={
          <div css={additionalItemsStyles}>
            {sliceFormData ? (
              <AlteredSliceTag
                className="altered"
                diffs={formDiffs}
                origFormData={originalFormData as QueryFormData}
                currentFormData={currentFormData as QueryFormData}
              />
            ) : null}
            {formData && isMatrixifyEnabled(formData as MatrixifyFormData) && (
              <Tag name="Matrixified" color="purple" />
            )}
            {metadataBar}
          </div>
        }
        rightPanelAdditionalItems={
          <Tooltip
            title={
              saveDisabled
                ? t('Add required control values to save chart')
                : null
            }
          >
            {/* needed to wrap button in a div - antd tooltip doesn't work with disabled button */}
            <div>
              <Button
                buttonStyle="secondary"
                onClick={showModal}
                disabled={saveDisabled}
                data-test="query-save-button"
                css={saveButtonStyles}
                icon={<Icons.SaveOutlined />}
              >
                {t('Save')}
              </Button>
            </div>
          </Tooltip>
        }
        additionalActionsMenu={menu}
        menuDropdownProps={{
          open: isDropdownVisible,
          onOpenChange: setIsDropdownVisible,
        }}
      />
      {isPropertiesModalOpen && (
        <PropertiesModal
          show={isPropertiesModalOpen}
          onHide={closePropertiesModal}
          onSave={updateSlice}
          slice={slice}
        />
      )}

      <ReportModal
        userId={user.userId}
        show={isReportModalOpen}
        onHide={closeReportModal}
        userEmail={user.email}
        dashboardId={dashboardId}
        chart={chart}
        creationMethod="charts"
      />

      {currentReportDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete %s.',
            currentReportDeleting?.name,
          )}
          onConfirm={() => {
            if (currentReportDeleting) {
              handleReportDelete(currentReportDeleting);
            }
          }}
          onHide={() => setCurrentReportDeleting(null)}
          open
          title={t('Delete Report?')}
        />
      )}

      <UnsavedChangesModal
        title={t('Save changes to your chart?')}
        body={t("If you don't save, changes will be lost.")}
        showModal={showUnsavedChangesModal}
        onHide={() => setShowUnsavedChangesModal(false)}
        onConfirmNavigation={handleConfirmNavigation}
        handleSave={handleSaveAndCloseModal}
      />

      <StreamingExportModal
        visible={streamingExportState.isVisible}
        onCancel={streamingExportState.onCancel}
        onRetry={streamingExportState.onRetry}
        onDownload={streamingExportState.onDownload}
        progress={streamingExportState.progress}
      />
    </>
  );
};

export default ExploreChartHeader;
