function log(df, method, args) {
  try {
    df[method].apply(df, ['EXPRESSION'].concat([].slice.call(args)));
  } catch (err) {
    df.warn(err);
  }
  return args[args.length-1];
}

export function warn() {
  return log(this.context.dataflow, 'warn', arguments);
}

export function info() {
  return log(this.context.dataflow, 'info', arguments);
}

export function debug() {
  return log(this.context.dataflow, 'debug', arguments);
}
