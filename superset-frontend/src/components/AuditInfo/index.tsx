import React from 'react';

import Owner from 'src/types/Owner';
import { Tooltip } from 'src/components/Tooltip';
import getOwnerName from 'src/utils/getOwnerName';
import { t } from '@superset-ui/core';

export type ModifiedInfoProps = {
  user?: Owner;
  date: string;
};

export const ModifiedInfo = ({ user, date }: ModifiedInfoProps) => {
  const dateSpan = (
    <span className="no-wrap" data-test="audit-info-date">
      {date}
    </span>
  );

  if (user) {
    const userName = getOwnerName(user);
    const title = t('Modified by: %s', userName);
    return (
      <Tooltip title={title} placement="bottom">
        {dateSpan}
      </Tooltip>
    );
  }
  return dateSpan;
};
