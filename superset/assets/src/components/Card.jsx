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
import { Dropdown, Fade } from 'react-bootstrap';

import ToggleWrapper from './ToggleWrapper';
import './Card.css';

const propTypes = {
  title: PropTypes.string.isRequired,
  body: PropTypes.node.isRequired,
  imageSource: PropTypes.string.isRequired,
  cardWidth: PropTypes.number,
  imageAspectRatio: PropTypes.number,
  dropdownMenu: PropTypes.node.isRequired,
  onTitleClick: PropTypes.func,
};
const defaultProps = {
  onTitleClick: () => {},
  imageAspectRatio: 4/3,
};

export default class Card extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hovered: false,
    };
  }
  renderActionDropdown() {
    return (
      <Dropdown id="card-action" pullRight>
        <ToggleWrapper bsRole="toggle">
          <Fade in>
            <i className="fa fa-ellipsis-v text-muted pointer" />
          </Fade>
        </ToggleWrapper>
        {this.props.dropdownMenu}
      </Dropdown>);
  }
  render() {
    const {
      body,
      cardWidth,
      imageAspectRatio,
      imageSource,
      onTitleClick,
      title,
    } = this.props;
    const imgHeight = cardWidth / imageAspectRatio;
    return (
      <div
        className="card"
        onMouseOver={() => this.setState({ hovered: true })}
        onMouseOut={() => this.setState({ hovered: false })}
      >
        <div className="card-header clearfix">
          <div
            className="card-title float-left pointer"
            onClick={() => onTitleClick()}
          >
            <h5>{title}</h5>
          </div>
          <div className="float-right">
            {this.renderActionDropdown()}
          </div>
        </div>
        <div className="card-image" onClick={() => onTitleClick()}>
          <img
            className="pointer m-b-10"
            alt=""
            src={imageSource}
            width={cardWidth}
            height={imgHeight}
          />
        </div>
        <div className="card-body">
          {body}
        </div>
      </div>
    );
  }
}
Card.propTypes = propTypes;
Card.defaultProps = defaultProps;
