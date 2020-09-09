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

import Select from '../../../components/AsyncSelect';
import ControlHeader from '../ControlHeader';
import withToasts from '../../../messageToasts/enhancers/withToasts';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  multi: PropTypes.bool,
  mutator: PropTypes.func,
  onAsyncErrorMessage: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
  ]),
  addDangerToast: PropTypes.func.isRequired,
};

const defaultProps = {
  multi: true,
  onAsyncErrorMessage: t('Error while fetching data'),
  onChange: () => {},
  placeholder: t('Select ...'),
};

const SelectAsyncControl = props => {
  const {
    value,
    onChange,
    dataEndpoint,
    multi,
    mutator,
    placeholder,
    onAsyncErrorMessage,
  } = props;
  const onSelectionChange = options => {
    let val;
    if (multi) {
      val = options.map(option => option.value);
    } else if (options) {
      val = options.value;
    } else {
      val = null;
    }
    onChange(val);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <Select
        dataEndpoint={dataEndpoint}
        onChange={onSelectionChange}
        onAsyncError={errorMsg =>
          this.props.addDangerToast(`${onAsyncErrorMessage}: ${errorMsg}`)
        }
        mutator={mutator}
        multi={multi}
        value={value}
        placeholder={placeholder}
        valueRenderer={v => <div>{v.label}</div>}
      />
    </div>
  );
};

SelectAsyncControl.propTypes = propTypes;
SelectAsyncControl.defaultProps = defaultProps;

export default withToasts(SelectAsyncControl);
