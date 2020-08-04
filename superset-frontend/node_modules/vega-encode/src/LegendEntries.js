import {Transform, ingest} from 'vega-dataflow';
import {
  GradientLegend, SymbolLegend,
  labelFormat, labelFraction, labelValues,
  scaleFraction, tickCount
} from 'vega-scale';
import {constant, inherits, isFunction, peek} from 'vega-util';

/**
 * Generates legend entries for visualizing a scale.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Scale} params.scale - The scale to generate items for.
 * @param {*} [params.count=5] - The approximate number of items, or
 *   desired tick interval, to use.
 * @param {*} [params.limit] - The maximum number of entries to
 *   include in a symbol legend.
 * @param {Array<*>} [params.values] - The exact tick values to use.
 *   These must be legal domain values for the provided scale.
 *   If provided, the count argument is ignored.
 * @param {string} [params.formatSpecifier] - A format specifier
 *   to use in conjunction with scale.tickFormat. Legal values are
 *   any valid D3 format specifier string.
 * @param {function(*):string} [params.format] - The format function to use.
 *   If provided, the formatSpecifier argument is ignored.
 */
export default function LegendEntries(params) {
  Transform.call(this, [], params);
}

var prototype = inherits(LegendEntries, Transform);

prototype.transform = function(_, pulse) {
  if (this.value != null && !_.modified()) {
    return pulse.StopPropagation;
  }

  var locale = pulse.dataflow.locale(),
      out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS),
      items = this.value,
      type  = _.type || SymbolLegend,
      scale = _.scale,
      limit = +_.limit,
      count = tickCount(scale, _.count == null ? 5 : _.count, _.minstep),
      lskip = !!_.values || type === SymbolLegend,
      format = _.format || labelFormat(locale, scale, count, type, _.formatSpecifier, _.formatType, lskip),
      values = _.values || labelValues(scale, count),
      domain, fraction, size, offset, ellipsis;

  if (items) out.rem = items;

  if (type === SymbolLegend) {
    if (limit && values.length > limit) {
      pulse.dataflow.warn('Symbol legend count exceeds limit, filtering items.');
      items = values.slice(0, limit - 1);
      ellipsis = true;
    } else {
      items = values;
    }

    if (isFunction(size = _.size)) {
      // if first value maps to size zero, remove from list (vega#717)
      if (!_.values && scale(items[0]) === 0) {
        items = items.slice(1);
      }
      // compute size offset for legend entries
      offset = items.reduce(function(max, value) {
        return Math.max(max, size(value, _));
      }, 0);
    } else {
      size = constant(offset = size || 8);
    }

    items = items.map(function(value, index) {
      return ingest({
        index:  index,
        label:  format(value, index, items),
        value:  value,
        offset: offset,
        size:   size(value, _)
      });
    });

    if (ellipsis) {
      ellipsis = values[items.length];
      items.push(ingest({
        index:    items.length,
        label:    `\u2026${values.length-items.length} entries`,
        value:    ellipsis,
        offset:   offset,
        size:     size(ellipsis, _)
      }));
    }
  }

  else if (type === GradientLegend) {
    domain = scale.domain(),
    fraction = scaleFraction(scale, domain[0], peek(domain));

    // if automatic label generation produces 2 or fewer values,
    // use the domain end points instead (fixes vega/vega#1364)
    if (values.length < 3 && !_.values && domain[0] !== peek(domain)) {
      values = [domain[0], peek(domain)];
    }

    items = values.map(function(value, index) {
      return ingest({
        index: index,
        label: format(value, index, values),
        value: value,
        perc:  fraction(value)
      });
    });
  }

  else {
    size = values.length - 1;
    fraction = labelFraction(scale);

    items = values.map(function(value, index) {
      return ingest({
        index: index,
        label: format(value, index, values),
        value: value,
        perc:  index ? fraction(value) : 0,
        perc2: index === size ? 1 : fraction(values[index+1])
      });
    });
  }

  out.source = items;
  out.add = items;
  this.value = items;

  return out;
};
