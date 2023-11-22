import React from 'react';
import { t } from '@superset-ui/core';

import { IKI_MODEL_METRICS_TYPE } from '../../../util/componentTypes';
import { NEW_IKI_MODEL_METRICS_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_IKI_MODEL_METRICS_ID}
      type={IKI_MODEL_METRICS_TYPE}
      label={t('Model Metrics')}
      description="Evaluate the performance of your model"
      className="fa fa-percent"
      demandApp
    />
  );
}
