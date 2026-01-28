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
import { css } from '@apache-superset/core/ui';
import { useResizeDetector } from 'react-resize-detector';
import MetadataBar, { MetadataBarProps, MetadataType } from '.';

export default {
  title: 'Design System/Components/MetadataBar',
  component: MetadataBar,
  parameters: {
    docs: {
      description: {
        component:
          'MetadataBar displays a row of metadata items (SQL info, owners, last modified, tags, dashboards, etc.) that collapse responsively based on available width.',
      },
    },
  },
};

const A_WEEK_AGO = 'a week ago';

export const Basic = ({
  items,
  onClick,
}: MetadataBarProps & {
  onClick: (type: string) => void;
}) => {
  const { width, height, ref } = useResizeDetector();
  // eslint-disable-next-line no-param-reassign
  items[0].onClick = onClick;
  return (
    <div
      ref={ref}
      css={css`
        margin-top: 70px;
        margin-left: 80px;
        overflow: auto;
        min-width: ${168}px;
        max-width: ${740}px;
        resize: horizontal;
      `}
    >
      <MetadataBar items={items} />
      <span
        css={css`
          position: absolute;
          top: 150px;
          left: 115px;
        `}
      >{`${width}x${height}`}</span>
    </div>
  );
};

Basic.args = {
  items: [
    {
      type: MetadataType.Sql,
      title: 'Click to view query',
    },
    {
      type: MetadataType.Owner,
      createdBy: 'Jane Smith',
      owners: ['John Doe', 'Mary Wilson'],
      createdOn: A_WEEK_AGO,
    },
    {
      type: MetadataType.LastModified,
      value: A_WEEK_AGO,
      modifiedBy: 'Jane Smith',
    },
    {
      type: MetadataType.Tags,
      values: ['management', 'research', 'poc'],
    },
    {
      type: MetadataType.Dashboards,
      title: 'Added to 452 dashboards',
      description:
        'To preview the list of dashboards go to "More" settings on the right.',
    },
  ],
};

Basic.argTypes = {
  onClick: {
    action: 'onClick',
    table: {
      disable: true,
    },
  },
};

// Interactive story for docs generation
export const InteractiveMetadataBar = (args: MetadataBarProps) => (
  <MetadataBar {...args} />
);

InteractiveMetadataBar.args = {};

InteractiveMetadataBar.argTypes = {};

InteractiveMetadataBar.parameters = {
  docs: {
    staticProps: {
      items: [
        { type: 'sql', title: 'Click to view query' },
        {
          type: 'owner',
          createdBy: 'Jane Smith',
          owners: ['John Doe', 'Mary Wilson'],
          createdOn: 'a week ago',
        },
        {
          type: 'lastModified',
          value: 'a week ago',
          modifiedBy: 'Jane Smith',
        },
        { type: 'tags', values: ['management', 'research', 'poc'] },
        {
          type: 'dashboards',
          title: 'Added to 3 dashboards',
          description: 'To preview the list of dashboards go to More settings.',
        },
      ],
    },
    liveExample: `function Demo() {
  const items = [
    { type: 'sql', title: 'Click to view query' },
    {
      type: 'owner',
      createdBy: 'Jane Smith',
      owners: ['John Doe', 'Mary Wilson'],
      createdOn: 'a week ago',
    },
    {
      type: 'lastModified',
      value: 'a week ago',
      modifiedBy: 'Jane Smith',
    },
    { type: 'tags', values: ['management', 'research', 'poc'] },
  ];
  return <MetadataBar items={items} />;
}`,
    examples: [
      {
        title: 'Minimal Metadata',
        code: `function MinimalMetadata() {
  const items = [
    { type: 'owner', createdBy: 'Admin', owners: ['Admin'], createdOn: 'yesterday' },
    { type: 'lastModified', value: '2 hours ago', modifiedBy: 'Admin' },
  ];
  return <MetadataBar items={items} />;
}`,
      },
      {
        title: 'Full Metadata',
        code: `function FullMetadata() {
  const items = [
    { type: 'sql', title: 'SELECT * FROM ...' },
    { type: 'owner', createdBy: 'Jane Smith', owners: ['Jane Smith', 'John Doe', 'Bob Wilson'], createdOn: '2 weeks ago' },
    { type: 'lastModified', value: '3 days ago', modifiedBy: 'John Doe' },
    { type: 'tags', values: ['production', 'finance', 'quarterly'] },
    { type: 'dashboards', title: 'Used in 12 dashboards' },
    { type: 'description', value: 'This chart shows quarterly revenue breakdown by region and product line.' },
    { type: 'rows', title: '1.2M rows' },
    { type: 'table', title: 'public.revenue_data' },
  ];
  return <MetadataBar items={items} />;
}`,
      },
    ],
  },
};
