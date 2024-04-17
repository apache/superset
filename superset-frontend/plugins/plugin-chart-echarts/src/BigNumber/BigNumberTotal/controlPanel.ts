// DODO was here
import { smartDateFormatter, t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  sections,
} from '@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';
import { BigNumberControlPanelConditionalFormatting } from '../../DodoExtensions/BigNumber/BigNumberTotal/controlPanelDodo';
import {
  Alignment,
  conditionalMessageFontSize,
} from '../../DodoExtensions/BigNumber/sharedControls';
import { controlPanelCommonChartDescription } from '../../DodoExtensions/BigNumber/controlPanelCommon';

export default {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Display settings'),
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        [
          {
            name: 'subheader',
            config: {
              type: 'TextControl',
              label: t('Subheader'),
              renderTrigger: true,
              description: t(
                'Description text that shows up below your Big Number',
              ),
            },
          },
        ],
      ],
    },
    { ...controlPanelCommonChartDescription }, // DODO added #32232659
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [Alignment], // DODO added #32232659
        [headerFontSize],
        [subheaderFontSize],
        [conditionalMessageFontSize], // DODO added #32232659
        ['y_axis_format'],
        ['currency_format'],
        [
          {
            name: 'time_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
              default: smartDateFormatter.id,
            },
          },
        ],
        [
          {
            name: 'force_timestamp_formatting',
            config: {
              type: 'CheckboxControl',
              label: t('Force date format'),
              renderTrigger: true,
              default: false,
              description: t(
                'Use date formatting even when metric value is not a timestamp',
              ),
            },
          },
        ],
      ],
    },
    { ...BigNumberControlPanelConditionalFormatting }, // DODO added}
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
} as ControlPanelConfig;
