import airbnb from '../modules/colors/colorSchemes/categorical/airbnb';
import d3 from '../modules/colors/colorSchemes/categorical/d3';
import google from '../modules/colors/colorSchemes/categorical/google';
import lyft from '../modules/colors/colorSchemes/categorical/lyft';
import sequentialCommon from '../modules/colors/colorSchemes/sequential/common';
import getCategoricalSchemeRegistry from '../modules/colors/CategoricalSchemeRegistrySingleton';
import getSequentialSchemeRegistry from '../modules/colors/SequentialSchemeRegistrySingleton';

export default function setupColors() {
  // Register color schemes
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  [airbnb, d3, google, lyft].forEach((group) => {
    group.forEach((scheme) => {
      categoricalSchemeRegistry.registerValue(scheme.name, scheme);
    });
  });
  categoricalSchemeRegistry.setDefaultSchemeName('bnbColors');

  const sequentialSchemeRegistry = getSequentialSchemeRegistry();
  sequentialCommon.forEach((scheme) => {
    sequentialSchemeRegistry.registerValue(scheme.name, scheme);
  });
}
