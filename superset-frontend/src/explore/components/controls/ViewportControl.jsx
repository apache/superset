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
import { Component } from 'react';
import { t } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Popover from 'src/components/Popover';
import { decimal2sexagesimal } from 'geolib';

import Label from 'src/components/Label';
import { FormLabel } from 'src/components/Form';
import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';

export const DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const PARAMS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];

const propTypes = {
  onChange: PropTypes.func,
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
  value: DEFAULT_VIEWPORT,
};

export default class ViewportControl extends Component {
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
        <FormLabel>{ctrl}</FormLabel>
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
      <div id={`filter-popover-${this.props.name}`}>
        {PARAMS.map(ctrl => this.renderTextControl(ctrl))}
      </div>
    );
  }

  renderLabel() {
    if (this.props.value.longitude && this.props.value.latitude) {
      return `${decimal2sexagesimal(
        this.props.value.longitude,
      )} | ${decimal2sexagesimal(this.props.value.latitude)}`;
    }
    return 'N/A';
  }

  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <Popover
          container={document.body}
          trigger="click"
          placement="right"
          content={this.renderPopover()}
          title={t('Viewport')}
        >
          <Label className="pointer">{this.renderLabel()}</Label>
        </Popover>
      </div>
    );
  }
}

ViewportControl.propTypes = propTypes;
ViewportControl.defaultProps = defaultProps;
