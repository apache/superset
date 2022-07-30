import React from 'react';

export interface ButtonCellProps {
  label: string;
  handleClick: Function;
  tooltip?: string;
}

export function ButtonCell(props: ButtonCellProps) {
  const { label, handleClick, tooltip } = props;

  return (
    <button title={tooltip} type="button" onClick={() => handleClick?.(label)}>
      {label}
    </button>
  );
}

export default ButtonCell;
