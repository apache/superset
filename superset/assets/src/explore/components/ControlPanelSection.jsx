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
import { Panel } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  startExpanded: PropTypes.bool,
  hasErrors: PropTypes.bool,
};

const defaultProps = {
  label: null,
  description: null,
  startExpanded: false,
  hasErrors: false,
};

export default class ControlPanelSection extends React.Component {
  constructor(props) {
    super(props);
    this.state = { expanded: this.props.startExpanded };
  }
  toggleExpand() {
    this.setState({ expanded: !this.state.expanded });
  }
  renderHeader() {
    const { label, description, hasErrors } = this.props;
    return (
      label && (
        <div>
          <span>
            <span onClick={this.toggleExpand.bind(this)}>{label}</span>{' '}
            {description && (
              <InfoTooltipWithTrigger label={label} tooltip={description} />
            )}
            {hasErrors && (
              <InfoTooltipWithTrigger
                label="validation-errors"
                bsStyle="danger"
                tooltip="This section contains validation errors"
              />
            )}
          </span>
          <i
            className={`float-right fa-lg text-primary expander fa fa-angle-${
              this.state.expanded ? 'up' : 'down'
            }`}
            onClick={this.toggleExpand.bind(this)}
          />
        </div>
      )
    );
  }

  render() {
    return (
      <Panel
        className="control-panel-section"
        collapsible
        expanded={this.state.expanded}
        header={this.renderHeader()}
      >
        {this.props.children}
      </Panel>
    );
  }
}

ControlPanelSection.propTypes = propTypes;
ControlPanelSection.defaultProps = defaultProps;
