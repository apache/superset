/**
 * @copyright   2016-2019, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 */

// Our index re-exports TypeScript types, which Babel is unable to detect and omit.
// Because of this, Webpack and other bundlers attempt to import values that do not exist.
// To mitigate this issue, we need this module specific index file that manually exports.

import Interweave from './esm/Interweave';
import Markup from './esm/Markup';
import Filter from './esm/Filter';
import Matcher from './esm/Matcher';
import Element from './esm/Element';
import Parser from './esm/Parser';

export { Markup, Filter, Matcher, Element, Parser };

export default Interweave;
