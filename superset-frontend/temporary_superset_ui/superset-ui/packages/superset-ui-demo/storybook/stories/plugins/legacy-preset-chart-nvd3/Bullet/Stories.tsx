import { BulletChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';

new BulletChartPlugin().configure({ key: 'bullet' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-preset-chart-nvd3/Bullet',
};

export { basic } from './stories/basic';
