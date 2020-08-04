//A little snippet of D3 code that creates a button that lets you toggle whether a chart is the only one visible on a page or not.
d3.selectAll(".chart button").on("click",function() {
   var thisId = this.parentElement.id;

   var chartContainer = d3.select("#" + thisId);
   if (chartContainer.attr("class").match("selected"))
      chartContainer.classed("selected",false);
   else
      chartContainer.classed("selected",true);

   d3.selectAll(".chart").style("display",function() {
        if (thisId === this.id) return "block";

        if (d3.select(this).style("display") === "none")
          return "block";
        else
          return "none";
   });
   window.onresize();
});