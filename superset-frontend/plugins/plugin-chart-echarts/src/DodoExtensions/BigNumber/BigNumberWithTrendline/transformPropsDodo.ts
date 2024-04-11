import {
  getColorFormatters,
  getColorFormattersDodoPercentChange,
} from '@superset-ui/chart-controls';
import { DataRecord, NumberFormatter } from '@superset-ui/core';
import { BigNumberWithTrendlineChartProps } from '../../../BigNumber/types';

const BigNumberWithTrendLineTransformPropsDodo = (params: {
  formData: BigNumberWithTrendlineChartProps['formData'];
  data: DataRecord[];
  percentChange: number;
  formatPercentChange: NumberFormatter;
}) => {
  const { formData, data, percentChange, formatPercentChange } = params;

  const { conditionalFormatting, comparisonPeriodConditionalFormatting } =
    formData;

  const colorThresholdFormatters =
    getColorFormatters(conditionalFormatting, data, false) ?? [];

  const percentChangeNumber = parseFloat(formatPercentChange(percentChange));

  const percentChangeFormatter =
    getColorFormattersDodoPercentChange(
      comparisonPeriodConditionalFormatting,
      percentChangeNumber,
    ) ?? [];

  return {
    colorThresholdFormatters,
    percentChangeFormatter,
    percentChangeNumber,
  };
};

export { BigNumberWithTrendLineTransformPropsDodo };
