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
import { t } from '@superset-ui/translation';
import { supportsDragAndDrop } from 'src/utils/common';
import Button from '../Button';
import './DropArea.css';

const propTypes = {
  isVisible: PropTypes.bool.isRequired,
  text: PropTypes.string,
  separatorText: PropTypes.string,
  showButton: PropTypes.bool,
  buttonText: PropTypes.string,
  showFileSelected: PropTypes.bool,
  fileName: PropTypes.string,
};

export default class DropArea extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hover: false,
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
    const {
      isVisible,
      text,
      separatorText,
      showButton,
      buttonText,
      showFileSelected,
      fileName,
    } = this.props;
    const { hover } = this.state;
    return (
      <div>
        <div
          className={
            supportsDragAndDrop()
              ? `filedropper-container ${
                  isVisible ? 'is-visible' : 'is-not-visible'
                } ${
                  hover
                    ? 'filedropper-background-hover'
                    : 'filedropper-background'
                }`
              : 'is-not-visible'
          }
          onDragOver={this.setHover}
          onMouseOver={this.setHover}
          onDragExit={this.unsetHover}
          onMouseOut={this.unsetHover}
        >
          <div className="filedropper-title">{text || t('Drag & Drop')}</div>
          {(showButton === undefined || showButton) && (
            <>
              <div className="filedropper-separatortext">
                {separatorText || t('or')}
              </div>
              <Button
                tooltip={fileName || t('No file chosen')}
                bsStyle="primary"
              >
                {buttonText || t('Click here')}
              </Button>
            </>
          )}
          {supportsDragAndDrop() && showFileSelected ? (
            <div className="filedropper-file">
              {t('File')}: {fileName || t('No file chosen')}
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    );
  }
}
DropArea.propTypes = propTypes;
