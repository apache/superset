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
import { useArgs } from '@storybook/preview-api';
import Checkbox, { CheckboxProps } from '.';

export default {
  title: 'Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component:
          'Vanilla Ant Design v5 Checkbox component with no custom styling.',
      },
    },
  },
};

const STATUSES = {
  checked: true,
  unchecked: false,
};
export const CheckboxGallery = () =>
  Object.entries(STATUSES).map(([status, checked]) => (
    <div style={{ marginBottom: '16px' }} key={status}>
      <Checkbox onChange={() => {}} checked={checked}>
        {`I'm a${checked ? '' : 'n'} ${status} checkbox`}
      </Checkbox>
    </div>
  ));

export const InteractiveCheckbox = ({ checked }: CheckboxProps) => {
  const [, updateArgs] = useArgs();
  const toggleCheckbox = () => {
    updateArgs({ checked: !checked });
  };

  return (
    <Checkbox onChange={toggleCheckbox} checked={checked}>
      I'm an interactive checkbox
    </Checkbox>
  );
};

InteractiveCheckbox.args = {
  checked: false,
};

export const DisabledCheckboxes = () => (
  <>
    <div>
      <Checkbox disabled checked={false}>
        I'm a disabled checkbox
      </Checkbox>
    </div>
    <div>
      <Checkbox disabled checked>
        I'm a disabled checked checkbox
      </Checkbox>
    </div>
  </>
);
