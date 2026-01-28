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
import { extendedDayjs } from '../../utils/dates';
import { Timer, TimerProps } from '.';

export default {
  title: 'Components/Timer',
  component: Timer,
  parameters: {
    docs: {
      description: {
        component:
          'A live elapsed-time display that counts up from a given start time. Used to show query and dashboard load durations. Requires a startTime timestamp to function.',
      },
    },
  },
};

export const InteractiveTimer = (args: TimerProps) => <Timer {...args} />;

InteractiveTimer.args = {
  isRunning: true,
  status: 'success',
};

InteractiveTimer.argTypes = {
  isRunning: {
    control: 'boolean',
    description: 'Whether the timer is actively counting. Toggle to start/stop.',
  },
  status: {
    control: { type: 'select' },
    options: [
      'success',
      'warning',
      'danger',
      'info',
      'default',
      'primary',
      'secondary',
    ],
    description: 'Visual status of the timer badge.',
  },
  startTime: {
    defaultValue: extendedDayjs().utc().valueOf(),
    table: { disable: true },
  },
  endTime: {
    table: { disable: true },
  },
};

InteractiveTimer.parameters = {
  actions: { disabled: true },
  docs: {
    staticProps: {
      startTime: 1737936000000,
    },
    liveExample: `function Demo() {
  const [isRunning, setIsRunning] = React.useState(true);
  const [startTime] = React.useState(Date.now());
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Timer
        startTime={startTime}
        isRunning={isRunning}
        status="success"
      />
      <Button onClick={() => setIsRunning(r => !r)}>
        {isRunning ? 'Stop' : 'Start'}
      </Button>
    </div>
  );
}`,
    examples: [
      {
        title: 'Status Variants',
        code: `function StatusVariants() {
  const [startTime] = React.useState(Date.now());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {['success', 'warning', 'danger', 'info', 'default', 'primary', 'secondary'].map(status => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 80 }}>{status}</span>
          <Timer startTime={startTime} isRunning status={status} />
        </div>
      ))}
    </div>
  );
}`,
      },
      {
        title: 'Completed Timer',
        code: `function CompletedTimer() {
  const start = Date.now() - 5230;
  const end = Date.now();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Timer
        startTime={start}
        endTime={end}
        isRunning={false}
        status="success"
      />
      <span style={{ color: '#999' }}>Query completed in ~5.2 seconds</span>
    </div>
  );
}`,
      },
      {
        title: 'Start and Stop',
        code: `function StartStop() {
  const [isRunning, setIsRunning] = React.useState(false);
  const [startTime, setStartTime] = React.useState(null);
  const handleToggle = () => {
    if (!isRunning && !startTime) {
      setStartTime(Date.now());
    }
    setIsRunning(r => !r);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Timer
        startTime={startTime}
        isRunning={isRunning}
        status={isRunning ? 'warning' : 'success'}
      />
      <Button onClick={handleToggle}>
        {isRunning ? 'Pause' : startTime ? 'Resume' : 'Start'}
      </Button>
    </div>
  );
}`,
      },
    ],
  },
};
