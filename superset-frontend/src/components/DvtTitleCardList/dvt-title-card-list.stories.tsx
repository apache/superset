import React, { useState } from 'react';
import { Meta } from '@storybook/react';
import DvtTitleCardList, { CardDataProps, DvtTitleCardListProps } from '.';

export default {
  title: 'Dvt-Components/DvtTitleCardList',
  component: DvtTitleCardList,
} as Meta;

const dummyData = [
  {
    id: 1,
    title: 'Card 1',
    label: 'Label 1',
    description: 'Description 1',
    link: '/',
    isFavorite: false,
  },
  {
    id: 2,
    title: 'Card 2',
    label: 'Label 2',
    description: 'Description 2',
    link: '/',
    isFavorite: false,
  },
  {
    id: 3,
    title: 'Card 3',
    label: 'Label 3',
    description: 'Description 3',
    link: '/',
    isFavorite: false,
  },
  {
    id: 4,
    title: 'Card 4',
    label: 'Label 4',
    description: 'Description 4',
    link: '/',
    isFavorite: false,
  },
  {
    id: 5,
    title: 'Card 5',
    label: 'Label 5',
    description: 'Description 5',
    link: '/',
    isFavorite: false,
  },
  {
    id: 6,
    title: 'Card 6',
    label: 'Label 6',
    description: 'Description 6',
    link: '/',
    isFavorite: false,
  },
  {
    id: 7,
    title: 'Card 7',
    label: 'Label 7',
    description: 'Description 7',
    link: '/',
    isFavorite: false,
  },
];

export const Default = (args: DvtTitleCardListProps) => {
  const [data, setData] = useState<CardDataProps[]>(dummyData);
  const handleFavorites = (id: number, isFavorite: boolean) => {
    const findRemoveCard = data.filter(card => card.id !== id);
    const findCard = data.find(card => card.id === id);
    const updatedData: any = [
      ...findRemoveCard,
      { ...findCard, isFavorite: !isFavorite },
    ].sort((a: any, b: any) => a.id - b.id);
    setData(updatedData);
  };
  return (
    <div style={{ width: '68vw' }}>
      <DvtTitleCardList {...args} data={data} setFavorites={handleFavorites} />
    </div>
  );
};

Default.args = {
  title: 'Example List Title',
};
