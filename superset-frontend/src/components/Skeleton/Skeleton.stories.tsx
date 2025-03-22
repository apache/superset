import type { Meta, StoryObj } from '@storybook/react';
import Skeleton from './index';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  argTypes: {
    active: { control: 'boolean', description: 'Display animation effect' },
    avatar: { control: 'boolean', description: 'Display avatar skeleton' },
    loading: { control: 'boolean', description: 'Whether skeleton is loading' },
    title: { control: 'boolean', description: 'Show skeleton title' },
    paragraph: { control: 'object', description: 'Show skeleton paragraphs' },
    round: { control: 'boolean', description: 'Make avatar and image round' },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    active: false,
    avatar: false,
    loading: false,
    title: true,
    paragraph: { rows: 3 },
    round: false,
  },
};
