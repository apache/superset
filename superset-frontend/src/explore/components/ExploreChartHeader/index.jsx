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
import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip } from 'src/components/Tooltip';
import { css, logging, SupersetClient, t } from '@superset-ui/core';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import AlteredSliceTag from 'src/components/AlteredSliceTag';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { setSaveChartModalVisibility } from 'src/explore/actions/saveModalActions';
import { applyColors, resetColors } from 'src/utils/colorScheme';
import ReportModal from 'src/features/reports/ReportModal';
import DeleteModal from 'src/components/DeleteModal';
import { deleteActiveReport } from 'src/features/reports/ReportModal/actions';
import { useExploreAdditionalActionsMenu } from '../useExploreAdditionalActionsMenu';
import { useExploreMetadataBar } from './useExploreMetadataBar';

const propTypes = {
  actions: PropTypes.object.isRequired,
  canOverwrite: PropTypes.bool.isRequired,
  canDownload: PropTypes.bool.isRequired,
  dashboardId: PropTypes.number,
  colorScheme: PropTypes.string,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  formData: PropTypes.object,
  ownState: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
  saveDisabled: PropTypes.bool,
};

const saveButtonStyles = theme => css`
  color: ${theme.colors.primary.dark2};
  & > span[role='img'] {
    margin-right: 0;
  }
`;

const additionalItemsStyles = theme => css`
  display: flex;
  align-items: center;
  margin-left: ${theme.gridUnit}px;
  & > span {
    margin-right: ${theme.gridUnit * 3}px;
  }
`;

export const ExploreChartHeader = ({
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
}) => {
  const dispatch = useDispatch();
  const { latestQueryFormData, sliceFormData } = chart;
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentReportDeleting, setCurrentReportDeleting] = useState(null);
  const updateCategoricalNamespace = async () => {
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
  };

  useEffect(() => {
    updateCategoricalNamespace();
  }, []);

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

  const showModal = useCallback(() => {
    dispatch(setSaveChartModalVisibility(true));
  }, [dispatch]);

  const updateSlice = useCallback(
    slice => {
      dispatch(sliceUpdated(slice));
    },
    [dispatch],
  );

  const handleReportDelete = async report => {
    await dispatch(deleteActiveReport(report));
    setCurrentReportDeleting(null);
  };

  const history = useHistory();
  const { redirectSQLLab } = actions;

  const redirectToSQLLab = useCallback(
    (formData, openNewWindow = false) => {
      redirectSQLLab(formData, !openNewWindow && history);
    },
    [redirectSQLLab, history],
  );

  const [menu, isDropdownVisible, setIsDropdownVisible] =
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

  const metadataBar = useExploreMetadataBar(metadata, slice);

  const oldSliceName = slice?.slice_name;
  return (
    <>
      <PageHeaderWithActions
        editableTitleProps={{
          title: sliceName ?? '',
          canEdit:
            !slice ||
            canOverwrite ||
            (slice?.owners || []).includes(user?.userId),
          onSave: actions.updateChartTitle,
          placeholder: t('Add the name of the chart'),
          label: t('Chart title'),
        }}
        showTitlePanelItems={!!slice}
        certificatiedBadgeProps={{
          certifiedBy: slice?.certified_by,
          details: slice?.certification_details,
        }}
        showFaveStar={!!user?.userId}
        faveStarProps={{
          itemId: slice?.slice_id,
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
                origFormData={{
                  ...sliceFormData,
                  chartTitle: oldSliceName,
                }}
                currentFormData={{ ...formData, chartTitle: sliceName }}
              />
            ) : null}
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
              >
                <Icons.SaveOutlined iconSize="l" />
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
    </>
  );
};

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
