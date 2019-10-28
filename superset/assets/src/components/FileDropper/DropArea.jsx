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
import React from "react";
import PropTypes from "prop-types";
import "./DropArea.css";
import Button from "../Button";

const propTypes = {
  isVisible: PropTypes.bool.isRequired,
  text: PropTypes.string,
  showButton: PropTypes.bool,
  buttonText: PropTypes.string
};

export default class DropArea extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hover: false
    };
    this.setHover = this.setHover.bind(this);
    this.unsetHover = this.unsetHover.bind(this);
  }

  setHover() {
    this.setState({ hover: true });
  }
  unsetHover() {
    this.setState({ hover: false });
  }

  render() {
    const { isVisible, text, showButton, buttonText } = this.props;
    const { hover } = this.state;
    return (
      <div
        className={`filedropper-container ${
          isVisible ? "is-visible" : "is-not-visible"
        } ${hover ? "filedropper-background-hover" : "filedropper-background"}`}
        onDragOver={this.setHover}
        onMouseOver={this.setHover}
        onDragExit={this.unsetHover}
        onMouseOut={this.unsetHover}
      >
        <i className="fa fa-upload" />
        <div className="filedropper-title">{text ? text : "Drag & Drop"}</div>
        <div className="filedropper-separatortext">or</div>
        {(showButton === undefined || showButton) && (
          <Button>{buttonText ? buttonText : "Click here"}</Button>
        )}
      </div>
    );
  }
}
DropArea.propTypes = propTypes;
