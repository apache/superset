import React, { ReactNode } from 'react';

const RowWrapper = ({ children }: { children: ReactNode }) => (
  <div className="row">{children}</div>
);

export { RowWrapper };
