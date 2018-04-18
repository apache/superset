import React from 'react';
import PropTypes from 'prop-types';
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocMetricEditPopover from './AdhocMetricEditPopover';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

export default class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
    this.onPopoverResize = this.onPopoverResize.bind(this);
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  closeMetricEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocMetric } = this.props;
    const overlay = (
      <AdhocMetricEditPopover
        onResize={this.onPopoverResize}
        adhocMetric={adhocMetric}
        onChange={this.props.onMetricEdit}
        onClose={this.closeMetricEditOverlay}
        columns={this.props.columns}
        datasourceType={this.props.datasourceType}
      />
    );

    return (
      <OverlayTrigger
        ref="overlay"
        placement="right"
        trigger="click"
        disabled
        overlay={overlay}
        rootClose
        shouldUpdatePosition
        defaultOverlayShown={!adhocMetric.fromFormData}
      >
        <Label style={{ margin: this.props.multi ? 0 : 3, cursor: 'pointer' }}>
          <div onMouseDownCapture={(e) => { e.stopPropagation(); }}>
            <span className="m-r-5 option-label">
              {adhocMetric.label}
            </span>
          </div>
        </Label>
      </OverlayTrigger>
    );
  }
}
AdhocMetricOption.propTypes = propTypes;
