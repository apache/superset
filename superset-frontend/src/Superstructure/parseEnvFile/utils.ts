const serializeValue = (val: string | undefined) =>
  val ? val.toLowerCase() : '';

export { serializeValue };
