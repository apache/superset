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
import styled from '@superset-ui/style';
import cx from 'classnames';
import Interweave from 'interweave';
import React from 'react';
import Icon from 'src/components/Icon';

import {
  INFO_TOAST,
  SUCCESS_TOAST,
  WARNING_TOAST,
  DANGER_TOAST,
} from '../constants';

const ToastContianer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  span {
    padding: 0 11px;
  }
`;

type ToastType =
  | 'INFO_TOAST'
  | 'SUCCESS_TOAST'
  | 'WARNING_TOAST'
  | 'DANGER_TOAST';

interface ToastPresenterProps {
  toast: { id: string; toastType: ToastType; text: string; duration: number };
  onCloseToast: (id: string) => void;
}

interface ToastPresenterState {
  visible: boolean;
}

class Toast extends React.Component<ToastPresenterProps, ToastPresenterState> {
  constructor(props: ToastPresenterProps) {
    super(props);

    this.showToast = this.showToast.bind(this);
    this.handleClosePress = this.handleClosePress.bind(this);
  }

  state: ToastPresenterState = {
    visible: false,
  };

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

  hideTimer: NodeJS.Timeout;

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
        <ToastContianer>
          {toastType === SUCCESS_TOAST ? (
            <Icon name="check" />
          ) : (
            <Icon name="error" />
          )}
          <Interweave content={text} />
        </ToastContianer>
      </Alert>
    );
  }
}

export default Toast;
