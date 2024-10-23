import { t, Behavior } from '@superset-ui/core';
import { buildQuery } from './buildQuery';
import controlPanel from './controlPanel';
import { transformProps } from './transformProps';
import thumbnail from './images/thumbnail.png'; // Add a thumbnail image
import exampleImg1 from './images/hello.jpg'
import exampleImg2 from './images/happy.jpg'
import { MyCustomChartProps, MyCustomChartFormData } from './types';
import { EchartsChartPlugin } from '../types';

export default class MyCustomChartPlugin extends EchartsChartPlugin<
  MyCustomChartFormData,
  MyCustomChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./MyCustomChart'), // Import your chart component here
      metadata: {
        behaviors: [Behavior.InteractiveChart],
        category: t('Custom Charts'),
        credits: ['Your Source or Library URL'],
        description: t('A custom chart built from scratch. Used for learning the chart dev structure'),
        exampleGallery: [{ url: exampleImg1 }, { url: exampleImg2 }],
        name: t('My Custom Chart'),
        tags: [t('Custom'), t('Experimental'), t('Featured')],
        thumbnail,
      },
      transformProps,
    });
  }
}
