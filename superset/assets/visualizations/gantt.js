import d3 from 'd3';
import moment from 'moment';


import { d3TimeFormatPreset } from '../javascripts/modules/utils';

import './gantt.css';
import '../vendor/d3-gantt-chart/gantt-chart-d3.css';
import { d3gantt } from '../vendor/d3-gantt-chart/gantt-chart-d3';
d3.gantt = d3gantt;

function ganttVis(slice, payload) {
  const fd = slice.formData;

  const container = d3.select(slice.selector);
  container.style('height', slice.height());
  container.selectAll('*').remove();

  // TODO: use d3TimeFormatPreset ?
  const format = "%H:%M"
  const d3fmt = d3.time.format(format);
  const formatStartDate = task => d3fmt(task.startDate);
  const formatEndDate = task => d3fmt(task.endDate);


  // TODO: get this into controls ? colorScalerFactory ??
  let taskStatus = {
    'SUCCEEDED' : 'bar',
    'FAILED' : 'bar-failed',
    'RUNNING' : 'bar-running',
    'KILLED' : 'bar-killed'
  };

  const data = payload.data.data;

  let tasks = [];
  let taskNames = [];

  Object.values(data).forEach((row) => {
    // build taskNames
    if( !taskNames.includes(row[fd.task_column]) ) {
      taskNames.push(row[fd.task_column]);
    }

    // make some JS dates
    row[fd.start_time_column] = moment.utc(row[fd.start_time_column]).toDate();
    row[fd.end_time_column] = moment.utc(row[fd.end_time_column]).toDate();
    tasks.push(row);
  });

  const gantt = d3.gantt()
        .taskTypes(taskNames)
        .taskStatus(taskStatus)
        .selector(slice.selector)
        .tickFormat(format)
        .margins({top:10,right:10,bottom:10,left:10})
        .tooltipFormatStartDate(formatStartDate)
        .tooltipFormatEndDate(formatEndDate)
        .width(container[0][0].clientWidth);

  gantt(tasks);

}

module.exports = ganttVis;
