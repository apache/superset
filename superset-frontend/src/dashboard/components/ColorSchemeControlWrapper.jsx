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
/* eslint-env browser */
import PropTypes from 'prop-types';
import React from 'react';
import { getCategoricalSchemeRegistry, t } from '@superset-ui/core';

import ColorSchemeControl from 'src/explore/components/controls/ColorSchemeControl';

const propTypes = {
  onChange: PropTypes.func.isRequired,
  colorScheme: PropTypes.string,
};

const defaultProps = {
  colorScheme: undefined,
  onChange: () => {},
};

class ColorSchemeControlWrapper extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false };
    this.categoricalSchemeRegistry = getCategoricalSchemeRegistry();
    this.choices = this.categoricalSchemeRegistry.keys().map(s => [s, s]);
    this.schemes = this.categoricalSchemeRegistry.getMap();
  }
  setHover(hovered) {
    this.setState({ hovered });
  }

  render() {
    const { colorScheme } = this.props;
    return (
      <ColorSchemeControl
        description={t(
          "Any color palette selected here will override the colors applied to this dashboard's individual charts",
        )}
        label={t('Color Scheme')}
        name="color_scheme"
        onChange={this.props.onChange}
        value={colorScheme}
        choices={this.choices}
        clearable
        schemes={this.schemes}
        hovered={this.state.hovered}
      />
    );
  }
}

ColorSchemeControlWrapper.propTypes = propTypes;
ColorSchemeControlWrapper.defaultProps = defaultProps;

export default ColorSchemeControlWrapper;
