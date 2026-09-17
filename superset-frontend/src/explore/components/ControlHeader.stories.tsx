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
import ControlHeader, { ControlHeaderProps } from './ControlHeader';

export default {
  title: 'ControlHeader',
  component: ControlHeader,
};

const options: {
  [key: string]: ControlHeaderProps;
} = {
  label: {
    label: 'Control label',
  },
  warning: {
    label: 'Control warning',
    warning: 'Example of warning message',
  },
  error: {
    label: 'Control error',
    validationErrors: ['Something is wrong'],
  },
};

export const ControlHeaderGallery = () => (
  <>
    {Object.entries(options).map(([name, props]) => (
      <>
        <h4>{name}</h4>
        <ControlHeader {...props} />
      </>
    ))}
  </>
);

export const InteractiveControlHeader = (props: ControlHeaderProps) => (
  <ControlHeader {...props} />
);

InteractiveControlHeader.args = {
  label: 'example label',
  description: 'example description',
  warning: 'example warning',
  renderTrigger: false,
  hovered: false,
};

InteractiveControlHeader.argTypes = {
  tooltipOnClick: { action: 'tooltipOnClick' },
  onClick: { action: 'onClick' },
};
