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
import { useRef, useState } from 'react';
import { Tour as AntdTour } from 'antd';
import { Button } from '../Button';
import { Tour, type TourProps } from '.';

export default {
  title: 'Components/Tour',
  component: Tour as typeof AntdTour,
  parameters: {
    docs: {
      description: {
        component:
          'A guided tour that highlights elements on the page one step at a time, with a popover describing each one.',
      },
    },
  },
};

export const InteractiveTour = (args: TourProps) => {
  const [open, setOpen] = useState(false);
  const uploadRef = useRef<HTMLElement>(null);
  const saveRef = useRef<HTMLElement>(null);
  const steps: TourProps['steps'] = [
    {
      title: 'Upload a file',
      description: 'Start by choosing the file you want to import.',
      target: () => uploadRef.current!,
    },
    {
      title: 'Save',
      description: 'Save once everything looks right.',
      target: () => saveRef.current!,
    },
  ];
  return (
    <>
      <Button onClick={() => setOpen(true)}>Start tour</Button>{' '}
      <Button ref={uploadRef}>Upload</Button>{' '}
      <Button ref={saveRef} buttonStyle="primary">
        Save
      </Button>
      <Tour
        {...args}
        open={open}
        steps={steps}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

InteractiveTour.args = {
  type: 'default',
  placement: 'bottom',
  arrow: true,
  mask: true,
};

InteractiveTour.argTypes = {
  type: {
    control: { type: 'select' },
    options: ['default', 'primary'],
    description: 'Visual style of the step popovers.',
  },
  placement: {
    control: { type: 'select' },
    options: ['top', 'bottom', 'left', 'right'],
    description: 'Where each popover sits relative to its target.',
  },
  arrow: {
    control: 'boolean',
    description: 'Whether the popover shows an arrow pointing at the target.',
  },
  mask: {
    control: 'boolean',
    description: 'Whether the rest of the page is dimmed during the tour.',
  },
};
