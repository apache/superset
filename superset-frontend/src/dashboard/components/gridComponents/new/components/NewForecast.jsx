import React from 'react';
import { t } from '@superset-ui/core';

import { IKI_FORECAST_TYPE } from '../../../../util/componentTypes';
import { NEW_IKI_FORECAST_ID } from '../../../../util/constants';
import DraggableNewComponent from '../DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_IKI_FORECAST_ID}
      type={IKI_FORECAST_TYPE}
      label={t('Forecast')}
      description="Forecast with Expert in the Loop"
      className="fa fa-line-chart"
      demandApp
    />
  );
}
