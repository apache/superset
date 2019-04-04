import XRegExp from './xregexp';

import build from './addons/build';
import matchrecursive from './addons/matchrecursive';
import unicodeBase from './addons/unicode-base';
import unicodeBlocks from './addons/unicode-blocks';
import unicodeCategories from './addons/unicode-categories';
import unicodeProperties from './addons/unicode-properties';
import unicodeScripts from './addons/unicode-scripts';

build(XRegExp);
matchrecursive(XRegExp);
unicodeBase(XRegExp);
unicodeBlocks(XRegExp);
unicodeCategories(XRegExp);
unicodeProperties(XRegExp);
unicodeScripts(XRegExp);

export default XRegExp;
