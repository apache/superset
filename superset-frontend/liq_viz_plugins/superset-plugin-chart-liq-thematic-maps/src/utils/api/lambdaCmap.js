import { getSequentialSchemeRegistry } from '@superset-ui/core';
const liqSecrets = require('../../../../liq_secrets.js').liqSecrets;

export default cmap = (colorScheme, breaksMode, data, metricCol, customMode, numClasses) => {
  var myHeaders = new Headers();
  myHeaders.append('Content-Type', 'application/json');

  const colors = getSequentialSchemeRegistry().get(colorScheme).colors;
  const initParams = {
    'colors': colors,
    'cmap_type': breaksMode,
    'values': data.map(d => d[metricCol]),
    'secret': liqSecrets.lambdaFunctions.cMap.secret
  }
  var raw;

  if (breaksMode === 'custom') {
    raw = JSON.stringify({
      ...initParams,
      'breaks': customMode,
      'n_classes': numClasses
    })
  } else if (breaksMode === 'categorized') {
    raw = JSON.stringify(initParams)
  } else {
    raw = JSON.stringify({
      ...initParams,
      'n_classes': numClasses
    })
  }

  var raw = (!breaksMode || breaksMode === 'custom') ? JSON.stringify({
    'colors': getSequentialSchemeRegistry().get(colorScheme).colors,
    'breaks': customMode,
    'values': data.map(d => d[metricCol]),
    'n_classes': numClasses,
    'cmap_type': 'custom',
    'secret': liqSecrets.lambdaFunctions.cMap.secret
  }) : JSON.stringify({
    'colors': getSequentialSchemeRegistry().get(colorScheme).colors,
    'values': data.map(d => d[metricCol]),
    'n_classes': numClasses,
    'cmap_type': breaksMode,
    'secret': liqSecrets.lambdaFunctions.cMap.secret
  });

  var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
  }

  return fetch(liqSecrets.lambdaFunctions.cMap.url, requestOptions)
}