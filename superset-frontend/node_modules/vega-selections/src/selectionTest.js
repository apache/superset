import {Intersect} from './constants';
import {field, inrange, isArray, isDate, toNumber} from 'vega-util';

var TYPE_ENUM = 'E',
    TYPE_RANGE_INC = 'R',
    TYPE_RANGE_EXC = 'R-E',
    TYPE_RANGE_LE = 'R-LE',
    TYPE_RANGE_RE = 'R-RE',
    UNIT_INDEX = 'index:unit';

// TODO: revisit date coercion?
function testPoint(datum, entry) {
  var fields = entry.fields,
      values = entry.values,
      n = fields.length,
      i = 0, dval, f;

  for (; i<n; ++i) {
    f = fields[i];
    f.getter = field.getter || field(f.field);
    dval = f.getter(datum);

    if (isDate(dval)) dval = toNumber(dval);
    if (isDate(values[i])) values[i] = toNumber(values[i]);
    if (isDate(values[i][0])) values[i] = values[i].map(toNumber);

    if (f.type === TYPE_ENUM) {
      // Enumerated fields can either specify individual values (single/multi selections)
      // or an array of values (interval selections).
      if(isArray(values[i]) ? values[i].indexOf(dval) < 0 : dval !== values[i]) {
        return false;
      }
    } else {
      if (f.type === TYPE_RANGE_INC) {
        if (!inrange(dval, values[i])) return false;
      } else if (f.type === TYPE_RANGE_RE) {
        // Discrete selection of bins test within the range [bin_start, bin_end).
        if (!inrange(dval, values[i], true, false)) return false;
      } else if (f.type === TYPE_RANGE_EXC) { // 'R-E'/'R-LE' included for completeness.
        if (!inrange(dval, values[i], false, false)) return false;
      } else if (f.type === TYPE_RANGE_LE) {
        if (!inrange(dval, values[i], false, true)) return false;
      }
    }
  }

  return true;
}

/**
 * Tests if a tuple is contained within an interactive selection.
 * @param {string} name - The name of the data set representing the selection.
 *  Tuples in the dataset are of the form
 *  {unit: string, fields: array<fielddef>, values: array<*>}.
 *  Fielddef is of the form
 *  {field: string, channel: string, type: 'E' | 'R'} where
 *  'type' identifies whether tuples in the dataset enumerate
 *  values for the field, or specify a continuous range.
 * @param {object} datum - The tuple to test for inclusion.
 * @param {string} op - The set operation for combining selections.
 *   One of 'intersect' or 'union' (default).
 * @return {boolean} - True if the datum is in the selection, false otherwise.
 */
export function selectionTest(name, datum, op) {
  var data = this.context.data[name],
      entries = data ? data.values.value : [],
      unitIdx = data ? data[UNIT_INDEX] && data[UNIT_INDEX].value : undefined,
      intersect = op === Intersect,
      n = entries.length,
      i = 0,
      entry, miss, count, unit, b;

  for (; i<n; ++i) {
    entry = entries[i];

    if (unitIdx && intersect) {
      // multi selections union within the same unit and intersect across units.
      miss = miss || {};
      count = miss[unit=entry.unit] || 0;

      // if we've already matched this unit, skip.
      if (count === -1) continue;

      b = testPoint(datum, entry);
      miss[unit] = b ? -1 : ++count;

      // if we match and there are no other units return true
      // if we've missed against all tuples in this unit return false
      if (b && unitIdx.size === 1) return true;
      if (!b && count === unitIdx.get(unit).count) return false;
    } else {
      b = testPoint(datum, entry);

      // if we find a miss and we do require intersection return false
      // if we find a match and we don't require intersection return true
      if (intersect ^ b) return b;
    }
  }

  // if intersecting and we made it here, then we saw no misses
  // if not intersecting, then we saw no matches
  // if no active selections, return false
  return n && intersect;
}