import React from 'react';
import Button, { ButtonStyle, ButtonSize } from 'src/components/Button';

export interface ButtonCellProps {
  label: string;
  onClick: Function;
  tooltip?: string;
  buttonStyle?: ButtonStyle;
  buttonSize?: ButtonSize;
}

export function ButtonCell(props: ButtonCellProps) {
  const {
    label,
    onClick,
    tooltip,
    buttonStyle = 'primary',
    buttonSize = 'small',
  } = props;

  return (
    <Button
      buttonStyle={buttonStyle}
      buttonSize={buttonSize}
      onClick={() => onClick?.()}
      key={`${buttonStyle}_${buttonSize}`}
      tooltip={tooltip}
    >
      {label}
    </Button>
  );
}

export default ButtonCell;
