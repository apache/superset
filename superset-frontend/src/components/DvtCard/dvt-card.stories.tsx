import React, { useState } from 'react';
import DvtCard, { DvtCardProps } from '.';

export default {
  title: 'Dvt-Components/DvtCard',
  component: DvtCard,
  argTypes: {
    isFavorite: {control: 'boolean'},
  }
};

export const Default = (args: DvtCardProps) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  return <DvtCard {...args} isFavorite={isFavorite} setFavorite={setIsFavorite}/>;
};

Default.args = {
  title: 'card title',
  label: 'Label',
  description:
    'Monitors real-time network stats like latency and uptime for smooth operations.',
  };
