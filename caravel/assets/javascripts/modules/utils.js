var d3 = require('d3');

/*
    Utility function that takes a d3 svg:text selection and a max width, and splits the
    text's text across multiple tspan lines such that any given line does not exceed max width

    If text does not span multiple lines AND adjustedY is passed, will set the text to the passed val
 */
function wrapSvgText(text, width, adjustedY) {
  var lineHeight = 1; // ems

  text.each(function () {
    var text = d3.select(this),
        words = text.text().split(/\s+/),
        word,
        line = [],
        lineNumber = 0,
        x = text.attr("x"),
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null)
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", dy + "em");

    var didWrap = false;

    for (var i = 0; i < words.length; i++) {
      word = words[i];
      line.push(word);
      tspan.text(line.join(" "));

      if (tspan.node().getComputedTextLength() > width) {
        line.pop(); // remove word that pushes over the limit
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);

        didWrap = true;
      }
    }
    if (!didWrap && typeof adjustedY !== "undefined") {
      tspan.attr("y", adjustedY);
    }
  });
}

module.exports = {
  wrapSvgText: wrapSvgText
};
