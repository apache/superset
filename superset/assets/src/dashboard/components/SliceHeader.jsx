import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { connect } from 'react-redux';

import { t } from '../../locales';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  slice: PropTypes.object.isRequired,
  supersetCanExplore: PropTypes.bool,
  sliceCanEdit: PropTypes.bool,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
  annotationError: PropTypes.object,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  editMode: false,
};

class SliceHeader extends React.PureComponent {
  constructor(props) {
    super(props);

    this.onSaveTitle = this.onSaveTitle.bind(this);
    this.onToggleExpandSlice = this.onToggleExpandSlice.bind(this);
    this.exportCSV = this.props.exportCSV.bind(this, this.props.slice);
    this.exploreChart = this.props.exploreChart.bind(this, this.props.slice);
    this.forceRefresh = this.props.forceRefresh.bind(this, this.props.slice.slice_id);
    this.removeSlice = this.props.removeSlice.bind(this, this.props.slice);
  }

  onSaveTitle(newTitle) {
    if (this.props.updateSliceName) {
      this.props.updateSliceName(this.props.slice.slice_id, newTitle);
    }
  }

  onToggleExpandSlice() {
    this.props.toggleExpandSlice(this.props.slice, !this.props.isExpanded);
  }

  render() {
    const slice = this.props.slice;
    const isCached = this.props.isCached;
    const cachedWhen = moment.utc(this.props.cachedDttm).fromNow();
    const refreshTooltip = isCached ?
      t('Served from data cached %s . Click to force refresh.', cachedWhen) :
      t('Force refresh data');
    const annoationsLoading = t('Annotation layers are still loading.');
    const annoationsError = t('One ore more annotation layers failed loading.');

    return (
      <div className="row chart-header">
        <div className="col-md-12">
          <div className="header">
            <EditableTitle
              title={slice.slice_name}
              canEdit={!!this.props.updateSliceName && this.props.editMode}
              onSaveTitle={this.onSaveTitle}
              showTooltip={this.props.editMode}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
            {!!Object.values(this.props.annotationQuery || {}).length &&
              <TooltipWrapper
                label="annotations-loading"
                placement="top"
                tooltip={annoationsLoading}
              >
                <i className="fa fa-refresh warning" />
              </TooltipWrapper>
            }
            {!!Object.values(this.props.annotationError || {}).length &&
              <TooltipWrapper
                label="annoation-errors"
                placement="top"
                tooltip={annoationsError}
              >
                <i className="fa fa-exclamation-circle danger" />
              </TooltipWrapper>
            }
          </div>
          <div className="chart-controls">
            <div id={'controls_' + slice.slice_id} className="pull-right">
              {this.props.editMode &&
                <a>
                  <TooltipWrapper
                    placement="top"
                    label="move"
                    tooltip={t('Move chart')}
                  >
                    <i className="fa fa-arrows drag" />
                  </TooltipWrapper>
                </a>
              }
              <a className={`refresh ${isCached ? 'danger' : ''}`} onClick={this.forceRefresh}>
                <TooltipWrapper
                  placement="top"
                  label="refresh"
                  tooltip={refreshTooltip}
                >
                  <i className="fa fa-repeat" />
                </TooltipWrapper>
              </a>
              {slice.description &&
              <a onClick={this.onToggleExpandSlice}>
                <TooltipWrapper
                  placement="top"
                  label="description"
                  tooltip={t('Toggle chart description')}
                >
                  <i className="fa fa-info-circle slice_info" />
                </TooltipWrapper>
              </a>
              }
              {this.props.sliceCanEdit &&
                <a href={slice.edit_url} target="_blank">
                  <TooltipWrapper
                    placement="top"
                    label="edit"
                    tooltip={t('Edit chart')}
                  >
                    <i className="fa fa-pencil" />
                  </TooltipWrapper>
                </a>
              }
              <a className="exportCSV" onClick={this.exportCSV}>
                <TooltipWrapper
                  placement="top"
                  label="exportCSV"
                  tooltip={t('Export CSV')}
                >
                  <i className="fa fa-table" />
                </TooltipWrapper>
              </a>
              {this.props.supersetCanExplore &&
                <a className="exploreChart" onClick={this.exploreChart}>
                  <TooltipWrapper
                    placement="top"
                    label="exploreChart"
                    tooltip={t('Explore chart')}
                  >
                    <i className="fa fa-share" />
                  </TooltipWrapper>
                </a>
              }
              {this.props.editMode &&
                <a className="remove-chart" onClick={this.removeSlice}>
                  <TooltipWrapper
                    placement="top"
                    label="close"
                    tooltip={t('Remove chart from dashboard')}
                  >
                    <i className="fa fa-close" />
                  </TooltipWrapper>
                </a>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
}

SliceHeader.propTypes = propTypes;
SliceHeader.defaultProps = defaultProps;

function mapStateToProps({ dashboard }) {
  return {
    supersetCanExplore: dashboard.dashboard.superset_can_explore,
    sliceCanEdit: dashboard.dashboard.slice_can_edit,
  };
}

export { SliceHeader };
export default connect(mapStateToProps, () => ({}))(SliceHeader);
