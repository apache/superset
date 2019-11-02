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
import { Alert } from 'react-bootstrap';
import cx from 'classnames';
import Interweave from 'interweave';
import PropTypes from 'prop-types';
import React from 'react';

import { toastShape } from '../propShapes';

import {
  INFO_TOAST,
  SUCCESS_TOAST,
  WARNING_TOAST,
  DANGER_TOAST,
} from '../constants';

const propTypes = {
  toast: toastShape.isRequired,
  onCloseToast: PropTypes.func.isRequired,
};

const defaultProps = {};

class Toast extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: false,
    };

    this.showToast = this.showToast.bind(this);
    this.handleClosePress = this.handleClosePress.bind(this);
  }

  componentDidMount() {
    const { toast } = this.props;

    setTimeout(this.showToast);

    if (toast.duration > 0) {
      this.hideTimer = setTimeout(this.handleClosePress, toast.duration);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.hideTimer);
  }

  showToast() {
    this.setState({ visible: true });
  }

  handleClosePress() {
    clearTimeout(this.hideTimer);

    this.setState({ visible: false }, () => {
      // Wait for the transition
      setTimeout(() => {
        this.props.onCloseToast(this.props.toast.id);
      }, 150);
    });
  }

  render() {
    const { visible } = this.state;
    const {
      toast: { toastType, text },
    } = this.props;

    return (
      <Alert
        onDismiss={this.handleClosePress}
        bsClass={cx(
          'alert',
          'toast',
          visible && 'toast--visible',
          toastType === INFO_TOAST && 'toast--info',
          toastType === SUCCESS_TOAST && 'toast--success',
          toastType === WARNING_TOAST && 'toast--warning',
          toastType === DANGER_TOAST && 'toast--danger',
        )}
      >
        <Interweave content={text} />
      </Alert>
    );
  }
}

Toast.propTypes = propTypes;
Toast.defaultProps = defaultProps;

export default Toast;
