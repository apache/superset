import React, { ReactNode } from 'react';

const ColumnWrapper = ({
  children,
  classes,
}: {
  children: ReactNode;
  classes: string;
}) => <div className={classes}>{children}</div>;

export { ColumnWrapper };
