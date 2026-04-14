export function getIntlDurationFormatter(
  locale?: string,
  options?: Intl.DurationFormatOptions,
): Intl.DurationFormat {
  const normalizedLocale = locale?.replace('_', '-');
  try {
    return new Intl.DurationFormat(normalizedLocale, options);
  } catch {
    return new Intl.DurationFormat('en', options);
  }
}
