import d3 from 'd3';
import moment from 'moment';

import './gantt.css';
import '../../vendor/d3-gantt-chart/gantt-chart-d3.css';
import { d3gantt } from '../../vendor/d3-gantt-chart/gantt-chart-d3';

d3.gantt = d3gantt;

function ganttVis(slice, payload) {
  const fd = slice.formData;

  const container = d3.select(slice.selector);
  container.style('height', slice.height());
  container.selectAll('*').remove();

  // TODO: use d3TimeFormatPreset ?
  const format = '%H:%M';
  const d3fmt = d3.time.format(format);
  const formatStartDate = task => d3fmt(task.startDate);
  const formatEndDate = task => d3fmt(task.endDate);

  const taskStatus = {};
  if (slice.formData.style_mappings) {
    slice.formData.style_mappings.forEach(({ val, style }) => {
      taskStatus[val] = style;
    });
  }

  const data = payload.data.data;

  const taskNames = [];

  const tasks = Object.values(data).map((row) => {
    // build taskNames
    if (!taskNames.includes(row[fd.task_column])) {
      taskNames.push(row[fd.task_column]);
    }

    // make some JS dates
    const start = moment.utc(row[fd.start_time_column]).toDate();
    const end = moment.utc(row[fd.end_time_column]).toDate();
    const ret = row;
    ret[fd.start_time_column] = start;
    ret[fd.end_time_column] = end;
    return ret;
  });

  const gantt = d3.gantt()
        .taskTypes(taskNames)
        .taskStatus(taskStatus)
        .selector(slice.selector)
        .tickFormat(format)
        .margins({ top: 10, right: 10, bottom: 10, left: 10 })
        .tooltipFormatStartDate(formatStartDate)
        .tooltipFormatEndDate(formatEndDate)
        .width(container[0][0].clientWidth);

  gantt(tasks);

}

module.exports = ganttVis;
