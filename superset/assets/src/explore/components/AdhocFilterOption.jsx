import React from 'react';
import PropTypes from 'prop-types';
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocFilterEditPopover from './AdhocFilterEditPopover';
import AdhocFilter from '../AdhocFilter';
import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onFilterEdit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.oneOfType([
    columnType,
    PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
    adhocMetricType,
  ])).isRequired,
  datasource: PropTypes.object,
};

export default class AdhocFilterOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeFilterEditOverlay = this.closeFilterEditOverlay.bind(this);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.onOverlayEntered = this.onOverlayEntered.bind(this);
    this.onOverlayExited = this.onOverlayExited.bind(this);
    this.state = { overlayShown: !this.props.adhocFilter.fromFormData };
  }

  onPopoverResize() {
   this.forceUpdate();
  }

  onOverlayEntered() {
    this.setState({ overlayShown: true });
  }

  onOverlayExited() {
    this.setState({ overlayShown: false });
  }

  onMouseDown(e) {
    e.stopPropagation();
  }

  closeFilterEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocFilter } = this.props;
    const overlay = (
      <AdhocFilterEditPopover
        onResize={this.onPopoverResize}
        adhocFilter={adhocFilter}
        onChange={this.props.onFilterEdit}
        onClose={this.closeFilterEditOverlay}
        options={this.props.options}
        datasource={this.props.datasource}
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
        defaultOverlayShown={!adhocFilter.fromFormData}
        onEntered={this.onOverlayEntered}
        onExited={this.onOverlayExited}
      >
        <Label className="adhoc-filter-option">
          <div onMouseDownCapture={this.onMouseDown}>
            <span className="m-r-5 option-label">
              {adhocFilter.getDefaultLabel()}
              <i
                className={
                  `glyphicon glyphicon-triangle-${this.state.overlayShown ? 'left' : 'right'} adhoc-label-arrow`
                }
              />
            </span>
          </div>
        </Label>
      </OverlayTrigger>
    );
  }
}
AdhocFilterOption.propTypes = propTypes;
