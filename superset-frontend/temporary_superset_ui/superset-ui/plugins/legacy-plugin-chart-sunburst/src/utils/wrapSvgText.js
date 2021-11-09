/*
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
        lineNumber += 1;
        line.pop();
        // remove word that pushes over the limit
        tspan.text(line.join(' '));
        line = [word];
        tspan = d3Text
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', `${lineNumber * lineHeight + dy}em`)
          .text(word);
        didWrap = true;
      }
    });

    if (!didWrap && typeof adjustedY !== 'undefined') {
      tspan.attr('y', adjustedY);
    }
  });
}
