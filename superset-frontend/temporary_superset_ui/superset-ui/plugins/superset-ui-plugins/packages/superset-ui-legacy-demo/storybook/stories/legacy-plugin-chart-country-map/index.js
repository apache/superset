import CountryMapChartPlugin from '../../../../superset-ui-legacy-plugin-chart-country-map/src';
import Stories from './Stories';

new CountryMapChartPlugin().configure({ key: 'country-map' }).register();

export default {
  examples: [...Stories],
};
