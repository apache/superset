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
import { useEffect, useState } from 'react';
import { t, SupersetClient, getClientErrorObject } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Select } from 'src/components';
import { SelectOptionsType, SelectProps } from 'src/components/Select/types';
import { SelectValue, LabeledValue } from 'antd/lib/select';
import withToasts from 'src/components/MessageToasts/withToasts';

type SelectAsyncProps = Omit<SelectProps, 'options' | 'ariaLabel' | 'onChange'>;

interface SelectAsyncControlProps extends SelectAsyncProps {
  addDangerToast: (error: string) => void;
  ariaLabel?: string;
  dataEndpoint: string;
  default?: SelectValue;
  mutator?: (
    response: Record<string, any>,
    value: SelectValue | undefined,
  ) => SelectOptionsType;
  multi?: boolean;
  onChange: (val: SelectValue) => void;
  // ControlHeader related props
  description?: string;
  hovered?: boolean;
  label?: string;
}

function isLabeledValue(arg: any): arg is LabeledValue {
  return arg.value !== undefined;
}

const SelectAsyncControl = ({
  addDangerToast,
  allowClear = true,
  ariaLabel,
  dataEndpoint,
  multi = true,
  mutator,
  onChange,
  placeholder,
  value,
  ...props
}: SelectAsyncControlProps) => {
  const [options, setOptions] = useState<SelectOptionsType>([]);
  const [loaded, setLoaded] = useState<Boolean>(false);

  const handleOnChange = (val: SelectValue) => {
    let onChangeVal = val;
    if (Array.isArray(val)) {
      const values = val.map(v => (isLabeledValue(v) ? v.value : v));
      onChangeVal = values;
    }
    if (isLabeledValue(val)) {
      onChangeVal = val.value;
    }
    onChange(onChangeVal);
  };

  const getValue = () => {
    const currentValue =
      value || (props.default !== undefined ? props.default : undefined);

    // safety check - the value is intended to be undefined but null was used
    if (currentValue === null && !options.find(o => o.value === null)) {
      return undefined;
    }
    return currentValue;
  };

  useEffect(() => {
    const onError = (response: Response) =>
      getClientErrorObject(response).then(e => {
        const { error } = e;
        addDangerToast(t('Error while fetching data: %s', error));
      });
    const loadOptions = () =>
      SupersetClient.get({
        endpoint: dataEndpoint,
      })
        .then(response => {
          const data = mutator
            ? mutator(response.json, value)
            : response.json.result;
          setOptions(data);
        })
        .catch(onError)
        .finally(() => {
          setLoaded(true);
        });

    if (!loaded) {
      loadOptions();
    }
  }, [addDangerToast, dataEndpoint, mutator, value, loaded]);

  return (
    <Select
      allowClear={allowClear}
      ariaLabel={ariaLabel || t('Select ...')}
      value={getValue()}
      header={<ControlHeader {...props} />}
      mode={multi ? 'multiple' : 'single'}
      onChange={handleOnChange}
      options={options}
      placeholder={placeholder}
    />
  );
};

export default withToasts(SelectAsyncControl);
