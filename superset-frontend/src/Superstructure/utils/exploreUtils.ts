import { API_HANDLER } from 'src/Superstructure/api';
import { getLegacyEndpointType, getExploreUrl } from 'src/explore/exploreUtils';

export const getCSV = async (url: string, payload: Record<string, any>) => {
  console.log('What is this function getCSV?');

  const urlNoProtocol = url.replace(/^https?:\/\//i, '');

  console.log('urlNoProtocol', urlNoProtocol);
  console.log('url', url);
  console.log('___');

  const response = await API_HANDLER.SupersetClientNoApi({
    method: 'post',
    url: urlNoProtocol,
    body: payload,
  });

  if (response?.result) {
    return response.result[0];
  }

  return null;
};

export const exportChart = ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
}: any) => {
  const endpointType = getLegacyEndpointType({ resultFormat, resultType });

  const url = getExploreUrl({
    formData,
    endpointType,
    allowDomainSharding: false,
    // cleanUrlFromHostname: true,
  });
  const payload = formData;
  return getCSV(url, payload);
};
