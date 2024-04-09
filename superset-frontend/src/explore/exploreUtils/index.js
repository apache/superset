// DODO was here
import { useCallback, useEffect } from 'react';
/* eslint camelcase: 0 */
import URI from 'urijs';
import {
  buildQueryContext,
  ensureIsArray,
  getChartBuildQueryRegistry,
  getChartMetadataRegistry,
  SupersetClient,
} from '@superset-ui/core';
import FileSaver from 'file-saver';
import { availableDomains } from 'src/utils/hostNamesConfig';
import { safeStringify } from 'src/utils/safeStringify';
import { optionLabel } from 'src/utils/common';
import { URL_PARAMS, XLSX, CSV_MIME, XLSX_MIME } from 'src/constants';
import {
  MULTI_OPERATORS,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
  UNSAVED_CHART_ID,
} from 'src/explore/constants';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';
import { API_HANDLER } from 'src/Superstructure/api';

export function getChartKey(explore) {
  const { slice, form_data } = explore;
  return slice?.slice_id ?? form_data?.slice_id ?? UNSAVED_CHART_ID;
}

let requestCounter = 0;
export function getHostName(allowDomainSharding = false) {
  let currentIndex = 0;
  if (allowDomainSharding) {
    currentIndex = requestCounter % availableDomains.length;
    requestCounter += 1;

    // if domain sharding is enabled, skip main domain for fetching chart API
    // leave main domain free for other calls like fav star, save change, etc.
    // to make dashboard be responsive when it's loading large number of charts
    if (currentIndex === 0) {
      currentIndex += 1;
      requestCounter += 1;
    }
  }
  return availableDomains[currentIndex];
}

export const shouldUseLegacyApi = formData => {
  const vizMetadata = getChartMetadataRegistry().get(formData.viz_type);
  return vizMetadata ? vizMetadata.useLegacyApi : false;
};

export function getAnnotationJsonUrl(slice_id, force) {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }

  const uri = URI(window.location.search);
  return uri
    .pathname('/api/v1/chart/data')
    .search({
      form_data: safeStringify({ slice_id }),
      force,
    })
    .toString();
}

export function getURIDirectory(endpointType = 'base') {
  // Building the directory part of the URI
  if (
    ['full', 'json', 'csv', 'query', 'results', 'samples'].includes(
      endpointType,
    )
  ) {
    return '/superset/explore_json/';
  }
  return '/explore/';
}

export function mountExploreUrl(endpointType, extraSearch = {}, force = false) {
  const uri = new URI('/');
  const directory = getURIDirectory(endpointType);
  const search = uri.search(true);
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  if (endpointType === URL_PARAMS.standalone.name) {
    if (force) {
      search.force = '1';
    }
    search.standalone = DashboardStandaloneMode.HIDE_NAV;
  }
  return uri.directory(directory).search(search).toString();
}

export function getChartDataUri({ path, qs, allowDomainSharding = false }) {
  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = new URI({
    protocol: window.location.protocol.slice(0, -1),
    hostname: getHostName(allowDomainSharding),
    port: window.location.port ? window.location.port : '',
    path,
  });
  if (qs) {
    uri = uri.search(qs);
  }
  return uri;
}

/**
 * This gets the minimal url for the given form data.
 * If there are dashboard overrides present in the form data,
 * they will not be included in the url.
 */
export function getExploreUrl({
  formData,
  endpointType = 'base',
  force = false,
  curUrl = null,
  requestParams = {},
  allowDomainSharding = false,
  method = 'POST',
}) {
  if (!formData.datasource) {
    return null;
  }

  // label_colors should not pollute the URL
  // eslint-disable-next-line no-param-reassign
  delete formData.label_colors;

  let uri = getChartDataUri({ path: '/', allowDomainSharding });
  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  const directory = getURIDirectory(endpointType);

  // Building the querystring (search) part of the URI
  const search = uri.search(true);
  const { slice_id, extra_filters, adhoc_filters, viz_type } = formData;
  if (slice_id) {
    const form_data = { slice_id };
    if (method === 'GET') {
      form_data.viz_type = viz_type;
      if (extra_filters && extra_filters.length) {
        form_data.extra_filters = extra_filters;
      }
      if (adhoc_filters && adhoc_filters.length) {
        form_data.adhoc_filters = adhoc_filters;
      }
    }
    search.form_data = safeStringify(form_data);
  }
  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === URL_PARAMS.standalone.name) {
    search.standalone = '1';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  if (endpointType === 'results') {
    search.results = 'true';
  }
  if (endpointType === 'samples') {
    search.samples = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach(name => {
      if (requestParams.hasOwnProperty(name)) {
        search[name] = requestParams[name];
      }
    });
  }
  return uri.search(search).directory(directory).toString();
}

export const getQuerySettings = formData => {
  const vizMetadata = getChartMetadataRegistry().get(formData.viz_type);
  return [
    vizMetadata?.useLegacyApi ?? false,
    vizMetadata?.parseMethod ?? 'json-bigint',
  ];
};

// DODO changed
export const buildV1ChartDataPayload = ({
  formData,
  force,
  resultFormat,
  resultType,
  setDataMask,
  ownState,
  // DODO added
  language,
}) => {
  const buildQuery =
    getChartBuildQueryRegistry().get(formData.viz_type) ??
    (buildQueryformData =>
      buildQueryContext(buildQueryformData, baseQueryObject => [
        {
          ...baseQueryObject,
        },
      ]));
  const builtQueryFunc = buildQuery(
    {
      ...formData,
      force,
      result_format: resultFormat,
      result_type: resultType,
    },
    {
      ownState,
      hooks: {
        setDataMask,
      },
    },
  );

  return {
    ...builtQueryFunc,
    language,
  };
};

export const getCSV = async (url, payload, isLegacy, resultFormat) => {
  let params = {
    method: 'post',
    url,
    body: payload,
  };

  if (resultFormat === XLSX) {
    params = {
      ...params,
      responseType: 'blob',
    };
  }

  if (isLegacy) {
    const response = await API_HANDLER.SupersetClientNoApi({ ...params });
    if (response && response.result) return response.result[0];
  } else {
    const response = await API_HANDLER.SupersetClient({ ...params });
    if (response) return response;
  }

  return null;
};

export const getLegacyEndpointType = ({ resultType, resultFormat }) =>
  resultFormat === 'csv' ? resultFormat : resultType;

// DODO added
export const exportChartPlugin = ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  ownState = {},
  // DODO added
  language = 'en',
}) => {
  let url;
  let payload;

  const [useLegacyApi, parseMethod] = getQuerySettings(formData);
  if (useLegacyApi) {
    const endpointType = getLegacyEndpointType({ resultFormat, resultType });
    url = getExploreUrl({
      formData,
      endpointType,
      allowDomainSharding: false,
    });
    payload = formData;

    const fixedUrl =
      url.split(`${window.location.origin}/superset`).filter(x => x)[0] || null;

    const updatedUrl =
      resultFormat === XLSX
        ? `${fixedUrl}&${XLSX}=true&language=${language}`
        : `${fixedUrl}&language=${language}`;

    console.groupCollapsed('EXPORT CSV/XLSX legacy');
    console.log('url', url);
    console.log('fixedUrl', fixedUrl);
    console.log('payload', payload);
    console.log('resultFormat', resultFormat);
    console.log('updatedUrl', updatedUrl);
    console.groupEnd();

    return getCSV(updatedUrl, payload, true, resultFormat);
  }

  url = '/api/v1/chart/data';
  payload = buildV1ChartDataPayload({
    formData,
    force,
    resultFormat,
    resultType,
    ownState,
    parseMethod,
    // DODO added
    language,
  });

  console.groupCollapsed('EXPORT CSV/XLSX');
  console.log('url', url);
  console.log('payload', payload);
  console.groupEnd();

  return getCSV(url, payload, false, resultFormat);
};

const generateFileName = (filename, extension) =>
  `${filename ? filename.split(' ').join('_') : 'data'}.${extension}`;

const getExportedChartName = (slice = {}, extension) => {
  const sliceName = slice?.slice_name || 'viz_type';
  const vizType = slice?.viz_type || 'viz_type';
  const timeGrain =
    slice?.form_data?.time_grain_sqla ||
    slice?.form_data?.time_range ||
    'time_grain_sqla';

  return generateFileName(
    `${sliceName}__${timeGrain}__${vizType}-chart`,
    extension,
  );
};

// DODO changed
export const exportChart = ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  ownState = {},
  slice = {},
  // DODO added
  language = 'en',
}) => {
  console.log('slice', slice);
  console.log('language here', language);
  const exportResultPromise = exportChartPlugin({
    formData,
    resultFormat,
    resultType,
    force,
    ownState,
    language,
  });

  return exportResultPromise
    .then(exportResult => {
      if (exportResult && exportResult.code && exportResult.message) {
        throw exportResult;
      }

      if (exportResult) {
        const extension = resultFormat; // csv | xlsx
        const blobType = extension === XLSX ? XLSX_MIME : CSV_MIME;

        const outputFilename = getExportedChartName(slice, extension);

        console.log('outputFilename', outputFilename);

        if (extension === XLSX) {
          const url = URL.createObjectURL(
            new Blob([exportResult], {
              type: blobType,
            }),
          );

          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', outputFilename);
          document.body.appendChild(link);
          link.click();
        } else {
          const universalBOM = '\uFEFF';
          const alteredResult = universalBOM + exportResult;
          const csvFile = new Blob([alteredResult], {
            type: blobType,
          });
          FileSaver.saveAs(csvFile, outputFilename);
        }
      } else throw exportResult;
    })
    .catch(csvExportError => {
      console.log('csvExportError', csvExportError);
      // eslint-disable-next-line no-alert
      alert(
        `Unfortunately you cannot download ${resultFormat} file. The reason: ${
          csvExportError.message || 'Unexpected'
        } [${csvExportError.code || 'Unknown'}]`,
      );
    });
};

export const exploreChart = (formData, requestParams) => {
  const url = getExploreUrl({
    formData,
    endpointType: 'base',
    allowDomainSharding: false,
    requestParams,
  });
  SupersetClient.postForm(url, { form_data: safeStringify(formData) });
};

export const useDebouncedEffect = (effect, delay, deps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useCallback(effect, deps);

  useEffect(() => {
    const handler = setTimeout(() => {
      callback();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [callback, delay]);
};

export const getSimpleSQLExpression = (subject, operator, comparator) => {
  const isMulti =
    [...MULTI_OPERATORS]
      .map(op => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation)
      .indexOf(operator) >= 0;
  // If returned value is an object after changing dataset
  let expression =
    typeof subject === 'object' ? subject?.column_name ?? '' : subject ?? '';
  if (subject && operator) {
    expression += ` ${operator}`;
    const firstValue =
      isMulti && Array.isArray(comparator) ? comparator[0] : comparator;
    const comparatorArray = ensureIsArray(comparator);
    const isString =
      firstValue !== undefined && Number.isNaN(Number(firstValue));
    const quote = isString ? "'" : '';
    const [prefix, suffix] = isMulti ? ['(', ')'] : ['', ''];
    const formattedComparators = comparatorArray
      .map(val => optionLabel(val))
      .map(
        val =>
          `${quote}${isString ? String(val).replace("'", "''") : val}${quote}`,
      );
    if (comparatorArray.length > 0) {
      expression += ` ${prefix}${formattedComparators.join(', ')}${suffix}`;
    }
  }
  return expression;
};

export function formatSelectOptions(options) {
  return options.map(opt => [opt, opt.toString()]);
}
