import React, { ReactNode } from 'react';
import { t } from '@superset-ui/core';
import { SupersetAppState } from './types';


export function jsFunctionControl(
  label: ReactNode,
  description: ReactNode,
  extraDescr = null,
  height = 100,
  defaultText = '',
) {
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: (
      <div>
        <p>{description}</p>
        {extraDescr}
      </div>
    ),
    mapStateToProps: (state: SupersetAppState) => ({
      // eslint-disable-next-line no-negated-condition
      warning: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS
        ? t(
            'This functionality is disabled in your environment for security reasons.',
          )
        : null,
      readOnly: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS,
    }),
  };
}
