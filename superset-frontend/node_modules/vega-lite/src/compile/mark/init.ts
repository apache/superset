import {Orientation} from 'vega';
import {isBinned, isBinning} from '../../bin';
import {isContinuous, isFieldDef, TypedFieldDef} from '../../channeldef';
import {Config} from '../../config';
import {Encoding, isAggregate} from '../../encoding';
import * as log from '../../log';
import {
  AREA,
  BAR,
  BAR_CORNER_RADIUS_INDEX as BAR_CORNER_RADIUS_END_INDEX,
  CIRCLE,
  IMAGE,
  isMarkDef,
  LINE,
  Mark,
  MarkDef,
  POINT,
  RECT,
  RULE,
  SQUARE,
  TEXT,
  TICK
} from '../../mark';
import {QUANTITATIVE, TEMPORAL} from '../../type';
import {contains, getFirstDefined} from '../../util';
import {getMarkConfig} from '../common';

export function normalizeMarkDef(
  mark: Mark | MarkDef,
  encoding: Encoding<string>,
  config: Config,
  {graticule}: {graticule: boolean}
) {
  const markDef: MarkDef = isMarkDef(mark) ? {...mark} : {type: mark};

  // set orient, which can be overridden by rules as sometimes the specified orient is invalid.
  const specifiedOrient = markDef.orient ?? getMarkConfig('orient', markDef, config);
  markDef.orient = orient(markDef.type, encoding, specifiedOrient);
  if (specifiedOrient !== undefined && specifiedOrient !== markDef.orient) {
    log.warn(log.message.orientOverridden(markDef.orient, specifiedOrient));
  }

  if (markDef.type === 'bar' && markDef.orient) {
    const cornerRadiusEnd =
      markDef.cornerRadiusEnd ??
      getMarkConfig(
        'cornerRadiusEnd' as any, // FIXME: make the typing work with getMarkConfig()
        markDef,
        config
      );
    if (cornerRadiusEnd !== undefined) {
      const newProps = BAR_CORNER_RADIUS_END_INDEX[markDef.orient];
      for (const newProp of newProps) {
        markDef[newProp] = cornerRadiusEnd;
      }

      if (markDef.cornerRadiusEnd !== undefined) {
        delete markDef.cornerRadiusEnd; // no need to keep the original cap cornerRadius
      }
    }
  }

  // set opacity and filled if not specified in mark config
  const specifiedOpacity = getFirstDefined(markDef.opacity, getMarkConfig('opacity', markDef, config));
  if (specifiedOpacity === undefined) {
    markDef.opacity = opacity(markDef.type, encoding);
  }

  const specifiedFilled = markDef.filled;
  if (specifiedFilled === undefined) {
    markDef.filled = graticule ? false : filled(markDef, config);
  }

  // set cursor, which should be pointer if href channel is present unless otherwise specified
  const specifiedCursor = markDef.cursor ?? getMarkConfig('cursor', markDef, config);
  if (specifiedCursor === undefined) {
    markDef.cursor = cursor(markDef, encoding, config);
  }

  return markDef;
}

function cursor(markDef: MarkDef, encoding: Encoding<string>, config: Config) {
  if (encoding.href || markDef.href || getMarkConfig('href', markDef, config)) {
    return 'pointer';
  }
  return markDef.cursor;
}

function opacity(mark: Mark, encoding: Encoding<string>) {
  if (contains([POINT, TICK, CIRCLE, SQUARE], mark)) {
    // point-based marks
    if (!isAggregate(encoding)) {
      return 0.7;
    }
  }
  return undefined;
}

function filled(markDef: MarkDef, config: Config) {
  const filledConfig = getMarkConfig('filled', markDef, config);
  const mark = markDef.type;
  return getFirstDefined(filledConfig, mark !== POINT && mark !== LINE && mark !== RULE);
}

function orient(mark: Mark, encoding: Encoding<string>, specifiedOrient: Orientation): Orientation {
  switch (mark) {
    case POINT:
    case CIRCLE:
    case SQUARE:
    case TEXT:
    case RECT:
    case IMAGE:
      // orient is meaningless for these marks.
      return undefined;
  }

  const {x, y, x2, y2} = encoding;

  switch (mark) {
    case BAR:
      if (isFieldDef(x) && (isBinned(x.bin) || (isFieldDef(y) && y.aggregate && !x.aggregate))) {
        return 'vertical';
      }
      if (isFieldDef(y) && (isBinned(y.bin) || (isFieldDef(x) && x.aggregate && !y.aggregate))) {
        return 'horizontal';
      }
      if (y2 || x2) {
        // Ranged bar does not always have clear orientation, so we allow overriding
        if (specifiedOrient) {
          return specifiedOrient;
        }

        // If y is range and x is non-range, non-bin Q, y is likely a prebinned field
        if (!x2 && isFieldDef(x) && x.type === QUANTITATIVE && !isBinning(x.bin)) {
          return 'horizontal';
        }

        // If x is range and y is non-range, non-bin Q, x is likely a prebinned field
        if (!y2 && isFieldDef(y) && y.type === QUANTITATIVE && !isBinning(y.bin)) {
          return 'vertical';
        }
      }

    // falls through
    case RULE:
      // return undefined for line segment rule and bar with both axis ranged
      if (x2 && y2) {
        return undefined;
      }

    // falls through
    case AREA:
      // If there are range for both x and y, y (vertical) has higher precedence.
      if (y2) {
        if (isFieldDef(y) && isBinned(y.bin)) {
          return 'horizontal';
        } else {
          return 'vertical';
        }
      } else if (x2) {
        if (isFieldDef(x) && isBinned(x.bin)) {
          return 'vertical';
        } else {
          return 'horizontal';
        }
      } else if (mark === RULE) {
        if (x && !y) {
          return 'vertical';
        } else if (y && !x) {
          return 'horizontal';
        }
      }

    // falls through
    case LINE:
    case TICK: {
      // Tick is opposite to bar, line, area and never have ranged mark.
      const xIsContinuous = isFieldDef(x) && isContinuous(x);
      const yIsContinuous = isFieldDef(y) && isContinuous(y);
      if (xIsContinuous && !yIsContinuous) {
        return mark !== 'tick' ? 'horizontal' : 'vertical';
      } else if (!xIsContinuous && yIsContinuous) {
        return mark !== 'tick' ? 'vertical' : 'horizontal';
      } else if (xIsContinuous && yIsContinuous) {
        const xDef = x as TypedFieldDef<string>; // we can cast here since they are surely fieldDef
        const yDef = y as TypedFieldDef<string>;

        const xIsTemporal = xDef.type === TEMPORAL;
        const yIsTemporal = yDef.type === TEMPORAL;

        // temporal without timeUnit is considered continuous, but better serves as dimension
        if (xIsTemporal && !yIsTemporal) {
          return mark !== 'tick' ? 'vertical' : 'horizontal';
        } else if (!xIsTemporal && yIsTemporal) {
          return mark !== 'tick' ? 'horizontal' : 'vertical';
        }

        if (!xDef.aggregate && yDef.aggregate) {
          return mark !== 'tick' ? 'vertical' : 'horizontal';
        } else if (xDef.aggregate && !yDef.aggregate) {
          return mark !== 'tick' ? 'horizontal' : 'vertical';
        }

        if (specifiedOrient) {
          // When ambiguous, use user specified one.
          return specifiedOrient;
        }

        return 'vertical';
      } else {
        // Discrete x Discrete case
        if (specifiedOrient) {
          // When ambiguous, use user specified one.
          return specifiedOrient;
        }

        return undefined;
      }
    }
  }
  return 'vertical';
}
