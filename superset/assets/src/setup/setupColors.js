import airbnb from '../modules/colors/colorSchemes/categorical/airbnb';
import d3 from '../modules/colors/colorSchemes/categorical/d3';
import google from '../modules/colors/colorSchemes/categorical/google';
import lyft from '../modules/colors/colorSchemes/categorical/lyft';
import sequentialCommon from '../modules/colors/colorSchemes/sequential/common';
import getCategoricalSchemeManager from '../modules/colors/CategoricalSchemeManagerSingleton';
import getSequentialSchemeManager from '../modules/colors/SequentialSchemeManagerSingleton';

export default function setupColors() {
  // Register color schemes
  const categoricalSchemeManager = getCategoricalSchemeManager();
  [airbnb, d3, google, lyft].forEach((group) => {
    group.forEach((scheme) => {
      categoricalSchemeManager.registerScheme(scheme.name, scheme);
    });
  });
  categoricalSchemeManager.setDefaultSchemeName('bnbColors');

  const sequentialSchemeManager = getSequentialSchemeManager();
  sequentialCommon.forEach((scheme) => {
    sequentialSchemeManager.registerScheme(scheme.name, scheme);
  });
}
