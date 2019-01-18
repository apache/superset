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
import { Row, Col } from 'react-bootstrap';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const STYLE_ROW = { marginTop: '5px', minHeight: '30px' };
const STYLE_RALIGN = { textAlign: 'right' };

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  control: PropTypes.node.isRequired,
  isCheckbox: PropTypes.bool,
};

const defaultProps = {
  tooltip: null,
  isCheckbox: false,
};

export default function FormRow({ label, tooltip, control, isCheckbox }) {
  const labelAndTooltip = (
    <span>
      {label}{' '}
      {tooltip &&
        <InfoTooltipWithTrigger
          placement="top"
          label={label}
          tooltip={tooltip}
        />}
    </span>);
  if (isCheckbox) {
    return (
      <Row style={STYLE_ROW}>
        <Col md={4} style={STYLE_RALIGN}>{control}</Col>
        <Col md={8}>{labelAndTooltip}</Col>
      </Row>);
  }
  return (
    <Row style={STYLE_ROW}>
      <Col md={4} style={STYLE_RALIGN}>{labelAndTooltip}</Col>
      <Col md={8}>{control}</Col>
    </Row>);
}
FormRow.propTypes = propTypes;
FormRow.defaultProps = defaultProps;
