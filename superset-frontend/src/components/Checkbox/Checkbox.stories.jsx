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
import { useArgs } from '@storybook/client-api';
import Checkbox from './';

export default {
  title: 'Checkbox',
  component: Checkbox,
};

const STATUSES = {
  checked: true,
  unchecked: false,
};

export const CheckboxGallery = () =>
  Object.keys(STATUSES).map(status => (
    <div style={{ marginBottom: '16px' }} key={status}>
      <Checkbox
        onChange={() => {}}
        checked={STATUSES[status]}
        style={{ marginRight: '8px' }}
      />
      {`I'm a${STATUSES[status] ? '' : 'n'} ${status} checkbox`}
    </div>
  ));

// eslint-disable-next-line no-unused-vars
export const InteractiveCheckbox = _args => {
  const [{ checked, style }, updateArgs] = useArgs();
  const toggleCheckbox = () => {
    updateArgs({ checked: !checked });
  };

  return (
    <>
      <Checkbox onChange={toggleCheckbox} checked={checked} style={style} />
      I'm an interactive checkbox
    </>
  );
};

InteractiveCheckbox.args = {
  checked: false,
  style: { marginRight: '8px' },
};
