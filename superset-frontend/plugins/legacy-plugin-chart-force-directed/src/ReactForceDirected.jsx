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
import React from 'react';
import { reactify, styled } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Component from './ForceDirected';

const ReactComponent = reactify(Component);

const ForceDirected = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

ForceDirected.propTypes = {
  className: PropTypes.string.isRequired,
};

export default styled(ForceDirected)`
  .superset-legacy-chart-force-directed {
    path.link {
      fill: none;
      stroke: #000;
      stroke-width: 1.5px;
    }
    circle {
      fill: #ccc;
      stroke: #000;
      stroke-width: 1.5px;
      stroke-opacity: 1;
      opacity: 0.75;
    }
    text {
      fill: #000;
      font: 10px sans-serif;
      pointer-events: none;
    }
  }
`;
