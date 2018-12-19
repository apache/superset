import delphiReponse from './delphi-response';

const forecastingSeries = [
  'forecasting:forecast',
  'forecasting:lower',
  'forecasting:upper',
];

/**
 * Validates forecasting flags and if conditions are met it will query delphi
 * @param response
 * @returns {Promise<{[p: string]: *}>}
 */
export const mutator = (response) => {
  const { form_data: formData = {}, data = [] } = response;

  // we only perform forecasting on the first series
  const series = data[0];
  let newData = [...data];

  if (series && formData.forecasting_enable) {
    const { values } = series;
    if (values.length > 0) {
      const { forecasting_horizon: forecastingHorizon = 1 } = formData;

      const lastActualSeriesPoint = series.values[series.values.length - 1];
      // create forecasting series placeholder values
      // we are generating new series for forecasting
      newData = forecastingSeries.reduce((allSeries, key) => [
        ...allSeries,
        {
          key,
          values: values.map(({ x }, index) => ({
            x,
            y: index === values.length - 1 ? lastActualSeriesPoint.y : null,
          })),
        },
      ], newData);

      const forecastingData = delphiReponse.data.slice(0, forecastingHorizon);

      // for each series create a fake value having the same value as the previous one
      newData = newData.map(track => ({
        key: track.key,
        values: [
          ...track.values,
          ...forecastingData.map(v => ({
            x: Date.parse(v.Datetime),
            y: track.key.includes('forecasting') ? v[track.key] : null,
          })),
        ],
      }));
    }
  }

  return Promise.resolve({
    ...response,
    data: newData,
  });
};
