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
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { supersetTheme } from '@superset-ui/core';
import {
  DvtCardDescription,
  DvtCardLinkButton,
  DvtCardLabel,
  DvtCardTitle,
  DvtHeadButtons,
  IconButton,
  DvtCardHead,
  StyledDvtCard,
} from './dvt-card.module';
import Icons from '../Icons';
import Icon from '../Icons/Icon';
import DvtDropdown, { OptionProps } from '../DvtDropdown';

export interface DvtCardProps {
  title: string;
  label: string;
  description: string;
  isFavorite: boolean | null;
  setFavorite: React.Dispatch<React.SetStateAction<boolean>>;
  link?: string;
  dropdown?: OptionProps[];
  id: number;
}

const DvtCard: React.FC<DvtCardProps> = ({
  title,
  label,
  description,
  isFavorite,
  setFavorite,
  dropdown,
  id,
  link = '',
}) => {
  const history = useHistory();
  const [hoverOnLink, setHoverOnLink] = useState<boolean>(false);

  const truncatedFormat = (text: string, maxLength: number) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  const handleFavoriteClick = () => {
    setFavorite(!isFavorite);
  };

  return (
    <StyledDvtCard
      onMouseOver={() => !hoverOnLink && setHoverOnLink(true)}
      onMouseLeave={() => setHoverOnLink(false)}
    >
      <DvtCardHead>
        <DvtCardTitle>{truncatedFormat(title, 17)}</DvtCardTitle>
        <DvtHeadButtons>
          {isFavorite !== null && (
            <IconButton onClick={handleFavoriteClick}>
              {!isFavorite ? (
                <Icons.StarOutlined
                  iconSize="xl"
                  iconColor={supersetTheme.colors.dvt.text.bold}
                />
              ) : (
                <Icons.StarFilled
                  iconSize="xl"
                  iconColor={supersetTheme.colors.alert.base}
                />
              )}
            </IconButton>
          )}

          {dropdown && <DvtDropdown data={dropdown} id={id} icon="more_vert" />}
        </DvtHeadButtons>
      </DvtCardHead>
      <DvtCardLabel>{truncatedFormat(label, 25)}</DvtCardLabel>
      <DvtCardDescription>
        {truncatedFormat(description, 100)}
      </DvtCardDescription>
      <DvtCardLinkButton>
        {hoverOnLink && (
          <IconButton fadeScale onClick={() => link && history.push(link)}>
            <Icon
              fileName="link"
              iconSize="l"
              iconColor={supersetTheme.colors.success.dark1}
            />
          </IconButton>
        )}
      </DvtCardLinkButton>
    </StyledDvtCard>
  );
};

export default DvtCard;
