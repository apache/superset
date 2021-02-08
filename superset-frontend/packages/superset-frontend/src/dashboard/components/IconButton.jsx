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

const propTypes = {
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
  label: PropTypes.string,
};

const defaultProps = {
  className: null,
  label: null,
};

export default class IconButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(event) {
    event.preventDefault();
    const { onClick } = this.props;
    onClick(event);
  }

  render() {
    const { className, label } = this.props;
    return (
      <div
        className="icon-button"
        onClick={this.handleClick}
        tabIndex="0"
        role="button"
        data-test="icon-button"
      >
        <span data-test="icon-button-span" className={className} />
        {label && <span className="icon-button-label">{label}</span>}
      </div>
    );
  }
}

IconButton.propTypes = propTypes;
IconButton.defaultProps = defaultProps;
