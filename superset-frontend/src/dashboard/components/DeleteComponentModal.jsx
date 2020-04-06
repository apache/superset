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
import { Button } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default class DeleteComponentModal extends React.PureComponent {
  constructor(props) {
    super(props);

    this.modal = null;
    this.close = this.close.bind(this);
    this.deleteTab = this.deleteTab.bind(this);
    this.setModalRef = this.setModalRef.bind(this);
  }

  setModalRef(ref) {
    this.modal = ref;
  }

  close() {
    this.modal.close();
  }

  deleteTab() {
    this.modal.close();
    this.props.onDelete();
  }

  render() {
    return (
      <ModalTrigger
        ref={this.setModalRef}
        triggerNode={this.props.triggerNode}
        modalBody={
          <div className="dashboard-modal delete">
            <h1>{t('Delete dashboard tab?')}</h1>
            <div>
              Deleting a tab will remove all content within it. You may still
              reverse this action with the <b>undo</b> button (cmd + z) until
              you save your changes.
            </div>
            <div className="dashboard-modal-actions-container">
              <Button onClick={this.close}>{t('Cancel')}</Button>
              <Button bsStyle="primary" onClick={this.deleteTab}>
                {t('Delete')}
              </Button>
            </div>
          </div>
        }
      />
    );
  }
}

DeleteComponentModal.propTypes = propTypes;
