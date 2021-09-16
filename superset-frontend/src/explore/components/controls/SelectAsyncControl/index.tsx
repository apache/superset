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
import React, { useEffect, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Select } from 'src/components';
import { SelectProps, OptionsType } from 'src/components/Select/Select';
import { SelectValue, LabeledValue } from 'antd/lib/select';
import withToasts from 'src/messageToasts/enhancers/withToasts';

type SelectAsyncProps = Omit<SelectProps, 'options' | 'ariaLabel' | 'onChange'>;

interface SelectAsyncControlProps extends SelectAsyncProps {
  addDangerToast: (error: string) => void;
  ariaLabel?: string;
  dataEndpoint: string;
  default?: SelectValue;
  mutator?: (response: Record<string, any>) => OptionsType;
  multi?: boolean;
  // ControlHeader related props
  description?: string;
  hovered?: boolean;
  label?: string;
  onChange: (val: SelectValue) => void;
}

const SelectAsyncControl = ({
  addDangerToast,
  allowClear = true,
  ariaLabel,
  dataEndpoint,
  multi = true,
  mutator,
  onChange,
  value,
  ...props
}: SelectAsyncControlProps) => {
  const [options, setOptions] = useState<OptionsType>([]);

  const handleOnChange = (val: SelectValue) => {
    let onChangeVal = val;
    if (Array.isArray(val)) {
      const values = val.map(v => (v as LabeledValue)?.value || v);
      onChangeVal = values as string[] | number[];
    }
    if (typeof val === 'object' && (val as LabeledValue)?.value) {
      onChangeVal = (val as LabeledValue).value;
    }
    onChange(onChangeVal);
  };

  useEffect(() => {
    const loadOptions = () =>
      SupersetClient.get({
        endpoint: dataEndpoint,
      }).then(response => {
        const data = mutator ? mutator(response.json) : response.json.result;
        setOptions(data);
      });
    loadOptions();
  }, [dataEndpoint, mutator]);

  return (
    <div data-test="SelectAsyncControl">
      <Select
        {...props}
        allowClear={allowClear}
        ariaLabel={ariaLabel || t('Select ...')}
        value={value || props.default || undefined}
        header={<ControlHeader {...props} />}
        mode={multi ? 'multiple' : 'single'}
        onChange={handleOnChange}
        onError={error =>
          addDangerToast(`${t('Error while fetching data')}: ${error}`)
        }
        options={options}
      />
    </div>
  );
};

export default withToasts(SelectAsyncControl);
