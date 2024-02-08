import React from 'react';
import { t } from '@superset-ui/core';

import { IKI_FORECAST_MODULE_TYPE } from '../../../../util/componentTypes';
import { NEW_IKI_FORECAST_MODULE_ID } from '../../../../util/constants';
import DraggableNewComponent from '../DraggableNewComponent';

export default function DraggableNewDivider() {
  return (
    <DraggableNewComponent
      id={NEW_IKI_FORECAST_MODULE_ID}
      type={IKI_FORECAST_MODULE_TYPE}
      label={t('Forecast')}
      description="Modular Interactive Forecasting Component"
      className="fa fa-bars"
    />
  );
}
