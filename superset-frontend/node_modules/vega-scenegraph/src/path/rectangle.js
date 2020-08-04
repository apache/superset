import {path} from 'd3-path';

// See http://spencermortensen.com/articles/bezier-circle/
const C = 0.448084975506; // C = 1 - c

function rectangleX(d) {
  return d.x;
}

function rectangleY(d) {
  return d.y;
}

function rectangleWidth(d) {
  return d.width;
}

function rectangleHeight(d) {
  return d.height;
}

function number(_) {
  return typeof _ === 'function' ? _ : () => +_;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export default function() {
  var x = rectangleX,
      y = rectangleY,
      width = rectangleWidth,
      height = rectangleHeight,
      crTL = number(0),
      crTR = crTL,
      crBL = crTL,
      crBR = crTL,
      context = null;

  function rectangle(_, x0, y0) {
    var buffer,
        x1 = x0 != null ? x0 : +x.call(this, _),
        y1 = y0 != null ? y0 : +y.call(this, _),
        w  = +width.call(this, _),
        h  = +height.call(this, _),
        s  = Math.min(w, h) / 2,
        tl = clamp(+crTL.call(this, _), 0, s),
        tr = clamp(+crTR.call(this, _), 0, s),
        bl = clamp(+crBL.call(this, _), 0, s),
        br = clamp(+crBR.call(this, _), 0, s);

    if (!context) context = buffer = path();

    if (tl <= 0 && tr <= 0 && bl <= 0 && br <= 0) {
      context.rect(x1, y1, w, h);
    } else {
      var x2 = x1 + w,
          y2 = y1 + h;
      context.moveTo(x1 + tl, y1);
      context.lineTo(x2 - tr, y1);
      context.bezierCurveTo(x2 - C * tr, y1, x2, y1 + C * tr, x2, y1 + tr);
      context.lineTo(x2, y2 - br);
      context.bezierCurveTo(x2, y2 - C * br, x2 - C * br, y2, x2 - br, y2);
      context.lineTo(x1 + bl, y2);
      context.bezierCurveTo(x1 + C * bl, y2, x1, y2 - C * bl, x1, y2 - bl);
      context.lineTo(x1, y1 + tl);
      context.bezierCurveTo(x1, y1 + C * tl, x1 + C * tl, y1, x1 + tl, y1);
      context.closePath();
    }

    if (buffer) {
      context = null;
      return buffer + '' || null;
    }
  }

  rectangle.x = function(_) {
    if (arguments.length) {
      x = number(_);
      return rectangle;
    } else {
      return x;
    }
  };

  rectangle.y = function(_) {
    if (arguments.length) {
      y = number(_);
      return rectangle;
    } else {
      return y;
    }
  };

  rectangle.width = function(_) {
    if (arguments.length) {
      width = number(_);
      return rectangle;
    } else {
      return width;
    }
  };

  rectangle.height = function(_) {
    if (arguments.length) {
      height = number(_);
      return rectangle;
    } else {
      return height;
    }
  };

  rectangle.cornerRadius = function(tl, tr, br, bl) {
    if (arguments.length) {
      crTL = number(tl);
      crTR = tr != null ? number(tr) : crTL;
      crBR = br != null ? number(br) : crTL;
      crBL = bl != null ? number(bl) : crTR;
      return rectangle;
    } else {
      return crTL;
    }
  };

  rectangle.context = function(_) {
    if (arguments.length) {
      context = _ == null ? null : _;
      return rectangle;
    } else {
      return context;
    }
  };

  return rectangle;
}
