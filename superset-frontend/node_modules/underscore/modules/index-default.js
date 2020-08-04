import * as allExports from './index.js';
import { mixin } from './index.js';

// Add all of the Underscore functions to the wrapper object.
var _ = mixin(allExports);
// Legacy Node.js API
_._ = _;
// Export the Underscore API.
export default _;
