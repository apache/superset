import React from 'react';
import { Meta, StoryFn } from '@storybook/react';
import IconCard, { IconCardProps } from './IconCard';

export default {
  title: 'Components/IconCard',
  component: IconCard,
  argTypes: {
    buttonText: { control: 'text' },
    icon: { control: 'text' },
    altText: { control: 'text' },
  },
} as Meta<typeof IconCard>;

const Template: StoryFn<typeof IconCard> = (args) => <IconCard {...args} />;

export const Default = Template.bind({});
Default.args = {
  buttonText: 'Database',
  icon: 'https://via.placeholder.com/100', // Placeholder image
  altText: 'Database Icon',
};

export const WithoutIcon = Template.bind({});
WithoutIcon.args = {
  buttonText: 'No Icon',
  icon: '',
  altText: 'No Icon',
};
