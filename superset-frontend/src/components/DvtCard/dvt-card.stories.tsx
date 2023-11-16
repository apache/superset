import React, { useState } from 'react';
import DvtCard, { DvtCardProps } from '.';
import { supersetTheme } from '@superset-ui/core';

export default {
  title: 'Dvt-Components/DvtCard',
  component: DvtCard,
  argTypes: {
    isFavorite: { control: 'boolean' },
  },
};

export const Default = (args: DvtCardProps) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  return (
    <div
      style={{
        padding: 20,
        backgroundColor: supersetTheme.colors.dvt.grayscale.light2,
        height: '88vh',
      }}
    >
      <DvtCard {...args} isFavorite={isFavorite} setFavorite={setIsFavorite} />
    </div>
  );
};

Default.args = {
  title: 'card title',
  label: 'Label',
  description:
    'Monitors real-time network stats like latency and uptime for smooth operations.',
};
