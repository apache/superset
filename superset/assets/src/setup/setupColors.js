import airbnb from '@superset-ui/color/esm/colorSchemes/categorical/airbnb';
import categoricalD3 from '@superset-ui/color/esm/colorSchemes/categorical/d3';
import google from '@superset-ui/color/esm/colorSchemes/categorical/google';
import lyft from '@superset-ui/color/esm/colorSchemes/categorical/lyft';
import sequentialCommon from '@superset-ui/color/esm/colorSchemes/sequential/common';
import sequentialD3 from '@superset-ui/color/esm/colorSchemes/sequential/d3';
import { getCategoricalSchemeRegistry, getSequentialSchemeRegistry } from '@superset-ui/color';
import CategoricalScheme from '@superset-ui/color';

var qmatic = [{ 
  id: "qmaticColors", 
  label: "qmaticColors", 
  description: "", 
  colors:  [
    "#7293cb","#e1974c","#84ba5b","#d35e60","#808585","#9067a7","#ab6857","#ccc210"
  ]
}]
var qmaticMulti = [{ 
  id: "qmaticMultiColors", 
  label: "qmaticMultiColors", 
  description: "", 
  colors:  [
    "#396ab1","#da7c30","#3e9651","#cc2529","#535154","#6b4c9a","#922428","#948b3d"
  ]
}]

export default function setupColors() {

  // Register color schemes
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  [airbnb, categoricalD3, google, lyft, qmatic, qmaticMulti].forEach((group) => {
    group.forEach((scheme) => {
      categoricalSchemeRegistry.registerValue(scheme.id, scheme);
    });
  });
  //categoricalSchemeRegistry.setDefaultKey('bnbColors');
  categoricalSchemeRegistry.setDefaultKey('qmatic');

  const sequentialSchemeRegistry = getSequentialSchemeRegistry();
  [sequentialCommon, sequentialD3].forEach((group) => {
    group.forEach((scheme) => {
      sequentialSchemeRegistry.registerValue(scheme.id, scheme);
    });
  });
}
