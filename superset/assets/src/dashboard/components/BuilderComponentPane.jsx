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
import { StickyContainer, Sticky } from 'react-sticky';
import { ParentSize } from '@vx/responsive';

import InsertComponentPane, {
  SUPERSET_HEADER_HEIGHT,
} from './InsertComponentPane';
import ColorComponentPane from './ColorComponentPane';
import { BUILDER_PANE_TYPE } from '../util/constants';

const propTypes = {
  topOffset: PropTypes.number,
  showBuilderPane: PropTypes.func.isRequired,
  builderPaneType: PropTypes.string.isRequired,
  setColorSchemeAndUnsavedChanges: PropTypes.func.isRequired,
  colorScheme: PropTypes.string,
};

const defaultProps = {
  topOffset: 0,
  colorScheme: undefined,
};

class BuilderComponentPane extends React.PureComponent {
  render() {
    const {
      topOffset,
      builderPaneType,
      showBuilderPane,
      setColorSchemeAndUnsavedChanges,
      colorScheme,
    } = this.props;
    return (
      <div
        className="dashboard-builder-sidepane"
        style={{
          height: `calc(100vh - ${topOffset + SUPERSET_HEADER_HEIGHT}px)`,
        }}
      >
        <ParentSize>
          {({ height }) => (
            <StickyContainer>
              <Sticky topOffset={-topOffset} bottomOffset={Infinity}>
                {({ style, isSticky }) => (
                  <div
                    className="viewport"
                    style={isSticky ? { ...style, top: topOffset } : null}
                  >
                    {builderPaneType === BUILDER_PANE_TYPE.ADD_COMPONENTS && (
                      <InsertComponentPane
                        height={height}
                        isSticky={isSticky}
                        showBuilderPane={showBuilderPane}
                      />
                    )}
                    {builderPaneType === BUILDER_PANE_TYPE.COLORS && (
                      <ColorComponentPane
                        showBuilderPane={showBuilderPane}
                        setColorSchemeAndUnsavedChanges={
                          setColorSchemeAndUnsavedChanges
                        }
                        colorScheme={colorScheme}
                      />
                    )}
                  </div>
                )}
              </Sticky>
            </StickyContainer>
          )}
        </ParentSize>
      </div>
    );
  }
}

BuilderComponentPane.propTypes = propTypes;
BuilderComponentPane.defaultProps = defaultProps;

export default BuilderComponentPane;
