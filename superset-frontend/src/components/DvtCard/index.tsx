import React from 'react';
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
import { theme } from 'src/preamble';
import Icon from '../Icons/Icon';

export interface DvtCardProps {
  title: string;
  label: string;
  description: string;
  isFavorite: boolean;
  setFavorite: React.Dispatch<React.SetStateAction<boolean>>;
}

const DvtCard: React.FC<DvtCardProps> = ({
  title,
  label,
  description,
  isFavorite,
  setFavorite,
}) => {
  const maxTitleLength = 20;
  const maxDescriptionLength = 100;

  const truncatedTitle =
    title.length > maxTitleLength
      ? `${title.slice(0, maxTitleLength)}...`
      : title;
  const truncatedDescription =
    description.length > maxDescriptionLength
      ? `${description.slice(0, maxDescriptionLength)}...`
      : description;

  const handleFavoriteClick = () => {
    setFavorite(!isFavorite);
  };

  return (
    <StyledDvtCard>
      <DvtCardHead>
        <DvtCardTitle>{truncatedTitle}</DvtCardTitle>
        <DvtHeadButtons>
          <IconButton onClick={handleFavoriteClick}>
            {!isFavorite ? (
              <Icons.StarOutlined
                iconSize="xl"
                iconColor={theme.colors.dvt.text.bold}
              />
            ) : (
              <Icons.StarFilled
                iconSize="xl"
                iconColor={theme.colors.alert.base}
              />
            )}
          </IconButton>
          <IconButton>
            <Icon
              fileName="more_vert"
              iconSize="xl"
              iconColor={theme.colors.dvt.text.bold}
            />
          </IconButton>
        </DvtHeadButtons>
      </DvtCardHead>
      <DvtCardLabel>{label}</DvtCardLabel>
      <DvtCardDescription>{truncatedDescription}</DvtCardDescription>
      <DvtCardLinkButton>
        <IconButton>
          <Icon
            fileName="link"
            iconSize="l"
            iconColor={theme.colors.success.dark1}
          />
        </IconButton>
      </DvtCardLinkButton>
    </StyledDvtCard>
  );
};

export default DvtCard;
