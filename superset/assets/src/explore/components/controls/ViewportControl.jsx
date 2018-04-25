import React from 'react';
import PropTypes from 'prop-types';
import { Label, Popover, OverlayTrigger } from 'react-bootstrap';
import { decimal2sexagesimal } from 'geolib';

import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';
import { defaultViewport } from '../../../modules/geo';

const PARAMS = [
  'longitude',
  'latitude',
  'zoom',
  'bearing',
  'pitch',
];

const propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
    bearing: PropTypes.number,
    pitch: PropTypes.number,
  }),
  default: PropTypes.object,
  name: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
  default: { type: 'fix', value: 5 },
  value: defaultViewport,
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
      <div key={ctrl}>
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
      <Popover id={`filter-popover-${this.props.name}`} title="Viewport">
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
