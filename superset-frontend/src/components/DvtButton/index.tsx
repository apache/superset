import React from 'react';
import { StyledDvtButton } from './DvtButton.module';

export interface DvtButtonProps {
  label: string;
  icon?: string;
  onClick?: () => void;
  colour?: 'primary' | 'success' | 'grayscale';
  typeColour?: 'basic' | 'powder' | 'outline';
  maxWidth?: boolean;
}

const DvtButton: React.FC<DvtButtonProps> = ({
  label,
  icon,
  onClick,
  colour = 'primary',
  typeColour = 'basic',
  maxWidth = false,
}) => (
  <StyledDvtButton
    $label={label}
    $maxWidth={maxWidth}
    $colour={colour}
    $typeColour={typeColour}
    onClick={onClick}
  >
    {icon && <img src={icon} alt="Button Icon" />}
    {label}
  </StyledDvtButton>
);

export default DvtButton;
