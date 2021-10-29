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
import Alert, { AlertProps } from './index';

type AlertType = Pick<AlertProps, 'type'>;
type AlertTypeValue = AlertType[keyof AlertType];

const types: AlertTypeValue[] = ['info', 'error', 'warning', 'success'];

const smallText = 'Lorem ipsum dolor sit amet';

const bigText =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  'Nam id porta neque, a vehicula orci. Maecenas rhoncus elit sit amet ' +
  'purus convallis placerat in at nunc. Nulla nec viverra augue.';

export default {
  title: 'Alert',
  component: Alert,
};

export const AlertGallery = () => (
  <>
    {types.map(type => (
      <div key={type} style={{ marginBottom: 40, width: 600 }}>
        <h4>{type}</h4>
        <Alert
          type={type}
          showIcon
          closable
          message={bigText}
          style={{ marginBottom: 20 }}
        />
        <Alert
          type={type}
          showIcon
          message={smallText}
          description={bigText}
          closable
        />
      </div>
    ))}
  </>
);

AlertGallery.story = {
  parameters: {
    actions: {
      disable: true,
    },
    controls: {
      disable: true,
    },
    knobs: {
      disable: true,
    },
  },
};

export const InteractiveAlert = (args: AlertProps) => (
  <>
    <Alert {...args} />
    Some content to test the `roomBelow` prop
  </>
);

InteractiveAlert.args = {
  closable: true,
  roomBelow: false,
  type: 'info',
  message: smallText,
  description: bigText,
  showIcon: true,
};

InteractiveAlert.argTypes = {
  onClose: { action: 'onClose' },
  type: {
    control: { type: 'select', options: types },
  },
};

InteractiveAlert.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
