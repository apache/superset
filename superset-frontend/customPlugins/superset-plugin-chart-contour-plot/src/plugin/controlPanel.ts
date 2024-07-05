// import { t, validateNonEmpty } from '@superset-ui/core';
// import {
//   ControlPanelConfig,
//   sections,
//   sharedControls,
// } from '@superset-ui/chart-controls';

// const config: ControlPanelConfig = {
//   controlPanelSections: [
//     {
//       label: t('Query'),
//       expanded: true,
//       controlSetRows: [
//         [
//           {
//             name: 'x_axis_column',
//             config: {
//               ...sharedControls.groupby,
//               label: t('X Axis Column'),
//               description: t('Column to use for the X axis'),
//               validators: [validateNonEmpty],
//             },
//           },
//         ],
//         [
//           {
//             name: 'y_axis_column',
//             config: {
//               ...sharedControls.groupby,
//               label: t('Y Axis Column'),
//               description: t('Column to use for the Y axis'),
//               validators: [validateNonEmpty],
//             },
//           },
//         ],
//         [
//           {
//             name: 'z_axis_column',
//             config: {
//               ...sharedControls.groupby,
//               label: t('Z Axis Column'),
//               description: t('Column to use for the Z axis'),
//               validators: [validateNonEmpty],
//             },
//           },
//         ],
//       ],
//     },
//     {
//       label: t('Chart Options'),
//       expanded: true,
//       controlSetRows: [
//         [
//           {
//             name: 'header_text',
//             config: {
//               type: 'TextControl',
//               default: 'Contour Plot',
//               renderTrigger: true,
//               label: t('Header Text'),
//               description: t('The text you want to see in the header'),
//             },
//           },
//         ],
//         [
//           {
//             name: 'bold_text',
//             config: {
//               type: 'CheckboxControl',
//               label: t('Bold Text'),
//               renderTrigger: true,
//               default: true,
//               description: t('A checkbox to make the header text bold'),
//             },
//           },
//         ],
//         [
//           {
//             name: 'header_font_size',
//             config: {
//               type: 'SelectControl',
//               label: t('Font Size'),
//               default: 'xl',
//               choices: [
//                 ['xxs', 'xx-small'],
//                 ['xs', 'x-small'],
//                 ['s', 'small'],
//                 ['m', 'medium'],
//                 ['l', 'large'],
//                 ['xl', 'x-large'],
//                 ['xxl', 'xx-large'],
//               ],
//               renderTrigger: true,
//               description: t('The size of your header font'),
//             },
//           },
//         ],
//         [
//           {
//             name: 'contour_levels',
//             config: {
//               type: 'SliderControl',
//               label: t('Number of Contour Levels'),
//               default: 10,
//               min: 1,
//               max: 20,
//               renderTrigger: true,
//               description: t('Number of contour levels to display'),
//             },
//           },
//         ],
//         [
//           {
//             name: 'color_scheme',
//             config: {
//               type: 'ColorSchemeControl',
//               label: t('Color Scheme'),
//               default: 'd3Category10',
//               renderTrigger: true,
//               description: t('Color scheme for the contour plot'),
//               mapStateToProps: state => ({
//                 schemes: state?.chart?.colorScheme,
//               }),
//             },
//           },
//         ],
//         [
//           {
//             name: 'show_labels',
//             config: {
//               type: 'CheckboxControl',
//               label: t('Show Labels'),
//               default: true,
//               renderTrigger: true,
//               description: t('Whether to show labels on contour lines'),
//             },
//           },
//         ],
//       ],
//     },
//   ],
// };

// export default config;

import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'cols',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to group by'),
            },
          },
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              // it's possible to add validators to controls if
              // certain selections/types need to be enforced
              validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: sharedControls.row_limit,
          },
        ],
        // {
        //   label: t('Query'),
        //   expanded: true,
        //   controlSetRows: [
        //     [
        //       {
        //         name: 'x_axis_column',
        //         config: {
        //           ...sharedControls.groupby,
        //           label: t('X Axis Column'),
        //           validators: [validateNonEmpty],
        //         },
        //       },
        //     ],
        //     [
        //       {
        //         name: 'y_axis_column',
        //         config: {
        //           ...sharedControls.groupby,
        //           label: t('Y Axis Column'),
        //           validators: [validateNonEmpty],
        //         },
        //       },
        //     ],
        //     [
        //       {
        //         name: 'z_axis_column',
        //         config: {
        //           ...sharedControls.groupby,
        //           label: t('Z Axis Column'),
        //           validators: [validateNonEmpty],
        //         },
        //       },
        //     ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'header_text',
            config: {
              type: 'TextControl',
              default: 'Contour Plot',
              renderTrigger: true,
              label: t('Header Text'),
              description: t('The text you want to see in the header'),
            },
          },
        ],
        [
          {
            name: 'bold_text',
            config: {
              type: 'CheckboxControl',
              label: t('Bold Text'),
              renderTrigger: true,
              default: true,
              description: t('A checkbox to make the header text bold'),
            },
          },
        ],
        [
          {
            name: 'header_font_size',
            config: {
              type: 'SelectControl',
              label: t('Font Size'),
              default: 'xl',
              choices: [
                ['xxs', 'xx-small'],
                ['xs', 'x-small'],
                ['s', 'small'],
                ['m', 'medium'],
                ['l', 'large'],
                ['xl', 'x-large'],
                ['xxl', 'xx-large'],
              ],
              renderTrigger: true,
              description: t('The size of your header font'),
            },
          },
        ],
        [
          {
            name: 'contour_levels',
            config: {
              type: 'SliderControl',
              label: t('Number of Contour Levels'),
              default: 10,
              min: 1,
              max: 20,
              renderTrigger: true,
              description: t('Number of contour levels to display'),
            },
          },
        ],
        [
          {
            name: 'color_scheme',
            config: {
              type: 'ColorSchemeControl',
              label: t('Color Scheme'),
              default: 'd3Category10',
              renderTrigger: true,
              description: t('Color scheme for the contour plot'),
              mapStateToProps: state => ({
                schemes: state?.chart?.colorScheme,
              }),
            },
          },
        ],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              default: true,
              renderTrigger: true,
              description: t('Whether to show labels on contour lines'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
