import React from 'react';
import { StyledPencil } from './StyledPencil';
import { StyledFlag } from './StyledFlag';
import { TitleLabel } from './TitleLabel';

const LanguageIndicator = ({
  language = 'gb',
  canEdit,
}: {
  language: 'gb' | 'ru';
  canEdit: boolean;
}) => (
  <TitleLabel>
    <StyledFlag language={language} />
    {canEdit && <StyledPencil />}
  </TitleLabel>
);

export { LanguageIndicator };
