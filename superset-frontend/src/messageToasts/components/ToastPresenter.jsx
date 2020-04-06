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
import PropTypes from 'prop-types';
import React from 'react';

import Toast from './Toast';
import { toastShape } from '../propShapes';

import '../stylesheets/toast.less';

const propTypes = {
  toasts: PropTypes.arrayOf(toastShape),
  removeToast: PropTypes.func.isRequired,
};

const defaultProps = {
  toasts: [],
};

// eslint-disable-next-line react/prefer-stateless-function
class ToastPresenter extends React.Component {
  render() {
    const { toasts, removeToast } = this.props;

    return (
      toasts.length > 0 && (
        <div className="toast-presenter">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onCloseToast={removeToast} />
          ))}
        </div>
      )
    );
  }
}

ToastPresenter.propTypes = propTypes;
ToastPresenter.defaultProps = defaultProps;

export default ToastPresenter;
