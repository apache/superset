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
// eslint-disable-next-line import/no-extraneous-dependencies
import dt from 'datatables.net-bs';
// eslint-disable-next-line import/no-extraneous-dependencies
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import $ from 'jquery';
import { formatNumber } from '@superset-ui/number-format';
import fixTableHeight from '../../modules/utils';
import './PivotTable.css';

dt(window, $);

module.exports = function(slice, payload) {
  const container = slice.container;
  const fd = slice.formData;
  const height = container.height();
  // column on the top or metric on the top
  const combineMetric = fd.combine_metric;
  const cols = payload.data.columns;
  // get the metric of every column, with the consideration of combine_metric
  let metricForCols = cols;
  if (Array.isArray(cols[0])) {
    metricForCols = cols.map(col =>
      combineMetric ? col[cols[0].length - 1] : col[0],
    );
  }
  const columnConfiguration = fd.column_configuration;
  const rowConfiguration = fd.row_configuration;
  // by default, column configution has high priority than row configuration
  const rowConfigHasHighPriority = fd.row_configuration_priority || false;

  // payload data is a string of html with a single table element
  container.html(payload.data.html);

  // jQuery hack to set verbose names in headers
  const replaceCell = function() {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find('thead tr:first th').each(replaceCell);
  slice.container.find('thead tr th:first-child').each(replaceCell);

  // to change the array to a string split by ','
  const transformToString = function(columnArray) {
    if (!Array.isArray(columnArray)) {
      return columnArray;
    } else if (columnArray.length > 1) {
      return columnArray.join(',');
    } else if (columnArray.length === 1) {
      return columnArray[0];
    }
    return '';
  };
  // check if the conditional config should add to the cell or not
  const checkAddOptionStyleOrnot = function(base, val, compare) {
    switch (compare) {
      case '<':
        return parseFloat(val) < parseFloat(base);
      case '=':
        return parseFloat(val) === parseFloat(base);
      case '>':
        return parseFloat(val) > parseFloat(base);
      case 'contains':
        return val.toString().indexOf(base) !== -1;
      case 'startsWith':
        return val.toString().startsWith(base);
      case 'endsWith':
        return val.toString().endsWith(base);
      default:
        return false;
    }
  };

  // check if the object is null or empty
  const checkObjectOrStringHasLengthOrnot = function(obj) {
    if (!obj) {
      return false;
    }
    if (typeof obj === 'string') {
      return obj.length > 0;
    } else if (typeof obj === 'object') {
      return Object.keys(obj).length > 0;
    }
    return true;
  };

  // check if this columnstring in column configuration or not
  // check if this option in this columnstring's config is null or not
  const findColInColumnConfigOption = function(columnString, configName) {
    if (
      columnString in columnConfiguration &&
      configName in columnConfiguration[columnString] &&
      checkObjectOrStringHasLengthOrnot(
        columnConfiguration[columnString][configName],
      )
    ) {
      return true;
    }
    return false;
  };

  // to find the next column configure element in formdata used to set config
  const findNextColumnConfiguration = function(columnArray) {
    const length = columnArray.length;
    if (length > 1) {
      return columnArray.slice(0, length - 1);
    } else if (length === 1) {
      return columnArray[0];
    }
    return null;
  };

  // get column configuration of every option
  // if there are more than one configuration for this column and option
  // then get the more detailed one
  const getColumnConfigForOption = function(curColumn, configName) {
    let column = curColumn;
    let columnString = transformToString(column);
    while (
      Array.isArray(column) &&
      column.length > 1 &&
      !findColInColumnConfigOption(columnString, configName)
    ) {
      column = findNextColumnConfiguration(column);
      columnString = transformToString(column);
    }
    if (!findColInColumnConfigOption(columnString, configName)) {
      return configName === 'bcColoringOption' ||
        configName === 'coloringOption'
        ? {}
        : '';
    }
    return columnConfiguration[columnString][configName];
  };

  // get the column configuration object for the column
  const getColumnConfig = function(column) {
    const columnBgColorConfig = getColumnConfigForOption(
      column,
      'bcColoringOption',
    );
    const columnTextAlignConfig = getColumnConfigForOption(column, 'textAlign');
    const columnFormatConfig = getColumnConfigForOption(column, 'formatting');
    const columnComparisionConfig = getColumnConfigForOption(
      column,
      'comparisionOption',
    );
    const columnBasementConfig = getColumnConfigForOption(column, 'basement');
    const columnColorConfig = getColumnConfigForOption(
      column,
      'coloringOption',
    );
    const columnFontConfig = getColumnConfigForOption(column, 'fontOption');

    const columnConfig = {};
    columnConfig.columnBgColorConfig = columnBgColorConfig;
    columnConfig.columnFormatConfig = columnFormatConfig;
    columnConfig.columnTextAlignConfig = columnTextAlignConfig;
    columnConfig.columnComparisionConfig = columnComparisionConfig;
    columnConfig.columnBasementConfig = columnBasementConfig;
    columnConfig.columnColorConfig = columnColorConfig;
    columnConfig.columnFontConfig = columnFontConfig;
    return columnConfig;
  };

  // update the option in a config object
  const updateConfig = function(config, optionName, optionValue) {
    const newConfig = config;
    if (optionValue && checkObjectOrStringHasLengthOrnot(optionValue)) {
      newConfig[optionName] = optionValue;
    }
    return newConfig;
  };

  // update column configuration according to the cell's value
  const updateColumnConfig = function(obj, columnconfig, value) {
    let config = obj.data('config') || {};
    config = updateConfig(config, 'color', columnconfig.columnBgColorConfig);
    config = updateConfig(config, 'format', columnconfig.columnFormatConfig);
    config = updateConfig(
      config,
      'textAlign',
      columnconfig.columnTextAlignConfig,
    );
    if (
      checkAddOptionStyleOrnot(
        columnconfig.columnBasementConfig,
        value,
        columnconfig.columnComparisionConfig,
      )
    ) {
      config = updateConfig(config, 'color', columnconfig.columnColorConfig);
      config = updateConfig(
        config,
        'fontWeight',
        columnconfig.columnFontConfig,
      );
    }
    obj.data('config', config);
  };

  // apply color, font weight and format config to the cell
  const applyconfig = function(obj) {
    const config = obj.data('config') || {};
    const originalValue = obj.attr('initialValue');
    if (config.color && checkObjectOrStringHasLengthOrnot(config.color)) {
      obj.css('background', config.color.hex);
    }
    if (
      config.fontWeight &&
      checkObjectOrStringHasLengthOrnot(config.fontWeight)
    ) {
      obj.css('font-weight', config.fontWeight);
    }
    if (
      config.textAlign &&
      checkObjectOrStringHasLengthOrnot(config.textAlign)
    ) {
      obj.css('text-align', config.textAlign);
    }
    if (config.format && checkObjectOrStringHasLengthOrnot(config.format)) {
      if (originalValue !== '') {
        obj.html(d3.format(config.format)(originalValue));
      }
    }
  };

  // check if this row has row configuration or not
  const getRowConfig = function(obj) {
    const rowContains = rowConfiguration.basements;
    for (let i = 0, l = rowContains.length; i < l; i++) {
      for (const j in obj.cells) {
        if (obj.cells[j].innerText === rowContains[i]) {
          return true;
        }
      }
    }
    return false;
  };

  // update and apply row configuration after get the row configuration
  const updateAndApplyRowConfig = function(obj) {
    const rowColor = rowConfiguration.coloringOption;
    const rowFont = rowConfiguration.fontOption;
    obj.find('td, th').each(function() {
      const childObj = $(this);
      let config = $(this).data('config') || {};
      if (!(childObj.attr('rowspan') > 1)) {
        if (rowColor) {
          config = updateConfig(config, 'color', rowColor);
        }
        if (rowFont) {
          config = updateConfig(config, 'fontWeight', rowFont);
        }
        $(this).data('config', config);
      }
      applyconfig($(this));
    });
  };

  // jQuery hack to format number
  slice.container.find('tbody tr').each(function() {
    $(this)
      .find('td')
      .each(function(i) {
        const metric = metricForCols[i];
        const format =
          slice.datasource.column_formats[metric] || fd.number_format || '.3s';
        const tdText = $(this)[0].textContent;
        $(this).attr('initialValue', tdText);
        if (!isNaN(tdText) && tdText !== '') {
          $(this)[0].textContent = formatNumber(format, tdText);
        }
      });
  });

  // apply row configuration
  function applyRowConfiguration() {
    if (rowConfiguration) {
      slice.container.find('tbody tr').each(function() {
        const hasRowConfig = getRowConfig(this);
        if (hasRowConfig) {
          updateAndApplyRowConfig($(this));
        }
      });
    }
  }

  // apply column configuration
  function applyColumnConfiguration() {
    if (columnConfiguration) {
      slice.container.find('tbody tr').each(function() {
        $(this)
          .find('td')
          .each(function(index) {
            const col = cols[index];
            const val =
              $(this).attr('initialValue') ||
              $(this).data('originalvalue') ||
              $(this).text();
            $(this).data('originalvalue', val);
            const columnConfig = getColumnConfig(col);
            updateColumnConfig($(this), columnConfig, val);
            applyconfig($(this));
          });
      });
    }
  }

  if (rowConfigHasHighPriority) {
    applyColumnConfiguration();
    applyRowConfiguration();
  } else {
    applyRowConfiguration();
    applyColumnConfiguration();
  }

  if (fd.groupby.length === 1) {
    // When there is only 1 group by column,
    // we use the DataTable plugin to make the header fixed.
    // The plugin takes care of the scrolling so we don't need
    // overflow: 'auto' on the table.
    container.css('overflow', 'hidden');
    const table = container.find('table').DataTable({
      paging: false,
      searching: false,
      bInfo: false,
      scrollY: `${height}px`,
      scrollCollapse: true,
      scrollX: true,
    });
    table
      .column('-1')
      .order('desc')
      .draw();
    fixTableHeight(container.find('.dataTables_wrapper'), height);
  } else {
    // When there is more than 1 group by column we just render the table, without using
    // the DataTable plugin, so we need to handle the scrolling ourselves.
    // In this case the header is not fixed.
    container.css('overflow', 'auto');
    container.css('height', `${height + 10}px`);
  }
};
