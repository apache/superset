/*
data should contain below params
  {
    minValue => min value to generate legend,
    maxvalue => max value to generate legend,
    L => leaflet,
    id => where do you want to add legend container,
    getLegendColor =>  get legend color as per solution,
    mapInstance =>  where do you want to add legend
  }
*/

export class LegendComponent {
  constructor(data) {
    this.data = data;
    this.addMapLegend = this.addMapLegend.bind(this);
  }

  addMapLegend() {
    const minValue = this.data.minValue;
    const maxvalue = this.data.maxvalue;
    const legends = this.splitRangeIntoEqualParts(parseFloat(minValue), parseFloat(maxvalue), 10);

    const legend = this.data.L.control({ position: 'topleft' });
    legend.onAdd = () => {
      let div;
      if ($('#' + this.data.id).length > 0) {
        div = $('#' + this.data.id)[0];
      } else {
        div = this.data.L.DomUtil.create('div');
        div.setAttribute('id', this.data.id)

        //to show legend horizontally, un-comment below line
        //div.classList.add("map-legend-container-horizontal");

      }
      div.innerHTML = this.getLegendComponent(legends);
      return div;
    };
    legend.addTo(this.data.mapInstance);
  }


  getLegendComponent(legends) {
    let html = `<div class='map-legend-label'>0%</div>`

    for (let i = 0; i < legends.length; i++) {
      html += `<div class='map-legend-div' id='legend_${i}' style='background-color: ${this.data.getLegendColor(legends[i])}'></div>`
    }
    html += `<div class='map-legend-label'>100%</div>`
    return html;
  }

  splitRangeIntoEqualParts(left, right, parts) {
    let result = [],
      delta = (right - left) / (parts - 1);
    while (left < right) {
      result.push(left);
      left += delta;
    }
    result.push(right);
    return result;
  }
}
