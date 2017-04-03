import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Label } from 'react-bootstrap';
import ExploreActionButtons from './ExploreActionButtons';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import { getFormDataFromControls } from '../stores/store';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  can_download: PropTypes.bool.isRequired,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  formData: PropTypes.object,
};

class ChartHeader extends React.PureComponent {

  renderChartTitle() {
    let title;
    if (this.props.slice) {
      title = this.props.slice.slice_name;
    } else {
      title = `[${this.props.table_name}] - untitled`;
    }
    return title;
  }

  render() {
    return (
      <div
        id="slice-header"
        className="clearfix panel-title-large"
      >
        {this.renderChartTitle()}

        {this.props.slice &&
          <span>
            <FaveStar
              sliceId={this.props.slice.slice_id}
              actions={this.props.actions}
              isStarred={this.props.isStarred}
            />
            <TooltipWrapper
              label="edit-desc"
              tooltip="Edit Description"
            >
              <a
                className="edit-desc-icon"
                href={`/slicemodelview/edit/${this.props.slice.slice_id}`}
              >
                <i className="fa fa-edit" />
              </a>
            </TooltipWrapper>
          </span>
        }

        <div className="pull-right">
          {this.props.chartStatus === 'success' &&
           this.props.queryResponse &&
           this.props.queryResponse.is_cached &&
            <TooltipWrapper
              tooltip="Loaded from cache. Click to force refresh"
              label="cache-desc"
            >
              <Label
                style={{ fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}
                onClick={this.runQuery.bind(this)}
              >
                cached
              </Label>
            </TooltipWrapper>
          }
          <Timer
            startTime={this.props.chartUpdateStartTime}
            endTime={this.props.chartUpdateEndTime}
            isRunning={this.props.chartStatus === 'loading'}
            status={CHART_STATUS_MAP[this.props.chartStatus]}
            style={{ fontSize: '10px', marginRight: '5px' }}
          />
          <ExploreActionButtons
            formData={this.props.formData}
            canDownload={this.props.can_download}
          />
        </div>
      </div>
    );
  }
}

ChartHeader.propTypes = propTypes;
export default ChartHeader;
