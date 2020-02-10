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
import { getCategoricalSchemeRegistry } from '@superset-ui/color';
import { t } from '@superset-ui/translation';

import ColorSchemeControl from '../../explore/components/controls/ColorSchemeControl';
import { BUILDER_PANE_TYPE } from '../util/constants';

const propTypes = {
  showBuilderPane: PropTypes.func.isRequired,
  setColorSchemeAndUnsavedChanges: PropTypes.func.isRequired,
  colorScheme: PropTypes.string,
};

const defaultProps = {
  colorScheme: undefined,
};

class ColorComponentPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false };
    this.categoricalSchemeRegistry = getCategoricalSchemeRegistry();
    this.getChoices = this.getChoices.bind(this);
    this.getSchemes = this.getSchemes.bind(this);
    this.onCloseButtonClick = this.onCloseButtonClick.bind(this);
    this.onMouseEnter = this.setHover.bind(this, true);
    this.onMouseLeave = this.setHover.bind(this, false);
  }

  onCloseButtonClick() {
    this.props.showBuilderPane(BUILDER_PANE_TYPE.NONE);
  }

  getChoices() {
    return this.categoricalSchemeRegistry.keys().map(s => [s, s]);
  }

  getSchemes() {
    return this.categoricalSchemeRegistry.getMap();
  }

  setHover(hovered) {
    this.setState({ hovered });
  }

  render() {
    const { setColorSchemeAndUnsavedChanges, colorScheme } = this.props;

    return (
      <div className="slider-container">
        <div className="component-layer slide-content">
          <div className="dashboard-builder-sidepane-header">
            <span>{'Color Settings'}</span>
            <i
              className="fa fa-times trigger"
              onClick={this.onCloseButtonClick}
              role="none"
            />
          </div>
          <div
            className="panel-body"
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            <ColorSchemeControl
              description={t(
                "Any color palette selected here will override the colors applied to this dashboard's individual charts",
              )}
              label={t('Color Scheme')}
              name="color_scheme"
              onChange={setColorSchemeAndUnsavedChanges}
              value={colorScheme}
              choices={this.getChoices}
              schemes={this.getSchemes}
              hovered={this.state.hovered}
            />
          </div>
        </div>
      </div>
    );
  }
}

ColorComponentPane.propTypes = propTypes;
ColorComponentPane.defaultProps = defaultProps;

export default ColorComponentPane;
