import React from 'react';
import PropTypes from 'prop-types';
import { Label, Popover, OverlayTrigger } from 'react-bootstrap';
import { decimal2sexagesimal } from 'geolib';

import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';

const PARAMS = [
  'longitude',
  'latitude',
  'zoom',
  'bearing',
  'pitch',
];

const propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.object,
  default: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  default: { type: 'fix', value: 5 },
  value: {
    longitude: 6.85236157047845,
    latitude: 31.222656842808707,
    zoom: 1,
    bearing: 0,
    pitch: 0,
  },
};

export default class ViewportControl extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(ctrl, value) {
    this.props.onChange({
      ...this.props.value,
      [ctrl]: value,
    });
  }
  renderTextControl(ctrl) {
    return (
      <div>
        {ctrl}
        <TextControl
          value={this.props.value[ctrl]}
          onChange={this.onChange.bind(this, ctrl)}
          isFloat
        />
      </div>
    );
  }
  renderPopover() {
    return (
      <Popover id="filter-popover" title="Viewport">
        {PARAMS.map(ctrl => this.renderTextControl(ctrl))}
      </Popover>
    );
  }
  renderLabel() {
    if (this.props.value.longitude && this.props.value.latitude) {
      return (
        decimal2sexagesimal(this.props.value.longitude) +
        ' | ' +
        decimal2sexagesimal(this.props.value.latitude)
      );
    }
    return 'N/A';
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
        >
          <Label style={{ cursor: 'pointer' }}>
            {this.renderLabel()}
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}

ViewportControl.propTypes = propTypes;
ViewportControl.defaultProps = defaultProps;
