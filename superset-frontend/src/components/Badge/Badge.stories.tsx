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
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import Badge, { BadgeProps } from '.';

export default {
  title: 'Badge',
  component: Badge,
};

type BadgeColor = Pick<BadgeProps, 'color'>;
type BadgeColorValue = BadgeColor[keyof BadgeColor];
type BadgeSize = Pick<BadgeProps, 'size'>;
type BadgeSizeValue = BadgeSize[keyof BadgeSize];

const badgeColors: BadgeColorValue[] = [
  'pink',
  'red',
  'yellow',
  'orange',
  'cyan',
  'green',
  'blue',
  'purple',
  'geekblue',
  'magenta',
  'volcano',
  'gold',
  'lime',
];
const badgeSizes: BadgeSizeValue[] = ['default', 'small'];
const STATUSES = ['default', 'error', 'warning', 'success', 'processing'];

const COLORS = {
  label: 'colors',
  options: badgeColors,
  defaultValue: undefined,
};

const SIZES = {
  label: 'sizes',
  options: badgeSizes,
  defaultValue: undefined,
};

export const InteractiveBadge = (args: BadgeProps) => (
  <AntdThemeProvider>
    <Badge {...args} />
  </AntdThemeProvider>
);

InteractiveBadge.args = {
  count: null,
  color: null,
  text: 'Text',
  status: 'success',
  size: 'default',
};

InteractiveBadge.argTypes = {
  status: {
    control: {
      type: 'select',
    },
    options: [undefined, ...STATUSES],
  },
  size: {
    control: {
      type: 'select',
    },
    options: SIZES.options,
  },
  color: {
    control: {
      type: 'select',
    },
    options: [undefined, ...COLORS.options],
  },
  count: {
    control: {
      type: 'select',
    },
    options: [undefined, ...Array(100).keys()],
  },
};

export const BadgeGallery = () => (
  <>
    {SIZES.options.map(size => (
      <div key={size} style={{ marginBottom: 40 }}>
        <h4>{size}</h4>
        <AntdThemeProvider>
          {COLORS.options.map(color => (
            <Badge
              count={9}
              size={size}
              key={`${color}_${size}`}
              style={{ marginRight: '15px' }}
            />
          ))}
        </AntdThemeProvider>
      </div>
    ))}
  </>
);

export const BadgeTextGallery = () => (
  <AntdThemeProvider>
    {COLORS.options.map(color => (
      <Badge
        text="Hello"
        color={color}
        key={color}
        style={{ marginRight: '15px' }}
      />
    ))}
  </AntdThemeProvider>
);

BadgeGallery.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
  },
};

BadgeTextGallery.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
  },
};
