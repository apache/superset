import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, OverlayTrigger, Tooltip } from 'react-bootstrap';
import AdhocMetric from '../AdhocMetric';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onChange: PropTypes.func.isRequired,
};

export default class AdhocMetricEditPopoverTitle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isHovered: false,
      isEditable: false,
    };
  }

  render() {
    const { adhocMetric, onChange } = this.props;

    const editPrompt = <Tooltip id="edit-metric-label-tooltip">Click to edit label</Tooltip>;

    return (
      <OverlayTrigger
        placement="top"
        overlay={editPrompt}
        onMouseOver={() => this.setState({ isHovered: true }) }
        onMouseOut={() => this.setState({ isHovered: false }) }
        onClick={() => this.setState({ isEditable: true }) }
        onBlur={() => this.setState({ isEditable: false }) }
      >
        {this.state.isEditable ?
          <FormControl
            className="metric-edit-popover-label-input"
            type="text"
            placeholder={adhocMetric.label}
            value={adhocMetric.hasCustomLabel ? adhocMetric.label : ''}
            onChange={this.props.onChange}
            inputRef={(ref) => ref && ref.focus()}
          /> :
          <span>
            {adhocMetric.hasCustomLabel ? adhocMetric.label : 'My Metric'}
            &nbsp;
            <i className="fa fa-pencil" style={{ color: this.state.isHovered ? 'black' : 'grey' }}/>
          </span>
        }
      </OverlayTrigger>
    )
  }
}
AdhocMetricEditPopoverTitle.propTypes = propTypes;
