/**
 * Handlebars helper implementations — same set as the frontend component.
 *
 * These must stay in sync with handlebarsHelpers.json (the single source
 * of truth). The sidecar renders with the exact same helpers the browser
 * would use, so the agent gets accurate feedback.
 */

import Handlebars from 'handlebars';

export function registerHelpers(hb: typeof Handlebars): void {
  hb.registerHelper('formatNumber', (number: number, locale = 'en-US') => {
    if (typeof number !== 'number') return number;
    return number.toLocaleString(locale);
  });

  // Comparison
  hb.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  hb.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
  hb.registerHelper('gt', (a: unknown, b: unknown) => (a as number) > (b as number));
  hb.registerHelper('gte', (a: unknown, b: unknown) => (a as number) >= (b as number));
  hb.registerHelper('lt', (a: unknown, b: unknown) => (a as number) < (b as number));
  hb.registerHelper('lte', (a: unknown, b: unknown) => (a as number) <= (b as number));

  // Logic
  hb.registerHelper('and', (...args: unknown[]) => args.slice(0, -1).every(Boolean));
  hb.registerHelper('or', (...args: unknown[]) => args.slice(0, -1).some(Boolean));
  hb.registerHelper('not', (a: unknown) => !a);

  // Arithmetic
  hb.registerHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
  hb.registerHelper('subtract', (a: unknown, b: unknown) => Number(a) - Number(b));
  hb.registerHelper('multiply', (a: unknown, b: unknown) => Number(a) * Number(b));

  // Fallback — returns first non-empty value
  hb.registerHelper('fallback', (...args: unknown[]) => {
    for (let i = 0; i < args.length - 1; i++) {
      if (args[i] !== undefined && args[i] !== null && args[i] !== '') return args[i];
    }
    return '';
  });
}
