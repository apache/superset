import {isBoolean, array} from 'vega-util';
import {SUM_OPS} from './aggregate';
import {NonPositionChannel, NONPOSITION_CHANNELS, X, X2, Y2} from './channel';
import {
  Field,
  getTypedFieldDef,
  isFieldDef,
  isStringFieldDef,
  PositionFieldDef,
  TypedFieldDef,
  vgField
} from './channeldef';
import {channelHasField, Encoding, isAggregate} from './encoding';
import * as log from './log';
import {AREA, BAR, CIRCLE, isMarkDef, isPathMark, LINE, Mark, MarkDef, POINT, RULE, SQUARE, TEXT, TICK} from './mark';
import {ScaleType} from './scale';
import {contains, Flag} from './util';

export type StackOffset = 'zero' | 'center' | 'normalize';

const STACK_OFFSET_INDEX: Flag<StackOffset> = {
  zero: 1,
  center: 1,
  normalize: 1
};

export function isStackOffset(s: string): s is StackOffset {
  return !!STACK_OFFSET_INDEX[s];
}

export interface StackProperties {
  /** Dimension axis of the stack. */
  groupbyChannel: 'x' | 'y';

  /** Measure axis of the stack. */
  fieldChannel: 'x' | 'y';

  /** Stack-by fields e.g., color, detail */
  stackBy: {
    fieldDef: TypedFieldDef<string>;
    channel: NonPositionChannel;
  }[];

  /**
   * See `stack` property of Position Field Def.
   */
  offset: StackOffset;

  /**
   * Whether this stack will produce impute transform
   */
  impute: boolean;
}

export const STACKABLE_MARKS = [BAR, AREA, RULE, POINT, CIRCLE, SQUARE, LINE, TEXT, TICK];
export const STACK_BY_DEFAULT_MARKS = [BAR, AREA];

function potentialStackedChannel(encoding: Encoding<Field>): 'x' | 'y' | undefined {
  const xDef = encoding.x;
  const yDef = encoding.y;

  if (isFieldDef(xDef) && isFieldDef(yDef)) {
    if (xDef.type === 'quantitative' && yDef.type === 'quantitative') {
      if (xDef.stack) {
        return 'x';
      } else if (yDef.stack) {
        return 'y';
      }
      // if there is no explicit stacking, only apply stack if there is only one aggregate for x or y
      if (!!xDef.aggregate !== !!yDef.aggregate) {
        return xDef.aggregate ? 'x' : 'y';
      }
    } else if (xDef.type === 'quantitative') {
      return 'x';
    } else if (yDef.type === 'quantitative') {
      return 'y';
    }
  } else if (isFieldDef(xDef) && xDef.type === 'quantitative') {
    return 'x';
  } else if (isFieldDef(yDef) && yDef.type === 'quantitative') {
    return 'y';
  }
  return undefined;
}

// Note: CompassQL uses this method and only passes in required properties of each argument object.
// If required properties change, make sure to update CompassQL.
export function stack(
  m: Mark | MarkDef,
  encoding: Encoding<Field>,
  opt: {
    disallowNonLinearStack?: boolean; // This option is for CompassQL
  } = {}
): StackProperties {
  const mark = isMarkDef(m) ? m.type : m;
  // Should have stackable mark
  if (!contains(STACKABLE_MARKS, mark)) {
    return null;
  }

  const fieldChannel = potentialStackedChannel(encoding);
  if (!fieldChannel) {
    return null;
  }

  const stackedFieldDef = encoding[fieldChannel] as PositionFieldDef<string>;
  const stackedField = isStringFieldDef(stackedFieldDef) ? vgField(stackedFieldDef, {}) : undefined;

  const dimensionChannel = fieldChannel === 'x' ? 'y' : 'x';
  const dimensionDef = encoding[dimensionChannel];
  const dimensionField = isStringFieldDef(dimensionDef) ? vgField(dimensionDef, {}) : undefined;

  // Should have grouping level of detail that is different from the dimension field
  const stackBy = NONPOSITION_CHANNELS.reduce((sc, channel) => {
    // Ignore tooltip in stackBy (https://github.com/vega/vega-lite/issues/4001)
    if (channel !== 'tooltip' && channelHasField(encoding, channel)) {
      const channelDef = encoding[channel];
      array(channelDef).forEach(cDef => {
        const fieldDef = getTypedFieldDef(cDef);
        if (fieldDef.aggregate) {
          return;
        }

        // Check whether the channel's field is identical to x/y's field or if the channel is a repeat
        const f = isStringFieldDef(fieldDef) ? vgField(fieldDef, {}) : undefined;
        if (
          // if fielddef is a repeat, just include it in the stack by
          !f ||
          // otherwise, the field must be different from x and y fields.
          (f !== dimensionField && f !== stackedField)
        ) {
          sc.push({channel, fieldDef});
        }
      });
    }
    return sc;
  }, []);

  // Automatically determine offset
  let offset: StackOffset;
  if (stackedFieldDef.stack !== undefined) {
    if (isBoolean(stackedFieldDef.stack)) {
      offset = stackedFieldDef.stack ? 'zero' : null;
    } else {
      offset = stackedFieldDef.stack;
    }
  } else if (stackBy.length > 0 && contains(STACK_BY_DEFAULT_MARKS, mark)) {
    // Bar and Area with sum ops are automatically stacked by default
    offset = 'zero';
  }

  if (!offset || !isStackOffset(offset)) {
    return null;
  }

  if (isAggregate(encoding) && stackBy.length === 0) {
    return null;
  }

  // warn when stacking non-linear
  if (stackedFieldDef.scale && stackedFieldDef.scale.type && stackedFieldDef.scale.type !== ScaleType.LINEAR) {
    if (opt.disallowNonLinearStack) {
      return null;
    } else {
      log.warn(log.message.cannotStackNonLinearScale(stackedFieldDef.scale.type));
    }
  }

  // Check if it is a ranged mark
  if (channelHasField(encoding, fieldChannel === X ? X2 : Y2)) {
    if (stackedFieldDef.stack !== undefined) {
      log.warn(log.message.cannotStackRangedMark(fieldChannel));
    }
    return null;
  }

  // Warn if stacking non-summative aggregate
  if (stackedFieldDef.aggregate && !contains(SUM_OPS, stackedFieldDef.aggregate)) {
    log.warn(log.message.stackNonSummativeAggregate(stackedFieldDef.aggregate));
  }

  return {
    groupbyChannel: dimensionDef ? dimensionChannel : undefined,
    fieldChannel,
    impute: stackedFieldDef.impute === null ? false : isPathMark(mark),
    stackBy,
    offset
  };
}
