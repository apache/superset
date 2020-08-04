/**
 * Parse a serialized dataflow specification.
 */
export default function(spec) {
  const ctx = this,
        operators = spec.operators || [];

  // parse background
  if (spec.background) {
    ctx.background = spec.background;
  }

  // parse event configuration
  if (spec.eventConfig) {
    ctx.eventConfig = spec.eventConfig;
  }

  // parse locale configuration
  if (spec.locale) {
    ctx.locale = spec.locale;
  }

  // parse operators
  operators.forEach(entry => ctx.parseOperator(entry));

  // parse operator parameters
  operators.forEach(entry => ctx.parseOperatorParameters(entry));

  // parse streams
  (spec.streams || []).forEach(entry => ctx.parseStream(entry));

  // parse updates
  (spec.updates || []).forEach(entry => ctx.parseUpdate(entry));

  return ctx.resolve();
}
