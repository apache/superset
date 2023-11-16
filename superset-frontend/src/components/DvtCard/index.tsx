import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
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
import { supersetTheme } from '@superset-ui/core';

export interface DvtCardProps {
  title: string;
  label: string;
  description: string;
  isFavorite: boolean;
  setFavorite: React.Dispatch<React.SetStateAction<boolean>>;
  link?: string;
}

const DvtCard: React.FC<DvtCardProps> = ({
  title,
  label,
  description,
  isFavorite,
  setFavorite,
  link = '',
}) => {
  const history = useHistory();
  const [hoverOnLink, setHoverOnLink] = useState<boolean>(false);

  const truncatedFormat = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

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
          <IconButton>
            <Icon
              fileName="more_vert"
              iconSize="xl"
              iconColor={supersetTheme.colors.dvt.text.bold}
            />
          </IconButton>
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
