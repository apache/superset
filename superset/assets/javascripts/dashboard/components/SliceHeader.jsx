import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import { t } from '../../locales';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  slice: PropTypes.object.isRequired,
  exploreChartUrl: PropTypes.string,
  exportCSVUrl: PropTypes.string,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  formDataExtra: PropTypes.object,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  editMode: PropTypes.bool,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  editMode: false,
};

class SliceHeader extends React.PureComponent {
  constructor(props) {
    super(props);

    this.onSaveTitle = this.onSaveTitle.bind(this);
  }

  onSaveTitle(newTitle) {
    if (this.props.updateSliceName) {
      this.props.updateSliceName(this.props.slice.slice_id, newTitle);
    }
  }

  render() {
    const slice = this.props.slice;
    const isCached = this.props.isCached;
    const isExpanded = !!this.props.isExpanded;
    const cachedWhen = moment.utc(this.props.cachedDttm).fromNow();
    const refreshTooltip = isCached ?
      t('Served from data cached %s . Click to force refresh.', cachedWhen) :
      t('Force refresh data');

    return (
      <div className="row chart-header">
        <div className="col-md-12">
          <div className="header">
            <EditableTitle
              title={slice.slice_name}
              canEdit={!!this.props.updateSliceName && this.props.editMode}
              onSaveTitle={this.onSaveTitle}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
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
              <a
                className={`refresh ${isCached ? 'danger' : ''}`}
                onClick={() => (this.props.forceRefresh(slice.slice_id))}
              >
                <TooltipWrapper
                  placement="top"
                  label="refresh"
                  tooltip={refreshTooltip}
                >
                  <i className="fa fa-repeat" />
                </TooltipWrapper>
              </a>
              {slice.description &&
              <a onClick={() => this.props.toggleExpandSlice(slice, !isExpanded)}>
                <TooltipWrapper
                  placement="top"
                  label="description"
                  tooltip={t('Toggle chart description')}
                >
                  <i className="fa fa-info-circle slice_info" />
                </TooltipWrapper>
              </a>
              }
              <a href={slice.edit_url} target="_blank">
                <TooltipWrapper
                  placement="top"
                  label="edit"
                  tooltip={t('Edit chart')}
                >
                  <i className="fa fa-pencil" />
                </TooltipWrapper>
              </a>
              <a className="exportCSV" href={this.props.exportCSVUrl}>
                <TooltipWrapper
                  placement="top"
                  label="exportCSV"
                  tooltip={t('Export CSV')}
                >
                  <i className="fa fa-table" />
                </TooltipWrapper>
              </a>
              <a className="exploreChart" href={this.props.exploreChartUrl} target="_blank">
                <TooltipWrapper
                  placement="top"
                  label="exploreChart"
                  tooltip={t('Explore chart')}
                >
                  <i className="fa fa-share" />
                </TooltipWrapper>
              </a>
              {this.props.editMode &&
                <a className="remove-chart" onClick={() => (this.props.removeSlice(slice))}>
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

export default SliceHeader;
