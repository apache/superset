import { API_HANDLER } from 'src/Superstructure/api';
import {
  shouldUseLegacyApi,
  getLegacyEndpointType,
  getExploreUrl,
  // buildV1ChartDataPayload,
} from 'src/explore/exploreUtils';

// export const getCSV = async (url: string, payload: Record<string, any>) =>
//   await API_HANDLER.SupersetClient({
//     method: 'post',
//     url: url.split('api/v1')[1],
//     body: payload,
//   });


export const getCSV = async (url: string, payload: Record<string, any>) => {
  const urlNoProtocol = url.replace(/^https?\:\/\//i, "");

  console.log('urlNoProtocol', urlNoProtocol);
  console.log('url', url);
  console.log('___');

  const response = await API_HANDLER.SupersetClientNoApi({
    method: 'post',
    url: urlNoProtocol,
    body: payload,
  });

  if (response && response.result) {
    return response.result[0]
  }

  return null
}

export const exportChart = ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
  // force = false,
  // ownState = {},
}: any) => {
  let url;
  let payload;

  console.log('shouldUseLegacyApi(formData)', shouldUseLegacyApi(formData));

  // if (shouldUseLegacyApi(formData)) {
  const endpointType = getLegacyEndpointType({ resultFormat, resultType });
  console.log('exportChart')
  console.log('endpointType', endpointType)
  url = getExploreUrl({
    formData,
    endpointType,
    allowDomainSharding: false,
    cleanUrlFromHostname: true
  });
  payload = formData;
  // }
  // else {
  // url = '/api/v1/chart/data';
  // payload = buildV1ChartDataPayload({
  //   formData,
  //   force,
  //   resultFormat,
  //   resultType,
  //   ownState,
  // } as any);
  // }
  console.log('urlXX', url);
  console.log('payloadXX', payload);
  return getCSV(url, payload);
};
