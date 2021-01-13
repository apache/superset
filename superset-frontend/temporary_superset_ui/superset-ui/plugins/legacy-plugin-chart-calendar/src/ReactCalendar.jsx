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
import PropTypes from 'prop-types';
import { reactify, styled } from '@superset-ui/core';
import Component from './Calendar';

const ReactComponent = reactify(Component);

const Calender = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

Calender.defaultProps = {
  otherProps: {},
};

Calender.propTypes = {
  className: PropTypes.string.isRequired,
  otherProps: PropTypes.objectOf(PropTypes.any),
};

export default styled(Calender)`
  .superset-legacy-chart-calendar {
    padding: 10px;
    position: static !important;
    overflow: auto !important;
  }

  .superset-legacy-chart-calendar .ch-tooltip {
    margin-left: 20px;
    margin-top: 5px;
  }
`;
