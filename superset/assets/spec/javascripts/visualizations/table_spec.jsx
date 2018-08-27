import { describe, it } from 'mocha';
import { expect } from 'chai';
import $ from 'jquery';

import '../../helpers/browser';
import { d3format } from '../../../src/modules/utils';

import tableVis from '../../../src/visualizations/table';

describe('table viz', () => {
  const div = '<div id="slice-container"><div class="dataTables_wrapper"></div></div>';
  $('body').append(div);

  const baseSlice = {
    selector: '#slice-container',
    formData: {
      metrics: ['count'],
      timeseries_limit_metric: null,
    },
    datasource: {
      verbose_map: {},
    },
    getFilters: () => {},
    d3format,
    removeFilter: null,
    addFilter: null,
    height: () => 0,
  };
  const basePayload = {
    data: {
      records: [
        { gender: 'boy', count: 39245 },
        { gender: 'girl', count: 36446 },
      ],
      columns: ['gender', 'count'],
    },
  };

  it('renders into a container', () => {
    const container = $(slice.selector);
    expect(container.length).to.equal(1);
  });

  it('renders header and body datatables in container', () => {
    const container = $(slice.selector);

    expect(container.find('.dataTable').length).to.equal(0);
    tableVis(baseSlice, basePayload);
    expect(container.find('.dataTable').length).to.equal(2);

    const tableHeader = container.find('.dataTable')[0];
    expect($(tableHeader).find('thead tr').length).to.equal(1);
    expect($(tableHeader).find('th').length).to.equal(2);

    const tableBody = container.find('.dataTable')[1];
    expect($(tableBody).find('tbody tr').length).to.equal(2);
    expect($(tableBody).find('th').length).to.equal(2);
  });

  it('hides the sort by column', () => {
    const 
  }
});
