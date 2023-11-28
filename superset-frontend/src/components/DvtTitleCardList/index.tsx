import React from 'react';
import DvtCard from '../DvtCard';
import DvtTitleTotal from '../DvtTitleTotal';
import {
  DvtCardListButton,
  DvtCardListHead,
  StyledDvtCardList,
  StyledDvtTitleCardList,
} from './dvt-title-card-list.module';
import Icon from '../Icons/Icon';
import { supersetTheme } from '@superset-ui/core';

export interface CardDataProps {
  id: number;
  title: string;
  label: string;
  description: string;
  isFavorite: boolean;
  link: string;
}

export interface DvtTitleCardListProps {
  title: string;
  data: CardDataProps[];
  setFavorites: (id: number, isFavorite: boolean) => void;
}

const DvtTitleCardList: React.FC<DvtTitleCardListProps> = ({
  title,
  data,
  setFavorites,
}) => (
  <StyledDvtTitleCardList>
    <DvtCardListHead>
      <DvtTitleTotal title={title} total={data.length} />
      <DvtCardListButton>
        <Icon
          fileName="plus_large"
          iconSize="xl"
          iconColor={supersetTheme.colors.dvt.grayscale.base}
        />
        <Icon
          fileName="more_horiz"
          iconSize="xl"
          iconColor={supersetTheme.colors.dvt.grayscale.base}
        />
      </DvtCardListButton>
    </DvtCardListHead>

    <StyledDvtCardList>
      {data.map(item => (
        <DvtCard
          key={item.id}
          title={item.title}
          label={item.label}
          description={item.description}
          isFavorite={item.isFavorite}
          setFavorite={() => setFavorites(item.id, item.isFavorite)}
          link={item.link}
        />
      ))}
    </StyledDvtCardList>
  </StyledDvtTitleCardList>
);

export default DvtTitleCardList;
