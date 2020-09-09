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
import { t } from '@superset-ui/core';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  code: PropTypes.string,
  codeCallback: PropTypes.func,
};

const defaultProps = {
  codeCallback: () => {},
  code: '',
};

export default class CodeModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { code: props.code };
    this.beforeOpen = this.beforeOpen.bind(this);
  }

  beforeOpen() {
    let code = this.props.code;
    if (!code && this.props.codeCallback) {
      code = this.props.codeCallback();
    }
    this.setState({ code });
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isButton
        beforeOpen={this.beforeOpen}
        modalTitle={t('Active Dashboard Filters')}
        modalBody={
          <div className="CodeModal">
            <pre>{this.state.code}</pre>
          </div>
        }
      />
    );
  }
}
CodeModal.propTypes = propTypes;
CodeModal.defaultProps = defaultProps;
