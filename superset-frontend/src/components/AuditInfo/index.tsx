import React from 'react';

import Owner from 'src/types/Owner';
import { Tooltip } from 'src/components/Tooltip';
import getOwnerName from 'src/utils/getOwnerName';
import { t } from '@superset-ui/core';

export const enum AuditInfoType {
  Modified = 'Modified',
  Created = 'Created',
}

export type AuditInfoProps = {
  type: AuditInfoType;
  user?: Owner;
  date: string;
};

export const AuditInfo = ({ type, user, date }: AuditInfoProps) => {
  const dateSpan = (
    <span className="no-wrap" data-test="audit-info-date">
      {date}
    </span>
  );

  if (user) {
    const userName = getOwnerName(user);
    const title =
      type === AuditInfoType.Created
        ? t('Created by: %s', userName)
        : t('Modified by: %s', userName);
    return (
      <Tooltip title={title} placement="bottom">
        {dateSpan}
      </Tooltip>
    );
  }
  return dateSpan;
};
