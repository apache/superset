import { QueryFormData } from '@superset-ui/core';
import { WordCloudVisualProps } from './chart/WordCloud';

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud visualization
export type WordCloudFormData = QueryFormData &
  WordCloudVisualProps & {
    series: string;
  };
