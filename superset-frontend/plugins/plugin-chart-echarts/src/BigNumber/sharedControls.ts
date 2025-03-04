// DODO was here

// These are control configurations that are shared ONLY within the BigNumberWithTrendline viz plugin repo.
import { ComparisonType, t } from '@superset-ui/core';
import {
  CustomControlItem,
  D3_FORMAT_OPTIONS, // DODO added 44211769
  SelectControlConfig, // DODO added 44211769
} from '@superset-ui/chart-controls';

export const headerFontSize: CustomControlItem = {
  name: 'header_font_size',
  config: {
    type: 'SelectControl',
    label: t('Big Number Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 0.4,
    // Values represent the percentage of space a header should take
    options: [
      {
        label: t('Tiny'),
        value: 0.2,
      },
      {
        label: t('Small'),
        value: 0.3,
      },
      {
        label: t('Normal'),
        value: 0.4,
      },
      {
        label: t('Large'),
        value: 0.5,
      },
      {
        label: t('Huge'),
        value: 0.6,
      },
    ],
  },
};

export const subheaderFontSize: CustomControlItem = {
  name: 'subheader_font_size',
  config: {
    type: 'SelectControl',
    label: t('Subheader Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 0.15,
    // Values represent the percentage of space a subheader should take
    options: [
      {
        label: t('Tiny'),
        value: 0.125,
      },
      {
        label: t('Small'),
        value: 0.15,
      },
      {
        label: t('Normal'),
        value: 0.2,
      },
      {
        label: t('Large'),
        value: 0.3,
      },
      {
        label: t('Huge'),
        value: 0.4,
      },
    ],
  },
};

// DODO added start 44211769
const yAxisFormatChoices = [['', t('Default')], ...D3_FORMAT_OPTIONS];
export const yAxisFormatOverrides: Partial<
  SelectControlConfig<
    {
      label: string;
      value: string;
    },
    'SelectControl'
  >
> = {
  label: t('Number format'),
  choices: yAxisFormatChoices,
  default: '',
  mapStateToProps: state => {
    const isPercentage =
      state.controls?.comparison_type?.value === ComparisonType.Percentage;
    return {
      choices: isPercentage
        ? yAxisFormatChoices.filter(option => option[0].includes('%'))
        : yAxisFormatChoices,
    };
  },
};
// DODO added stop 44211769
