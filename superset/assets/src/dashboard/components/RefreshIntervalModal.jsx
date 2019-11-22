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
import Select from 'react-select';
import { t } from '@superset-ui/translation';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
};

const options = [
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
    this.state = {
      refreshFrequency: props.refreshFrequency,
    };
    this.handleFrequencyChange = this.handleFrequencyChange.bind(this);
  }

  handleFrequencyChange(opt) {
    const value = opt ? opt.value : options[0].value;
    this.setState({
      refreshFrequency: value,
    });
    this.props.onChange(value, this.props.editMode);
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        isMenuItem
        modalTitle={t('Refresh Interval')}
        modalBody={
          <div>
            {t('Choose the refresh frequency for this dashboard')}
            <Select
              options={options}
              value={this.state.refreshFrequency}
              onChange={this.handleFrequencyChange}
            />
          </div>
        }
      />
    );
  }
}
RefreshIntervalModal.propTypes = propTypes;

export default RefreshIntervalModal;
