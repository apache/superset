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
import "./FileDropper.css";

const propTypes = {
  onFileSelected: PropTypes.func.isRequired,
  allowedMimeTypes: PropTypes.array,
  className: PropTypes.string,
  maxSize: PropTypes.number,
  disableClick: PropTypes.bool,
  allowMultipleSelection: PropTypes.bool,
  fileInputClassName: PropTypes.string,
  onError: PropTypes.func
};

export const ErrorStatus = {
  FileSizeExceeded: 1,
  MimeTypeDisallowed: 2
};

export default class FileDropper extends React.Component {
  constructor(props) {
    super(props);
    this.allowedMimeType = this.allowedMimeType.bind(this);
    this.checkFile = this.checkFile.bind(this);
    this.handleFileInputChanged = this.handleFileInputChanged.bind(this);
    this.setFileRef = this.setFileRef.bind(this);
    this.fileChangeEventHandler = this.fileChangeEventHandler.bind(this);
  }

  fileRef = document.createElement("input");

  allowedMimeType(file) {
    const allowedMimeTypes = this.props.allowedMimeTypes || [];
    return allowedMimeTypes.length > 0
      ? allowedMimeTypes.indexOf(file.type) > -1
      : true;
  }

  checkFile(file, accept, reject) {
    if (!file) {
      return;
    }

    if (!this.allowedMimeType(file)) {
      reject({
        status: ErrorStatus.MimeTypeDisallowed,
        msg: `File type '${file.type}' is not allowed (${
          this.props.allowedMimeTypes
        }).`,
        fileName: file.name
      });
      return;
    }

    if (this.props.maxSize && file.size > this.props.maxSize) {
      reject({
        status: ErrorStatus.FileSizeExceeded,
        msg: `File size (${file.size}) exceeds maximum file size (${
          this.props.maxSize
        }).`,
        fileName: file.name
      });
      return;
    }

    accept(file);
  }

  handleFileInputChanged(fileList) {
    if (!fileList) {
      return;
    }

    const files = [];
    const errors = [];

    for (let i = 0; i < fileList.length; i++) {
      this.checkFile(fileList.item(i), f => files.push(f), e => errors.push(e));
    }

    if (errors.length > 0 && this.props.onError) {
      this.props.onError(errors);
    }

    if (files.length > 0) {
      this.props.onFileSelected(files);
    }
  }

  setFileRef(element) {
    if (element && this.fileRef !== element) {
      this.fileRef = element;
      this.fileRef.addEventListener("change", this.fileChangeEventHandler);
    }
  }

  fileChangeEventHandler() {
    if (!this.fileRef.files || this.fileRef.files.length === 0) {
      return;
    }
    this.handleFileInputChanged(this.fileRef.files);
  }

  componentWillUnmount() {
    this.fileRef.removeEventListener("change", this.fileChangeEventHandler);
  }

  render() {
    const {
      allowedMimeTypes,
      disableClick,
      allowMultipleSelection,
      className,
      fileInputClassName
    } = this.props;
    return (
      <div
        className={className}
        onClick={() => !disableClick && this.fileRef.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          this.handleFileInputChanged(event.dataTransfer.files);
          event.preventDefault();
        }}
      >
        {this.props.children}
        <input
          type="file"
          accept={allowedMimeTypes && allowedMimeTypes.join(",")}
          multiple={allowMultipleSelection ? allowMultipleSelection : false}
          ref={element => this.setFileRef(element)}
          className={`filedropper-input ${
            fileInputClassName ? fileInputClassName : ""
          }`}
        />
      </div>
    );
  }
}

FileDropper.propTypes = propTypes;
