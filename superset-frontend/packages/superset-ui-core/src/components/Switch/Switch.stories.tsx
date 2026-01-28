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
import { Switch, type SwitchProps } from '.';

export default {
  title: 'Components/Switch',
  parameters: {
    docs: {
      description: {
        component:
          'A toggle switch for boolean on/off states. Supports loading indicators, sizing, and an HTML title attribute for accessibility tooltips.',
      },
    },
  },
};

export const InteractiveSwitch = ({ checked, ...rest }: SwitchProps) => {
  const [, updateArgs] = useArgs();
  return (
    <Switch
      {...rest}
      checked={checked}
      onChange={value => updateArgs({ checked: value })}
    />
  );
};
const defaultCheckedValue = true;

InteractiveSwitch.args = {
  checked: defaultCheckedValue,
  disabled: false,
  loading: false,
  title: 'Toggle feature',
  defaultChecked: defaultCheckedValue,
};

InteractiveSwitch.argTypes = {
  checked: {
    control: 'boolean',
    description: 'Whether the switch is on.',
  },
  disabled: {
    control: 'boolean',
    description: 'Whether the switch is disabled.',
  },
  loading: {
    control: 'boolean',
    description: 'Whether to show a loading spinner inside the switch.',
  },
  title: {
    control: 'text',
    description: 'HTML title attribute shown as a browser tooltip on hover. Useful for accessibility.',
  },
  size: {
    control: { type: 'radio' },
    options: ['small', 'default'],
    description: 'Size of the switch.',
  },
};

InteractiveSwitch.parameters = {
  docs: {
    liveExample: `function Demo() {
  const [checked, setChecked] = React.useState(true);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Switch
        checked={checked}
        onChange={setChecked}
        title="Toggle feature"
      />
      <span>{checked ? 'On' : 'Off'}</span>
      <span style={{ color: '#999', fontSize: 12 }}>(hover the switch to see the title tooltip)</span>
    </div>
  );
}`,
    examples: [
      {
        title: 'Switch States',
        code: `function SwitchStates() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch defaultChecked title="Enabled switch" />
        <span>Checked</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch title="Unchecked switch" />
        <span>Unchecked</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch disabled defaultChecked title="Disabled on" />
        <span>Disabled (on)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch disabled title="Disabled off" />
        <span>Disabled (off)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch loading defaultChecked title="Loading switch" />
        <span>Loading</span>
      </div>
    </div>
  );
}`,
      },
      {
        title: 'Sizes',
        code: `function SizesDemo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch size="small" defaultChecked title="Small switch" />
        <span>Small</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch size="default" defaultChecked title="Default switch" />
        <span>Default</span>
      </div>
    </div>
  );
}`,
      },
      {
        title: 'Settings Panel',
        code: `function SettingsPanel() {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  return (
    <div style={{ maxWidth: 320, border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Dashboard Settings</h4>
      {[
        { label: 'Email notifications', checked: notifications, onChange: setNotifications, title: 'Toggle email notifications' },
        { label: 'Dark mode', checked: darkMode, onChange: setDarkMode, title: 'Toggle dark mode' },
        { label: 'Auto-refresh data', checked: autoRefresh, onChange: setAutoRefresh, title: 'Toggle auto-refresh' },
      ].map(({ label, checked, onChange, title }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <span>{label}</span>
          <Switch checked={checked} onChange={onChange} title={title} />
        </div>
      ))}
    </div>
  );
}`,
      },
    ],
  },
};
