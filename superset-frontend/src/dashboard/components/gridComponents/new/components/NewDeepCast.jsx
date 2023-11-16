import React from 'react';
import { t } from '@superset-ui/core';

import { IKI_DEEPCAST_TYPE } from '../../../../util/componentTypes';
import { NEW_IKI_DEEPCAST_ID } from '../../../../util/constants';
import DraggableNewComponent from '../DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_IKI_DEEPCAST_ID}
      type={IKI_DEEPCAST_TYPE}
      label={t('aiCast')}
      description="aiCast model component"
      className="fa fa-line-chart"
    />
  );
}
