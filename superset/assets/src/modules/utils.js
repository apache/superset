/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */
import $ from 'jquery';

/**
 * Sets the body and title content of a modal, and shows it. Assumes HTML for modal exists and that
 * it handles closing (i.e., works with bootstrap)
 *
 * @param {object} options object of the form
 *  {
 *    title: {string},
 *    body: {string},
 *    modalSelector: {string, default: '.misc-modal' },
 *    titleSelector: {string, default: '.misc-modal .modal-title' },
 *    bodySelector:  {string, default: '.misc-modal .modal-body' },
 *   }
 */
export function showModal(options) {
  /* eslint no-param-reassign: 0 */
  options.modalSelector = options.modalSelector || '.misc-modal';
  options.titleSelector = options.titleSelector || '.misc-modal .modal-title';
  options.bodySelector = options.bodySelector || '.misc-modal .modal-body';
  $(options.titleSelector).html(options.title || '');
  $(options.bodySelector).html(options.body || '');
  $(options.modalSelector).modal('show');
}

export function formatSelectOptionsForRange(start, end) {
  // outputs array of arrays
  // formatSelectOptionsForRange(1, 5)
  // returns [[1,1], [2,2], [3,3], [4,4], [5,5]]
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push([i, i.toString()]);
  }
  return options;
}

export function formatSelectOptions(options) {
  return options.map(opt =>
     [opt, opt.toString()],
  );
}

export function getDatasourceParameter(datasourceId, datasourceType) {
  return `${datasourceId}__${datasourceType}`;
}

export function getParam(name) {
  /* eslint no-useless-escape: 0 */
  const formattedName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + formattedName + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

export function mainMetric(savedMetrics) {
  // Using 'count' as default metric if it exists, otherwise using whatever one shows up first
  let metric;
  if (savedMetrics && savedMetrics.length > 0) {
    savedMetrics.forEach((m) => {
      if (m.metric_name === 'count') {
        metric = 'count';
      }
    });
    if (!metric) {
      metric = savedMetrics[0].metric_name;
    }
  }
  return metric;
}
