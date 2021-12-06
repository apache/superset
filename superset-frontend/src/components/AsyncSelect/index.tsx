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
import React, { useState, useEffect } from 'react';
// TODO: refactor this with `import { AsyncSelect } from src/components/Select`
import { Select } from 'src/components/Select';
import { t, SupersetClient } from '@superset-ui/core';
import { getClientErrorObject } from '../../utils/getClientErrorObject';
import { OptionTypeBase, ValueType } from 'react-select';

interface AsyncSelectProps {
  dataEndpoint: string;
  onChange: Function;
  mutator: Function;
  onAsyncError?: Function;
  value: ValueType<OptionTypeBase>;
  valueRenderer?: (option: OptionTypeBase) => React.ReactNode;
  placeholder?: string;
  autoSelect?: boolean;
}

function AsyncSelect({
  placeholder = t('Select ...'),
  onAsyncError = () => { },
  ...props
}: AsyncSelectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);

  function onChange(option: any) {
    onChange(option);
  }

  const { mutator, dataEndpoint, value, valueRenderer } = props;

  async function fetchOptions() {
    setIsLoading(true);

    try {
      const { json } = await SupersetClient.get({ endpoint: dataEndpoint });
      const options = mutator ? mutator(json) : json;
      setIsLoading(false);
      setOptions(options);
      if (!props.value && props.autoSelect && options.length > 0) {
        onChange(options[0]);
      }
    } catch (response) {
      const error = await getClientErrorObject(response);
      onAsyncError(error.error || response.statusText || error);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOptions();
  }, []);

  return (
    <Select
      placeholder={placeholder}
      options={options}
      value={value}
      isLoading={isLoading}
      onChange={onChange}
      valueRenderer={valueRenderer}
    />
  );
}

export default AsyncSelect;
