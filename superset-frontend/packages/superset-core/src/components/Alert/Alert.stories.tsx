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
import { Alert, type AlertProps } from '.';

type AlertType = Required<Pick<AlertProps, 'type'>>;
type AlertTypeValue = AlertType['type'];

const types: AlertTypeValue[] = ['info', 'error', 'warning', 'success'];

const smallText = 'Lorem ipsum dolor sit amet';
const bigText =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  'Nam id porta neque, a vehicula orci. Maecenas rhoncus elit sit amet ' +
  'purus convallis placerat in at nunc. Nulla nec viverra augue.';

export default {
  title: 'Extension Components/Alert',
  component: Alert,
  parameters: {
    docs: {
      description: {
        component:
          'Alert component for displaying important messages to users. ' +
          'Wraps Ant Design Alert with sensible defaults and improved accessibility.',
      },
    },
  },
};

export const AlertGallery = () => (
  <>
    {types.map(type => (
      <div key={type} style={{ marginBottom: '40px', width: '600px' }}>
        <h4 style={{ textTransform: 'capitalize' }}>{type} Alerts</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Alert
            type={type}
            showIcon
            message={smallText}
            description={bigText}
            closable
          />
        </div>
      </div>
    ))}
  </>
);

export const InteractiveAlert = (args: AlertProps) => <Alert {...args} />;

InteractiveAlert.args = {
  closable: true,
  type: 'info',
  message: 'This is a sample alert message.',
  description: 'Sample description for additional context.',
  showIcon: true,
};

InteractiveAlert.argTypes = {
  onClose: { action: 'onClose' },
  type: {
    control: { type: 'select' },
    options: types,
    description: 'Type of the alert (e.g., info, error, warning, success).',
  },
  closable: {
    control: { type: 'boolean' },
    description: 'Whether the Alert can be closed with a close button.',
  },
  showIcon: {
    control: { type: 'boolean' },
    description: 'Whether to display an icon in the Alert.',
  },
};
