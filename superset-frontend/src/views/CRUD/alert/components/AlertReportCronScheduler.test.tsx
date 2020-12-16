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
import { ReactWrapper } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
import { CronPicker } from 'src/common/components/CronPicker';
import { Input } from 'src/common/components';

import { AlertReportCronScheduler } from './AlertReportCronScheduler';

describe('AlertReportCronScheduler', () => {
  let wrapper: ReactWrapper;

  it('calls onChnage when value chnages', () => {
    const onChangeMock = jest.fn();
    wrapper = mount(
      <AlertReportCronScheduler value="* * * * *" onChange={onChangeMock} />,
    );

    const changeValue = '1,7 * * * *';

    wrapper.find(CronPicker).props().setValue(changeValue);
    expect(onChangeMock).toHaveBeenLastCalledWith(changeValue);
  });

  it.skip('sets input value when cron picker changes', () => {
    const onChangeMock = jest.fn();
    wrapper = mount(
      <AlertReportCronScheduler value="* * * * *" onChange={onChangeMock} />,
    );

    const changeValue = '1,7 * * * *';

    wrapper.find(CronPicker).props().setValue(changeValue);
    // TODO fix this class-style assertion that doesn't work on function components
    // @ts-ignore
    expect(wrapper.find(Input).state().value).toEqual(changeValue);
  });

  it('calls onChange when input value changes', () => {
    const onChangeMock = jest.fn();
    wrapper = mount(
      <AlertReportCronScheduler value="* * * * *" onChange={onChangeMock} />,
    );

    const changeValue = '1,7 * * * *';
    const event = {
      target: { value: changeValue },
    } as React.FocusEvent<HTMLInputElement>;

    const inputProps = wrapper.find(Input).props();
    if (inputProps.onBlur) {
      inputProps.onBlur(event);
    }
    expect(onChangeMock).toHaveBeenLastCalledWith(changeValue);
  });
});
