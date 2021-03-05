import React from 'react';

interface Props {
  select?: JSX.Element;
  refreshBtn?: JSX.Element;
}

export function SelectRow({ select, refreshBtn }: Props) {
  return (
    <div className="section">
      <span className="select">{select}</span>
      <span className="refresh-col">{refreshBtn}</span>
    </div>
  );
}
