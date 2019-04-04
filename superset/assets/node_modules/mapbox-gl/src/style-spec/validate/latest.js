
import validateStyle from '../validate_style.min';

/*
 * Validate a style against the latest specification. This method is optimized
 * to keep its bundle size small by refraining from requiring jslint or old
 * style spec versions.
 * @see validateStyleMin
 * @deprecated This file exists for backwards compatibility and will be dropped in the next minor release.
 */
export default validateStyle;
