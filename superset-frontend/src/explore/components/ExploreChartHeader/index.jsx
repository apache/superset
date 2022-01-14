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
import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import Icons from 'src/components/Icons';
import {
  CategoricalColorNamespace,
  SupersetClient,
  styled,
  t,
} from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import ReportModal from 'src/components/ReportModal';
import {
  fetchUISpecificReport,
  toggleActive,
  deleteActiveReport,
} from 'src/reports/actions/reports';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import HeaderReportActionsDropdown from 'src/components/ReportModal/HeaderReportActionsDropdown';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import EditableTitle from 'src/components/EditableTitle';
import AlteredSliceTag from 'src/components/AlteredSliceTag';
import FaveStar from 'src/components/FaveStar';
import Timer from 'src/components/Timer';
import CachedLabel from 'src/components/CachedLabel';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import CertifiedBadge from 'src/components/CertifiedBadge';
import ExploreActionButtons from '../ExploreActionButtons';
import RowCountLabel from '../RowCountLabel';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  dashboardId: PropTypes.number,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  ownState: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
};

const StyledHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .title-panel {
    display: flex;
    align-items: center;
  }

  .right-button-panel {
    display: flex;
    align-items: center;

    > .btn-group {
      flex: 0 0 auto;
      margin-left: ${({ theme }) => theme.gridUnit}px;
    }
  }

  .action-button {
    color: ${({ theme }) => theme.colors.grayscale.base};
    margin: 0 ${({ theme }) => theme.gridUnit * 1.5}px 0
      ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledButtons = styled.span`
  display: flex;
  align-items: center;
`;

export const ExploreChartHeader = ({
  actions,
  can_download: canDownload,
  can_overwrite: canOverwrite,
  chart,
  dashboardId,
  deleteActiveReport,
  fetchUISpecificReport,
  form_data: formData,
  isStarred,
  ownState,
  reports,
  slice,
  sliceName,
  sliceUpdated,
  table_name: tableName,
  timeout,
  toggleActive,
  user,
}) => {
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);
  const [showingReportModal, setShowingReportModal] = useState(false);

  const fetchChartDashboardData = async () => {
    await SupersetClient.get({
      endpoint: `/api/v1/chart/${slice.slice_id}`,
    })
      .then(res => {
        const response = res?.json?.result;
        if (response && response.dashboards && response.dashboards.length) {
          const { dashboards } = response;
          const dashboard =
            dashboardId &&
            dashboards.length &&
            dashboards.find(d => d.id === dashboardId);

          if (dashboard && dashboard.json_metadata) {
            // setting the chart to use the dashboard custom label colors if any
            const labelColors =
              JSON.parse(dashboard.json_metadata).label_colors || {};
            const categoricalNamespace =
              CategoricalColorNamespace.getNamespace();

            Object.keys(labelColors).forEach(label => {
              categoricalNamespace.setColor(label, labelColors[label]);
            });
          }
        }
      })
      .catch(() => {});
  };

  const getSliceName = () => {
    const title = sliceName || t('%s - untitled', tableName);

    return title;
  };

  const postChartFormData = () => {
    actions.postChartFormData(formData, true, timeout, chart.id, ownState);
  };

  const openPropertiesModal = () => {
    setIsPropertiesModalOpen(true);
  };

  const closePropertiesModal = () => {
    setIsPropertiesModalOpen(false);
  };

  const showReportModal = () => {
    setShowingReportModal(true);
  };

  const hideReportModal = () => {
    setShowingReportModal(false);
  };

  const renderReportModal = () => {
    const attachedReportExists = !!Object.keys(reports).length;
    return attachedReportExists ? (
      <HeaderReportActionsDropdown
        showReportModal={showReportModal}
        hideReportModal={hideReportModal}
        toggleActive={toggleActive}
        deleteActiveReport={deleteActiveReport}
      />
    ) : (
      <>
        <span
          role="button"
          title={t('Schedule email report')}
          tabIndex={0}
          className="action-button"
          onClick={showReportModal}
        >
          <Icons.Calendar />
        </span>
      </>
    );
  };

  const canAddReports = () => {
    if (!isFeatureEnabled(FeatureFlag.ALERT_REPORTS)) {
      return false;
    }
    if (!user?.userId) {
      // this is in the case that there is an anonymous user.
      return false;
    }
    const roles = Object.keys(user.roles || []);
    const permissions = roles.map(key =>
      user.roles[key].filter(
        perms => perms[0] === 'menu_access' && perms[1] === 'Manage',
      ),
    );
    return permissions[0].length > 0;
  };

  useEffect(() => {
    if (canAddReports()) {
      fetchUISpecificReport(user.userId, 'chart_id', 'charts', chart.id);
    }
    if (dashboardId) {
      fetchChartDashboardData();
    }
  }, [
    canAddReports,
    fetchUISpecificReport,
    user.userId,
    chart.id,
    dashboardId,
    fetchChartDashboardData,
  ]);

  const {
    chartStatus,
    chartUpdateEndTime,
    chartUpdateStartTime,
    latestQueryFormData,
    queriesResponse,
  } = chart;
  // TODO: when will get appropriate design for multi queries use all results and not first only
  const queryResponse = queriesResponse?.[0];
  const chartFinished = ['failed', 'rendered', 'success'].includes(
    chart.chartStatus,
  );
  return (
    <StyledHeader id="slice-header" className="panel-title-large">
      <div className="title-panel">
        {slice?.certified_by && (
          <>
            <CertifiedBadge
              certifiedBy={slice.certified_by}
              details={slice.certification_details}
            />{' '}
          </>
        )}
        <EditableTitle
          title={getSliceName()}
          canEdit={
            !slice ||
            canOverwrite ||
            (slice?.owners || []).includes(user?.userId)
          }
          onSaveTitle={actions.updateChartTitle}
        />

        {slice && (
          <StyledButtons>
            {user.userId && (
              <FaveStar
                itemId={slice.slice_id}
                fetchFaveStar={actions.fetchFaveStar}
                saveFaveStar={actions.saveFaveStar}
                isStarred={isStarred}
                showTooltip
              />
            )}
            {isPropertiesModalOpen && (
              <PropertiesModal
                show={isPropertiesModalOpen}
                onHide={closePropertiesModal}
                onSave={sliceUpdated}
                slice={slice}
              />
            )}
            <Tooltip id="edit-desc-tooltip" title={t('Edit chart properties')}>
              <span
                aria-label={t('Edit chart properties')}
                role="button"
                tabIndex={0}
                className="edit-desc-icon"
                onClick={openPropertiesModal}
              >
                <i className="fa fa-edit" />
              </span>
            </Tooltip>
            {chart.sliceFormData && (
              <AlteredSliceTag
                className="altered"
                origFormData={chart.sliceFormData}
                currentFormData={formData}
              />
            )}
          </StyledButtons>
        )}
      </div>
      <div className="right-button-panel">
        {chartFinished && queryResponse && (
          <RowCountLabel
            rowcount={Number(queryResponse.rowcount) || 0}
            limit={Number(formData.row_limit) || 0}
          />
        )}
        {chartFinished && queryResponse && queryResponse.is_cached && (
          <CachedLabel
            onClick={postChartFormData}
            cachedTimestamp={queryResponse.cached_dttm}
          />
        )}
        <Timer
          startTime={chartUpdateStartTime}
          endTime={chartUpdateEndTime}
          isRunning={chartStatus === 'loading'}
          status={CHART_STATUS_MAP[chartStatus]}
        />
        {canAddReports() && renderReportModal()}
        <ReportModal
          show={showingReportModal}
          onHide={hideReportModal}
          props={{
            userId: user.userId,
            userEmail: user.email,
            chart,
            creationMethod: 'charts',
          }}
        />
        <ExploreActionButtons
          actions={{
            ...actions,
            openPropertiesModal,
          }}
          slice={slice}
          canDownloadCSV={canDownload}
          chartStatus={chartStatus}
          latestQueryFormData={latestQueryFormData}
          queryResponse={queryResponse}
        />
      </div>
    </StyledHeader>
  );
};

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    { sliceUpdated, fetchUISpecificReport, toggleActive, deleteActiveReport },
    dispatch,
  );
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
