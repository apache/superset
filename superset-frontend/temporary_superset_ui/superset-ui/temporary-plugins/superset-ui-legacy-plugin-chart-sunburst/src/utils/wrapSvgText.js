/* eslint-disable no-plusplus */

/*
  Utility function that takes a d3 svg:text selection and a max width, and splits the
  text's text across multiple tspan lines such that any given line does not exceed max width

  If text does not span multiple lines AND adjustedY is passed,
  will set the text to the passed val
*/
import d3 from 'd3';

export default function wrapSvgText(text, width, adjustedY) {
  const lineHeight = 1;
  // ems
  text.each(function each() {
    const d3Text = d3.select(this);
    const words = d3Text.text().split(/\s+/);
    let line = [];
    let lineNumber = 0;
    const x = d3Text.attr('x');
    const y = d3Text.attr('y');
    const dy = parseFloat(d3Text.attr('dy'));
    let tspan = d3Text
      .text(null)
      .append('tspan')
      .attr('x', x)
      .attr('y', y)
      .attr('dy', `${dy}em`);

    let didWrap = false;
    words.forEach(word => {
      line.push(word);
      tspan.text(line.join(' '));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        // remove word that pushes over the limit
        tspan.text(line.join(' '));
        line = [word];
        tspan = d3Text
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', `${++lineNumber * lineHeight + dy}em`)
          .text(word);
        didWrap = true;
      }
    });

    if (!didWrap && typeof adjustedY !== 'undefined') {
      tspan.attr('y', adjustedY);
    }
  });
}
