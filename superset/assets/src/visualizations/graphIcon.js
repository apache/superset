/**
 * Created by rasmiranjan.nayak on 28/05/15.
 */

/*
 * L.ENB is a circle overlay with a permanent pixel radius.
 */
function drawHexagon(cntxt, x_1,y_1,y_2, options){
  cntxt.moveTo(0, 0);
  cntxt.lineTo(x_1, y_1);
  cntxt.lineTo(x_1, (y_2 - y_1));
  cntxt.lineTo(0, y_2);
  cntxt.lineTo(-(x_1), (y_2 - y_1));
  cntxt.lineTo(-(x_1), y_1);
  cntxt.lineTo(0, 0);

  cntxt.fill();
  cntxt.stroke();
  cntxt.closePath();

  if(options.markerValue){
    cntxt.font = "10px";
    cntxt.fillStyle = "white";
    cntxt.textAlign = "center";
    cntxt.fillText(options.markerValue, 0, y_2/2);
  }
}
function drawArcLine(cntxt, x,y, x1,y1,x2,y2,radius,startAngle, endAngle){
  cntxt.lineWidth = 1;
  cntxt.strokeStyle = '#19242A';
  cntxt.beginPath();
  cntxt.moveTo(x,y);
  cntxt.lineTo(x1, y1);
  cntxt.moveTo(x,y);
  cntxt.lineTo(x2,y2);
  cntxt.stroke();

  cntxt.strokeStyle = 'black';
  cntxt.beginPath();
  cntxt.arc(x, y, radius, startAngle,  endAngle);
  cntxt.stroke();
}

function setTopLeft(div,top, left){
  div.style.top = top + 'px';
  div.style.left = left + 'px';
}

function setHexagonPosition(options,div){
  if (options.directionValue > 240 && options.directionValue <= 360) {
    setTopLeft(div, -35, -35);
  } else if (options.directionValue > 120 && options.directionValue <= 240) {
    setTopLeft(div, -12.5, -47);
  }else if(options.directionValue >=0 && options.directionValue <=120){
    setTopLeft(div, -12.5, -21);
  }
}

function drawArc(options, cntxt, x_1, y_1,y_2,inner_circle_radius){
  if (options.directionValue >=0 && options.directionValue <=120) {
    drawArcLine(cntxt,-x_1, y_1, 0, 0, -x_1, y_2-y_1, inner_circle_radius,11*Math.PI/6, Math.PI/2)
  } else if (options.directionValue > 120 && options.directionValue <= 240) {
    drawArcLine(cntxt,x_1, y_1, 0, 0, x_1, y_2-y_1, inner_circle_radius,Math.PI/2, 7*Math.PI/6)
  } else if (options.directionValue > 240 && options.directionValue <= 360) {
    drawArcLine(cntxt,0, y_2, -x_1, y_2 - y_1, x_1, y_2 - y_1, inner_circle_radius, 7*Math.PI/6,  11*Math.PI/6)
  }
}

export var ENB = L.Icon.extend({
  createIcon: function (oldIcon) {
    const div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div');
    const options = this.options;
    const canvas_height = 32;
    const canvas_width = 30;
    var edge_length = 15;
    var inner_circle_radius = edge_length / 1.5;
    var theta = 30 * (Math.PI / 180);
    var x_1 = edge_length * (Math.cos(theta));
    var y_1 = edge_length * (Math.sin(theta));
    var y_2 = y_1 + (edge_length + (y_1));
    const translateCenterY = 0;
    const translateCenterX = canvas_width / 2;

    div.id = 'mapEnode';
    div.innerHTML = '';

    const graphicsBox = L.DomUtil.create("canvas", "graphicsBox");
    graphicsBox.height = canvas_height;
    graphicsBox.width = canvas_width;

    const cntxt = graphicsBox.getContext("2d");
    cntxt.translate(translateCenterX, translateCenterY);
    cntxt.beginPath();
    cntxt.fillStyle = options.color;
    cntxt.strokeStyle = options.color;

    drawHexagon(cntxt,x_1,y_1,y_2,options);
    drawArc(options, cntxt, x_1, y_1, y_2, inner_circle_radius);

    div.appendChild(graphicsBox);
    div.style.position = 'absolute';
    setHexagonPosition(options, div);
    this._setIconStyles(div, 'icon');

    return div;
  }
});

L.enb = function (options) {
  return new L.ENB(options);
};
