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

const bigNumberVizGetConditionalMessageInfo = (
  props: BigNumberVizProps,
  bigNumber?: DataRecordValue,
) => {
  const { conditionalMessageColorFormatters } = props;

  let colorConditionalMessage: string | undefined;
  let conditionalMessage: string | undefined;
  if (
    Array.isArray(conditionalMessageColorFormatters) &&
    conditionalMessageColorFormatters.length > 0
  ) {
    conditionalMessageColorFormatters!.forEach(formatter => {
      if (typeof bigNumber === 'number') {
        colorConditionalMessage = formatter.getColorFromValue(bigNumber);
        // conditionalMessage = formatter.messageEN ?? formatter.messageRU;
        conditionalMessage =
          formatter.message || formatter.messageEN || formatter.messageRU;
      }
    });
  }

  return {
    colorConditionalMessage,
    conditionalMessage,
  };
};

export { bigNumberVizGetColorDodo, bigNumberVizGetConditionalMessageInfo };
