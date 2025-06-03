/* [LICENSE TBD] */
/* eslint-disable */
// from http://bl.ocks.org/3687826
export default function (config: $TSFixMe) {
  var columns: $TSFixMe = [];

  var dg = function (selection: $TSFixMe) {
    // @ts-expect-error TS(2686): 'd3' refers to a UMD global, but the current file ... Remove this comment to see the full error message
    if (columns.length == 0) columns = d3.keys(selection.data()[0][0]);

    // header
    selection
      .selectAll('.header')
      .data([true])
      .enter()
      .append('div')
      .attr('class', 'header');

    var header = selection.select('.header').selectAll('.cell').data(columns);

    header
      .enter()
      .append('div')
      .attr('class', function (d: $TSFixMe, i: $TSFixMe) {
        return 'col-' + i;
      })
      .classed('cell', true);

    selection.selectAll('.header .cell').text(function (d: $TSFixMe) {
      return d;
    });

    header.exit().remove();

    // rows
    var rows = selection.selectAll('.row').data(function (d: $TSFixMe) {
      return d;
    });

    rows.enter().append('div').attr('class', 'row');

    rows.exit().remove();

    var cells = selection
      .selectAll('.row')
      .selectAll('.cell')
      .data(function (d: $TSFixMe) {
        // @ts-expect-error TS(7006): Parameter 'col' implicitly has an 'any' type.
        return columns.map(function (col) {
          return d[col];
        });
      });

    // cells
    cells
      .enter()
      .append('div')
      .attr('class', function (d: $TSFixMe, i: $TSFixMe) {
        return 'col-' + i;
      })
      .classed('cell', true);

    cells.exit().remove();

    selection.selectAll('.cell').text(function (d: $TSFixMe) {
      return d;
    });

    return dg;
  };

  // @ts-expect-error TS(2339): Property 'columns' does not exist on type '(select... Remove this comment to see the full error message
  dg.columns = function (_: $TSFixMe) {
    if (!arguments.length) return columns;
    columns = _;
    return this;
  };

  return dg;
}
