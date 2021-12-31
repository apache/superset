import React, { ReactNode } from 'react';

interface ControlHeaderProps {
  children: ReactNode;
}

export const ControlHeader = ({
  children,
}: ControlHeaderProps): JSX.Element => (
  <div className="ControlHeader">
    <div className="pull-left">
      <span role="button">{children}</span>
    </div>
  </div>
);
