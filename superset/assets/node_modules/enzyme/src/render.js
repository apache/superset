import cheerio from 'cheerio';
import getAdapter from './getAdapter';

/**
 * Renders a react component into static HTML and provides a cheerio wrapper around it. This is
 * somewhat asymmetric with `mount` and `shallow`, which don't use any external libraries, but
 * Cheerio's API is pretty close to what we actually want and has a significant amount of utility
 * that would be recreating the wheel if we didn't use it.
 *
 * I think there are a lot of good use cases to use `render` instead of `shallow` or `mount`, and
 * thus I'd like to keep this API in here even though it's not really "ours".
 *
 * @param node
 * @param options
 * @returns {Cheerio}
 */

export default function render(node, options = {}) {
  const adapter = getAdapter(options);
  const renderer = adapter.createRenderer({ mode: 'string', ...options });
  const html = renderer.render(node, options.context);
  return cheerio.load('')(html);
}
