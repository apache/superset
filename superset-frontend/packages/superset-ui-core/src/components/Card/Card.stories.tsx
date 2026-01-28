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
import { Card } from '.';
import type { CardProps } from './types';

export default {
  title: 'Components/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'A container component for grouping related content. ' +
          'Supports titles, borders, loading states, and hover effects.',
      },
    },
  },
};

export const InteractiveCard = (args: CardProps) => <Card {...args} />;

InteractiveCard.args = {
  padded: true,
  title: 'Dashboard Overview',
  children: 'This card displays a summary of your dashboard metrics and recent activity.',
  bordered: true,
  loading: false,
  hoverable: false,
};

InteractiveCard.argTypes = {
  padded: {
    control: { type: 'boolean' },
    description: 'Whether the card content has padding.',
  },
  title: {
    control: { type: 'text' },
    description: 'Title text displayed at the top of the card.',
  },
  children: {
    control: { type: 'text' },
    description: 'The content inside the card.',
  },
  bordered: {
    control: { type: 'boolean' },
    description: 'Whether to show a border around the card.',
  },
  loading: {
    control: { type: 'boolean' },
    description: 'Whether to show a loading skeleton.',
  },
  hoverable: {
    control: { type: 'boolean' },
    description: 'Whether the card lifts on hover.',
  },
  onClick: {
    table: { disable: true },
    action: 'onClick',
  },
  theme: {
    table: { disable: true },
  },
};

InteractiveCard.parameters = {
  docs: {
    liveExample: `function Demo() {
  return (
    <Card title="Dashboard Overview" bordered>
      This card displays a summary of your dashboard metrics and recent activity.
    </Card>
  );
}`,
    examples: [
      {
        title: 'Card States',
        code: `function CardStates() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <Card title="Default" bordered style={{ width: 250 }}>
        Default card content.
      </Card>
      <Card title="Hoverable" bordered hoverable style={{ width: 250 }}>
        Hover over this card.
      </Card>
      <Card title="Loading" bordered loading style={{ width: 250 }}>
        This content is hidden while loading.
      </Card>
      <Card title="No Border" style={{ width: 250 }}>
        Borderless card.
      </Card>
    </div>
  );
}`,
      },
    ],
  },
};
