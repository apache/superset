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
import Select from 'src/components/Select';
import { t } from '@superset-ui/core';
import { Alert } from 'react-bootstrap';
import Button from 'src/components/Button';

import ModalTrigger from 'src/components/ModalTrigger';
import FormLabel from 'src/components/FormLabel';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  refreshLimit: PropTypes.number,
  refreshWarning: PropTypes.string,
};

const defaultProps = {
  refreshLimit: 0,
  refreshWarning: null,
};

export const options = [
  [0, t("Don't refresh")],
  [10, t('10 seconds')],
  [30, t('30 seconds')],
  [60, t('1 minute')],
  [300, t('5 minutes')],
  [1800, t('30 minutes')],
  [3600, t('1 hour')],
  [21600, t('6 hours')],
  [43200, t('12 hours')],
  [86400, t('24 hours')],
].map(o => ({ value: o[0], label: o[1] }));

class RefreshIntervalModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.modalRef = React.createRef();
    this.state = {
      refreshFrequency: props.refreshFrequency,
    };
    this.handleFrequencyChange = this.handleFrequencyChange.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);
  }

  onSave() {
    this.props.onChange(this.state.refreshFrequency, this.props.editMode);
    this.modalRef.current.close();
  }

  onCancel() {
    this.setState({
      refreshFrequency: this.props.refreshFrequency,
    });
    this.modalRef.current.close();
  }

  handleFrequencyChange(opt) {
    const value = opt ? opt.value : options[0].value;
    this.setState({
      refreshFrequency: value,
    });
  }

  render() {
    const { refreshLimit = 0, refreshWarning, editMode } = this.props;
    const { refreshFrequency = 0 } = this.state;
    const showRefreshWarning =
      !!refreshFrequency && !!refreshWarning && refreshFrequency < refreshLimit;

    return (
      <ModalTrigger
        ref={this.modalRef}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Refresh Interval')}
        modalBody={
          <div>
            <FormLabel>{t('Refresh frequency')}</FormLabel>
            <Select
              options={options}
              value={this.state.refreshFrequency}
              onChange={this.handleFrequencyChange}
            />
            {showRefreshWarning && (
              <div className="refresh-warning-container">
                <Alert bsStyle="warning">
                  <div>{refreshWarning}</div>
                  <br />
                  <strong>{t('Are you sure you want to proceed?')}</strong>
                </Alert>
              </div>
            )}
          </div>
        }
        modalFooter={
          <>
            <Button buttonStyle="primary" buttonSize="sm" onClick={this.onSave}>
              {editMode ? t('Save') : t('Save for this session')}
            </Button>
            <Button onClick={this.onCancel} buttonSize="sm">
              {t('Cancel')}
            </Button>
          </>
        }
      />
    );
  }
}
RefreshIntervalModal.propTypes = propTypes;
RefreshIntervalModal.defaultProps = defaultProps;

export default RefreshIntervalModal;
