import airbnb from '@superset-ui/color/esm/colorSchemes/categorical/airbnb';
import categoricalD3 from '@superset-ui/color/esm/colorSchemes/categorical/d3';
import google from '@superset-ui/color/esm/colorSchemes/categorical/google';
import lyft from '@superset-ui/color/esm/colorSchemes/categorical/lyft';
import sequentialCommon from '@superset-ui/color/esm/colorSchemes/sequential/common';
import sequentialD3 from '@superset-ui/color/esm/colorSchemes/sequential/d3';
import { getCategoricalSchemeRegistry, getSequentialSchemeRegistry } from '@superset-ui/color';

export default function setupColors() {
  // Register color schemes
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  [airbnb, categoricalD3, google, lyft].forEach((group) => {
    group.forEach((scheme) => {
      categoricalSchemeRegistry.registerValue(scheme.id, scheme);
    });
  });
  categoricalSchemeRegistry.setDefaultKey('bnbColors');

  const sequentialSchemeRegistry = getSequentialSchemeRegistry();
  [sequentialCommon, sequentialD3].forEach((group) => {
    group.forEach((scheme) => {
      sequentialSchemeRegistry.registerValue(scheme.id, scheme);
    });
  });
}
