const HUNDRED_PERCENT = { isDynamic: true, multiplier: 1 } as const;

export default function parseLength(
  input: string | number,
): { isDynamic: true; multiplier: number } | { isDynamic: false; value: number } {
  if (input === 'auto' || input === '100%') {
    return HUNDRED_PERCENT;
  } else if (typeof input === 'string' && input.length > 0 && input[input.length - 1] === '%') {
    // eslint-disable-next-line no-magic-numbers
    return { isDynamic: true, multiplier: parseFloat(input) / 100 };
  }
  const value = typeof input === 'number' ? input : parseFloat(input);

  return { isDynamic: false, value };
}
