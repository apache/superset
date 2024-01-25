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
import React from 'react';
import { supersetTheme } from '@superset-ui/core';
import DvtCard from '../DvtCard';
import DvtTitleTotal from '../DvtTitleTotal';
import {
  DvtCardListButton,
  DvtCardListHead,
  StyledDvtCardList,
  StyledDvtTitleCardList,
} from './dvt-title-card-list.module';
import Icon from '../Icons/Icon';
import { OptionProps } from '../DvtDropdown';

export interface CardDataProps {
  id: number;
  title: string;
  label: string;
  description: string;
  isFavorite: boolean | null;
  link: string;
}

export interface DvtTitleCardListProps {
  title: string;
  data: CardDataProps[];
  setFavorites?: (id: number, isFavorite: boolean) => void;
  dropdown?: OptionProps[];
}

const DvtTitleCardList: React.FC<DvtTitleCardListProps> = ({
  title,
  data,
  setFavorites,
  dropdown,
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
          setFavorite={() =>
            setFavorites?.(
              item.id,
              item.isFavorite === null ? false : item.isFavorite,
            )
          }
          link={item.link}
          dropdown={dropdown}
        />
      ))}
    </StyledDvtCardList>
  </StyledDvtTitleCardList>
);

export default DvtTitleCardList;
