import { COLUMN_TYPE, CHART_TYPE, MARKDOWN_TYPE } from './componentTypes';

export default function componentIsResizable(entity) {
  return [COLUMN_TYPE, CHART_TYPE, MARKDOWN_TYPE].indexOf(entity.type) > -1;
}
