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
};

export default class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
  }

  closeMetricEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocMetric } = this.props;
    const overlay = (
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        onChange={this.props.onMetricEdit}
        onClose={this.closeMetricEditOverlay}
        columns={this.props.columns}
      />
    );

    return (
      <div onMouseDownCapture={(e) => { e.stopPropagation(); }} >
        <OverlayTrigger
          ref="overlay"
          placement="right"
          trigger="click"
          disabled
          overlay={overlay}
          rootClose
        >
          <Label style={{ cursor: 'pointer' }}>
            <span className="m-r-5 option-label">
              {adhocMetric.label}
            </span>
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}
AdhocMetricOption.propTypes = propTypes;
