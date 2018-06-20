import nvd3Vis from './nvd3_vis';
import { getExploreLongUrl } from '../explore/exploreUtils';


export default function lineMulti(slice, payload) {
  /*
   * Show multiple line charts
   *
   * This visualization works by fetching the data from each of the saved
   * charts, building the payload data and passing it along to nvd3Vis.
   */
  const fd = slice.formData;

  // fetch data from all the charts
  const promises = [];
  const subslices = [
    ...payload.data.slices.axis1.map(subslice => [1, subslice]),
    ...payload.data.slices.axis2.map(subslice => [2, subslice]),
  ];
  subslices.forEach(([yAxis, subslice]) => {
    let filters = subslice.form_data.filters || [];
    filters.concat(fd.filters);
    if (fd.extra_filters) {
      filters = filters.concat(fd.extra_filters);
    }
    const fdCopy = {
      ...subslice.form_data,
      filters,
      since: fd.since,
      until: fd.until,
    };
    const url = getExploreLongUrl(fdCopy, 'json');
    promises.push(new Promise((resolve, reject) => {
      d3.json(url, (error, response) => {
        if (error) {
          reject(error);
        } else {
          const data = [];
          response.data.forEach((datum) => {
            let key = datum.key;
            if (fd.prefix_metric_with_slice_name) {
              key = subslice.slice_name + ': ' + key;
            }
            data.push({ key, values: datum.values, type: fdCopy.viz_type, yAxis });
          });
          resolve(data);
        }
      });
    }));
  });

  Promise.all(promises).then((data) => {
    const payloadCopy = { ...payload };
    payloadCopy.data = [].concat(...data);

    // add null values at the edges to fix multiChart bug when series with
    // different x values use different y axes
    if (fd.line_charts.length && fd.line_charts_2.length) {
      let minx = Infinity;
      let maxx = -Infinity;
      payloadCopy.data.forEach((datum) => {
        minx = Math.min(minx, ...datum.values.map(v => v.x));
        maxx = Math.max(maxx, ...datum.values.map(v => v.x));
      });
      // add null values at the edges
      payloadCopy.data.forEach((datum) => {
        datum.values.push({ x: minx, y: null });
        datum.values.push({ x: maxx, y: null });
      });
    }

    nvd3Vis(slice, payloadCopy);
  });
}
