import { DataRecordValue } from '@superset-ui/core';
import { BigNumberVizProps } from '../../BigNumber/types';

const bigNumberVizGetColorDodo = (
  props: BigNumberVizProps,
  bigNumber?: DataRecordValue,
) => {
  const { colorThresholdFormatters, percentChange, percentChangeFormatter } =
    props;
  const hasThresholdColorFormatter =
    Array.isArray(colorThresholdFormatters) &&
    colorThresholdFormatters.length > 0;

  let numberColor;
  if (hasThresholdColorFormatter) {
    colorThresholdFormatters!.forEach(formatter => {
      if (typeof bigNumber === 'number') {
        numberColor = formatter.getColorFromValue(bigNumber);
      }
    });
  } else {
    numberColor = 'black';
  }

  let colorPercentChange;
  if (
    Array.isArray(percentChangeFormatter) &&
    percentChangeFormatter.length > 0
  ) {
    percentChangeFormatter!.forEach(formatter => {
      if (typeof percentChange === 'number') {
        colorPercentChange = formatter.getColorFromValue(percentChange);
      }
    });
  }

  return {
    numberColor,
    colorPercentChange,
  };
};

export { bigNumberVizGetColorDodo };
