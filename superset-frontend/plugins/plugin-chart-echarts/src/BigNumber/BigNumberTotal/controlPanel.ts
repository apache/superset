// DODO was here
import { SMART_DATE_ID, t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';
// DODO added 45525377
import {
  Alignment,
  conditionalMessageFontSize,
} from '../../DodoExtensions/BigNumber/sharedControls';
import { BigNumberControlPanelConditionalFormatting } from '../../DodoExtensions/BigNumber/BigNumberTotal/controlPanelDodo';

export default {
  controlPanelSections: [
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
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [Alignment], // DODO added 45525377
        [headerFontSize],
        [subheaderFontSize],
        [conditionalMessageFontSize], // DODO added 45525377
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
              default: SMART_DATE_ID,
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
        // DODO commented out 45525377
        // [
        //   {
        //     name: 'conditional_formatting',
        //     config: {
        //       type: 'ConditionalFormattingControl',
        //       renderTrigger: true,
        //       label: t('Conditional Formatting'),
        //       description: t('Apply conditional color formatting to metric'),
        //       shouldMapStateToProps() {
        //         return true;
        //       },
        //       mapStateToProps(explore, _, chart) {
        //         const verboseMap = explore?.datasource?.hasOwnProperty(
        //           'verbose_map',
        //         )
        //           ? (explore?.datasource as Dataset)?.verbose_map
        //           : explore?.datasource?.columns ?? {};
        //         const { colnames, coltypes } =
        //           chart?.queriesResponse?.[0] ?? {};
        //         const numericColumns =
        //           Array.isArray(colnames) && Array.isArray(coltypes)
        //             ? colnames
        //                 .filter(
        //                   (colname: string, index: number) =>
        //                     coltypes[index] === GenericDataType.Numeric,
        //                 )
        //                 .map(colname => ({
        //                   value: colname,
        //                   label: verboseMap[colname] ?? colname,
        //                 }))
        //             : [];
        //         return {
        //           columnOptions: numericColumns,
        //           verboseMap,
        //         };
        //       },
        //     },
        //   },
        // ],
      ],
    },
    { ...BigNumberControlPanelConditionalFormatting }, // DODO added 45525377
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
