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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import {
  CategoricalColorNamespace,
  css,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import {
  fetchUISpecificReport,
  toggleActive,
  deleteActiveReport,
} from 'src/reports/actions/reports';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import AlteredSliceTag from 'src/components/AlteredSliceTag';
import FaveStar from 'src/components/FaveStar';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import CertifiedBadge from 'src/components/CertifiedBadge';
import ExploreAdditionalActionsMenu from '../ExploreAdditionalActionsMenu';
import { ChartEditableTitle } from './ChartEditableTitle';

const propTypes = {
  actions: PropTypes.object.isRequired,
  canOverwrite: PropTypes.bool.isRequired,
  canDownload: PropTypes.bool.isRequired,
  dashboardId: PropTypes.number,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
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

const headerStyles = theme => css`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: space-between;
  height: 100%;

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .title-panel {
    display: flex;
    align-items: center;
    min-width: 0;
    margin-right: ${theme.gridUnit * 12}px;
  }

  .right-button-panel {
    display: flex;
    align-items: center;
  }
`;

const buttonsStyles = theme => css`
  display: flex;
  align-items: center;
  padding-left: ${theme.gridUnit * 2}px;

  & .fave-unfave-icon {
    padding: 0 ${theme.gridUnit}px;

    &:first-child {
      padding-left: 0;
    }
  }
`;

const saveButtonContainerStyles = theme => css`
  margin-right: ${theme.gridUnit * 2}px;
`;

export class ExploreChartHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isPropertiesModalOpen: false,
    };
    this.openPropertiesModal = this.openPropertiesModal.bind(this);
    this.closePropertiesModal = this.closePropertiesModal.bind(this);
    this.fetchChartDashboardData = this.fetchChartDashboardData.bind(this);
  }

  componentDidMount() {
    const { dashboardId } = this.props;
    if (dashboardId) {
      this.fetchChartDashboardData();
    }
  }

  async fetchChartDashboardData() {
    const { dashboardId, slice } = this.props;
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
            const metadata = JSON.parse(dashboard.json_metadata);
            const sharedLabelColors = metadata.shared_label_colors || {};
            const customLabelColors = metadata.label_colors || {};
            const mergedLabelColors = {
              ...sharedLabelColors,
              ...customLabelColors,
            };

            const categoricalNamespace =
              CategoricalColorNamespace.getNamespace();

            Object.keys(mergedLabelColors).forEach(label => {
              categoricalNamespace.setColor(
                label,
                mergedLabelColors[label],
                metadata.color_scheme,
              );
            });
          }
        }
      })
      .catch(() => {});
  }

  postChartFormData() {
    this.props.actions.postChartFormData(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.id,
      this.props.ownState,
    );
  }

  openPropertiesModal() {
    this.setState({
      isPropertiesModalOpen: true,
    });
  }

  closePropertiesModal() {
    this.setState({
      isPropertiesModalOpen: false,
    });
  }

  render() {
    const {
      actions,
      chart,
      user,
      formData,
      slice,
      canOverwrite,
      canDownload,
      isStarred,
      sliceUpdated,
      sliceName,
      onSaveChart,
      saveDisabled,
    } = this.props;
    const { latestQueryFormData, sliceFormData } = chart;
    const oldSliceName = slice?.slice_name;
    return (
      <div id="slice-header" css={headerStyles}>
        <div className="title-panel">
          <ChartEditableTitle
            title={sliceName}
            canEdit={
              !slice ||
              canOverwrite ||
              (slice?.owners || []).includes(user?.userId)
            }
            onSave={actions.updateChartTitle}
            placeholder={t('Add the name of the chart')}
          />
          {slice && (
            <span css={buttonsStyles}>
              {slice.certified_by && (
                <CertifiedBadge
                  certifiedBy={slice.certified_by}
                  details={slice.certification_details}
                />
              )}
              {user.userId && (
                <FaveStar
                  itemId={slice.slice_id}
                  fetchFaveStar={actions.fetchFaveStar}
                  saveFaveStar={actions.saveFaveStar}
                  isStarred={isStarred}
                  showTooltip
                />
              )}
              {this.state.isPropertiesModalOpen && (
                <PropertiesModal
                  show={this.state.isPropertiesModalOpen}
                  onHide={this.closePropertiesModal}
                  onSave={sliceUpdated}
                  slice={slice}
                />
              )}
              {sliceFormData && (
                <AlteredSliceTag
                  className="altered"
                  origFormData={{ ...sliceFormData, chartTitle: oldSliceName }}
                  currentFormData={{ ...formData, chartTitle: sliceName }}
                />
              )}
            </span>
          )}
        </div>
        <div className="right-button-panel">
          <Tooltip
            title={
              saveDisabled
                ? t('Add required control values to save chart')
                : null
            }
          >
            {/* needed to wrap button in a div - antd tooltip doesn't work with disabled button */}
            <div css={saveButtonContainerStyles}>
              <Button
                buttonStyle="secondary"
                onClick={onSaveChart}
                disabled={saveDisabled}
                data-test="query-save-button"
                css={saveButtonStyles}
              >
                <Icons.SaveOutlined iconSize="l" />
                {t('Save')}
              </Button>
            </div>
          </Tooltip>
          <ExploreAdditionalActionsMenu
            onOpenInEditor={actions.redirectSQLLab}
            onOpenPropertiesModal={this.openPropertiesModal}
            slice={slice}
            canDownloadCSV={canDownload}
            latestQueryFormData={latestQueryFormData}
            canAddReports={this.canAddReports()}
          />
        </div>
      </div>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    { sliceUpdated, fetchUISpecificReport, toggleActive, deleteActiveReport },
    dispatch,
  );
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
