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
import { useState } from 'react';
import { styled, supersetTheme } from '@apache-superset/core/ui';
import { Input } from '../Input';
import { Icons, IconNameType } from '.';
import type { IconType } from './types';
import { BaseIconComponent } from './BaseIcon';

export default {
  title: 'Components/Icons',
  component: BaseIconComponent,
  parameters: {
    docs: {
      description: {
        component:
          'Icon library for Apache Superset. Contains over 200 icons based on Ant Design icons with consistent sizing and theming support.',
      },
    },
  },
};

const palette: Record<string, string | null> = {
  Default: null,
  Primary: supersetTheme.colorPrimary,
  Success: supersetTheme.colorSuccess,
  Warning: supersetTheme.colorWarning,
  Error: supersetTheme.colorError,
  Info: supersetTheme.colorInfo,
  Text: supersetTheme.colorText,
  'Text Secondary': supersetTheme.colorTextSecondary,
  Icon: supersetTheme.colorIcon,
};

const IconSet = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 180px);
  grid-auto-rows: 90px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const IconBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;

  span {
    margin-top: ${({ theme }) =>
      2 * theme.sizeUnit}px; // Add spacing between icon and name
    font-size: ${({ theme }) =>
      theme.fontSizeSM}; // Optional: adjust font size for elegance
    color: ${({ theme }) =>
      theme.colorText}; // Optional: subtle color for the name
  }
`;

const SearchBox = styled(Input.Search)`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  width: 100%;
  max-width: 400px;
`;

export const InteractiveIcons = ({
  showNames = true,
  ...rest
}: IconType & { showNames: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter icons based on the search term
  const filteredIcons = Object.keys(Icons).filter(k =>
    k.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <SearchBox
        placeholder="Search icons..."
        onChange={e => setSearchTerm(e.target.value)}
        allowClear
      />
      <IconSet>
        {filteredIcons.map(k => {
          const IconComponent = Icons[k as IconNameType];
          return (
            <IconBlock key={k}>
              <IconComponent {...rest} />
              {showNames && <span>{k}</span>}
            </IconBlock>
          );
        })}
      </IconSet>
    </div>
  );
};

InteractiveIcons.args = {
  iconSize: 'xl',
};

InteractiveIcons.argTypes = {
  showNames: {
    name: 'Show names',
    defaultValue: true,
    control: { type: 'boolean' },
  },
  iconSize: {
    defaultValue: 'xl',
    control: { type: 'inline-radio' },
    options: ['s', 'm', 'l', 'xl', 'xxl'],
    description: 'Size of the icons: s (12px), m (16px), l (20px), xl (24px), xxl (32px).',
  },
  iconColor: {
    defaultValue: null,
    control: { type: 'select' },
    options: palette,
  },
  theme: {
    table: {
      disable: true,
    },
  },
};

InteractiveIcons.parameters = {
  docs: {
    // Use a specific icon for the live example since Icons is a namespace, not a component
    renderComponent: 'Icons.InfoCircleOutlined',
    liveExample: `function Demo() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Icons.InfoCircleOutlined iconSize="xl" />
      <Icons.CheckCircleOutlined iconSize="xl" />
      <Icons.WarningOutlined iconSize="xl" />
      <Icons.CloseCircleOutlined iconSize="xl" />
    </div>
  );
}`,
    examples: [
      {
        title: 'Icon Sizes',
        code: `function IconSizes() {
  const sizes = ['s', 'm', 'l', 'xl', 'xxl'];
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'end' }}>
      {sizes.map(size => (
        <div key={size} style={{ textAlign: 'center' }}>
          <Icons.DatabaseOutlined iconSize={size} />
          <div style={{ fontSize: 12, marginTop: 8, color: '#666' }}>{size}</div>
        </div>
      ))}
    </div>
  );
}`,
      },
      {
        title: 'Icon Gallery',
        code: `function IconGallery() {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#666' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{children}</div>
    </div>
  );
  return (
    <div>
      <Section title="Charts">
        <Icons.LineChartOutlined iconSize="xl" />
        <Icons.BarChartOutlined iconSize="xl" />
        <Icons.PieChartOutlined iconSize="xl" />
        <Icons.AreaChartOutlined iconSize="xl" />
        <Icons.DashboardOutlined iconSize="xl" />
        <Icons.FundProjectionScreenOutlined iconSize="xl" />
      </Section>
      <Section title="Data">
        <Icons.DatabaseOutlined iconSize="xl" />
        <Icons.TableOutlined iconSize="xl" />
        <Icons.ConsoleSqlOutlined iconSize="xl" />
        <Icons.FilterOutlined iconSize="xl" />
        <Icons.FieldNumberOutlined iconSize="xl" />
        <Icons.FieldTimeOutlined iconSize="xl" />
        <Icons.FunctionOutlined iconSize="xl" />
        <Icons.CalculatorOutlined iconSize="xl" />
      </Section>
      <Section title="Actions">
        <Icons.PlusOutlined iconSize="xl" />
        <Icons.EditOutlined iconSize="xl" />
        <Icons.DeleteOutlined iconSize="xl" />
        <Icons.CopyOutlined iconSize="xl" />
        <Icons.SaveOutlined iconSize="xl" />
        <Icons.DownloadOutlined iconSize="xl" />
        <Icons.UploadOutlined iconSize="xl" />
        <Icons.ReloadOutlined iconSize="xl" />
        <Icons.SyncOutlined iconSize="xl" />
        <Icons.SearchOutlined iconSize="xl" />
        <Icons.ExpandOutlined iconSize="xl" />
        <Icons.FullscreenOutlined iconSize="xl" />
        <Icons.ShareAltOutlined iconSize="xl" />
        <Icons.ExportOutlined iconSize="xl" />
      </Section>
      <Section title="Status">
        <Icons.CheckOutlined iconSize="xl" />
        <Icons.CheckCircleOutlined iconSize="xl" />
        <Icons.CloseOutlined iconSize="xl" />
        <Icons.CloseCircleOutlined iconSize="xl" />
        <Icons.InfoCircleOutlined iconSize="xl" />
        <Icons.WarningOutlined iconSize="xl" />
        <Icons.ExclamationCircleOutlined iconSize="xl" />
        <Icons.QuestionCircleOutlined iconSize="xl" />
        <Icons.LoadingOutlined iconSize="xl" />
        <Icons.StopOutlined iconSize="xl" />
      </Section>
      <Section title="Navigation">
        <Icons.MenuOutlined iconSize="xl" />
        <Icons.DownOutlined iconSize="xl" />
        <Icons.UpOutlined iconSize="xl" />
        <Icons.RightOutlined iconSize="xl" />
        <Icons.CaretDownOutlined iconSize="xl" />
        <Icons.CaretUpOutlined iconSize="xl" />
        <Icons.ArrowRightOutlined iconSize="xl" />
        <Icons.MoreOutlined iconSize="xl" />
        <Icons.EllipsisOutlined iconSize="xl" />
      </Section>
      <Section title="Objects">
        <Icons.FileOutlined iconSize="xl" />
        <Icons.FileTextOutlined iconSize="xl" />
        <Icons.FileImageOutlined iconSize="xl" />
        <Icons.BookOutlined iconSize="xl" />
        <Icons.TagOutlined iconSize="xl" />
        <Icons.TagsOutlined iconSize="xl" />
        <Icons.StarOutlined iconSize="xl" />
        <Icons.BellOutlined iconSize="xl" />
        <Icons.CalendarOutlined iconSize="xl" />
        <Icons.ClockCircleOutlined iconSize="xl" />
        <Icons.MailOutlined iconSize="xl" />
        <Icons.LinkOutlined iconSize="xl" />
        <Icons.LockOutlined iconSize="xl" />
        <Icons.UnlockOutlined iconSize="xl" />
        <Icons.KeyOutlined iconSize="xl" />
      </Section>
      <Section title="Users">
        <Icons.UserOutlined iconSize="xl" />
        <Icons.UserAddOutlined iconSize="xl" />
        <Icons.UsergroupAddOutlined iconSize="xl" />
        <Icons.LoginOutlined iconSize="xl" />
      </Section>
      <Section title="Settings">
        <Icons.SettingOutlined iconSize="xl" />
        <Icons.BgColorsOutlined iconSize="xl" />
        <Icons.FormatPainterOutlined iconSize="xl" />
        <Icons.HighlightOutlined iconSize="xl" />
        <Icons.EyeOutlined iconSize="xl" />
        <Icons.EyeInvisibleOutlined iconSize="xl" />
        <Icons.SunOutlined iconSize="xl" />
        <Icons.MoonOutlined iconSize="xl" />
      </Section>
    </div>
  );
}`,
      },
      {
        title: 'Icon with Text',
        code: `function IconWithText() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.CheckCircleOutlined iconSize="l" style={{ color: '#52c41a' }} />
        <span>Success message</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.InfoCircleOutlined iconSize="l" style={{ color: '#1890ff' }} />
        <span>Information message</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.WarningOutlined iconSize="l" style={{ color: '#faad14' }} />
        <span>Warning message</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icons.CloseCircleOutlined iconSize="l" style={{ color: '#ff4d4f' }} />
        <span>Error message</span>
      </div>
    </div>
  );
}`,
      },
    ],
  },
};
