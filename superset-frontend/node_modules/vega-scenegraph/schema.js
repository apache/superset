function duplicate(_) {
  return JSON.parse(JSON.stringify(_));
}

function extend(_) {
  for (var x, k, i=1, len=arguments.length; i<len; ++i) {
    x = arguments[i];
    for (k in x) { _[k] = x[k]; }
  }
  return _;
}

function build(strict) {
  const schema = duplicate(BASE);
  for (const type in MARKS) {
    buildMark(type, schema.refs, strict);
  }
  return schema;
}

function buildMark(type, refs, strict) {
  const mark = duplicate(MARK_BASE);
  mark.properties.marktype.enum = [ type ];
  mark.properties.items.items.$ref += type;
  if (strict) mark.additionalProperties = false;

  const item = duplicate(ITEM_BASE);
  extend(item.properties, MARKS[type].properties || {});
  if (strict) item.additionalProperties = false;

  refs.mark.oneOf.push({$ref: '#/refs/mark-' + type});
  refs['mark-'+type] = mark;
  refs['item-'+type] = item;
}

function svg_path() {
  // Based on http://www.w3.org/TR/SVG/paths.html#PathDataBNF
  const wsp  = '[ \t\r\f]*',
        csp  = '([ \t\r\f]+,?[ \t\r\f]*|,[ \t\r\f]*)?',
        sep  = csp + '?',
        pos  = '[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?',
        num  = '[-+]?' + pos,
        nseq = num + '(' + sep + num + ')*',
        p    = num + sep + num,
        p2   = p + sep + p,
        p3   = p + '(' + sep + p + '){2}',
        pseq = p + '(' + sep + p + ')*',
        arc  = pos + sep + pos + sep + num + csp + '[01]' + sep + '[01]' + sep + p,
        m  = '[Mm]'   + wsp + pseq,
        lt = '[LlTt]' + wsp + pseq,
        hv = '[HhVv]' + wsp + nseq,
        c  = '[Cc]'   + wsp + p3 + '(' + sep + p3 + ')*',
        qs = '[QqSs]' + wsp + p2 + '(' + sep + p2 + ')*',
        a  = '[Aa]'   + wsp + arc + '(' + sep + arc + ')*',
        z  = '[Zz]',
        draw = '(' + [z, lt, hv, c, qs, a].join('|') + ')',
        move = m + wsp + '(' + draw + '(' + sep + draw + ')*' + ')?',
        path = wsp + '(' + move + '(' + sep + move + ')*' + ')?' + wsp;
  return path;
}

const COLOR_NAMES = 'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen';

function css_color_names() {
  return COLOR_NAMES.split('|').map(
    name => name.split('')
      .map(c => `[${c.toUpperCase()}${c.toLowerCase()}]`)
      .join('')
  ).join('|');
}

const BASE = {
  '$schema': 'http://json-schema.org/draft-06/schema#',
  'title': 'Vega scenegraph',
  'description': 'Vega scenegraph model.',
  'oneOf': [ { '$ref': '#/refs/mark' } ],
  'refs': {
    'mark': { 'oneOf': [] },
    'path': {
      'type': 'string',
      'pattern': '^' + svg_path() + '$'
    },
    'paint': {
      'oneOf': [
        { '$ref': '#/refs/color' },
        { '$ref': '#/refs/linearGradient' },
        { '$ref': '#/refs/radialGradient' }
      ]
    },
    'color': {
      'oneOf': [
        {
          'type': 'string',
          'pattern': '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
        },
        {
          'type': 'string',
          'pattern': '^rgb\\([ \t\f]*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(,[ \t\f]*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){2}[ \t\f]*\\)$'
        },
        {
          'type': 'string',
          'pattern': '^rgb\\([ \t\f]*([0-9]|[1-9][0-9]|100)%(,[ \t\f]*([0-9]|[1-9][0-9]|100)%){2}[ \t\f]*\\)$'
        },
        {
          'type': 'string',
          'pattern': '^hsl\\([ \t\f]*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-9][0-9]|3[0-5][0-9]|360)(,[ \t\f]*([0-9]|[1-9][0-9]|100)%){2}[ \t\f]*\\)$'
        },
        {
          'type': 'string',
          'pattern': '^(' + css_color_names() + ')$'
        }
      ]
    },
    'gradientStop': {
      'type': 'object',
      'properties': {
        'offset': { 'type': 'number' },
        'color': { '$ref': '#/refs/color' }
      },
      'required': ['offset', 'color']
    },
    'linearGradient': {
      'type': 'object',
      'properties': {
        'gradient': { 'enum': [ 'linear' ] },
        'id': { 'type': 'string' },
        'x1': { 'type': 'number' },
        'y1': { 'type': 'number' },
        'x2': { 'type': 'number' },
        'y2': { 'type': 'number' },
        'stops': {
          'type': 'array',
          'items': { '$ref': '#/refs/gradientStop' }
        }
      },
      'required': ['gradient', 'stops'],
      'additionalProperties': false
    },
    'radialGradient': {
      'type': 'object',
      'properties': {
        'gradient': { 'enum': [ 'radial' ] },
        'id': { 'type': 'string' },
        'x1': { 'type': 'number' },
        'y1': { 'type': 'number' },
        'r1': { 'type': 'number' },
        'x2': { 'type': 'number' },
        'y2': { 'type': 'number' },
        'r2': { 'type': 'number' },
        'stops': {
          'type': 'array',
          'items': { '$ref': '#/refs/gradientStop' }
        }
      },
      'required': ['gradient', 'stops'],
      'additionalProperties': false
    }
  }
};

const MARK_BASE = {
  'type': 'object',
  'properties': {
    'marktype': { 'enum': null },
    'name': { 'type': 'string' },
    'role': { 'type': 'string' },
    'description': { 'type': 'string' },
    'aria': { 'type': 'boolean' },
    'interactive': { 'type': 'boolean', 'default': true },
    'items': {
      'type': 'array',
      'items': { '$ref': '#/refs/item-' }
    },
    'zindex': { 'type': 'number' }
  },
  'required': [ 'marktype' ]
};

const BLEND_MODE = [
  null,
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity'
];

const ITEM_BASE = {
  'type': 'object',
  'properties': {
    'x': { 'type': 'number' },
    'y': { 'type': 'number' },
    'width': { 'type': 'number' },
    'height': { 'type': 'number' },
    'blend': { 'enum': BLEND_MODE, 'default': null },
    'opacity': { 'type': 'number', 'default': 1 },
    'fill': { '$ref': '#/refs/paint' },
    'fillOpacity': { 'type': 'number', 'default': 1 },
    'stroke': { '$ref': '#/refs/paint' },
    'strokeOpacity': { 'type': 'number', 'default': 1 },
    'strokeWidth': { 'type': 'number', 'default': 1 },
    'strokeCap': { 'enum': [ 'butt', 'cap', 'round' ], 'default': 'butt' },
    'strokeJoin': { 'enum': [ 'miter', 'round', 'bevel' ], 'default': 'miter' },
    'strokeMiterLimit': { 'type': 'number' },
    'strokeDash': { 'type': 'array', 'items': { 'type': 'number' } },
    'strokeDashOffset': { 'type': 'number', 'default': 0 },
    'zindex': { 'type': 'number' },
    'cursor': { 'type': 'string' },
    'href': { 'type': 'string', 'format': 'uri-reference' },
    'tooltip': {},
    'description': { 'type': 'string' },
    'aria': { 'type': 'boolean' },
    'ariaRole': { 'type': 'string' },
    'ariaRoleDescription': { 'type': 'string' }
  }
};

const AREA_INTERPOLATE = [
  'basis',
  'cardinal',
  'catmull-rom',
  'linear',
  'monotone',
  'natural',
  'step',
  'step-after',
  'step-before'
];

const LINE_INTERPOLATE = [
  'basis',
  'basis-closed',
  'basis-open',
  'bundle',
  'cardinal',
  'cardinal-closed',
  'cardinal-open',
  'catmull-rom',
  'catmull-rom-closed',
  'catmull-rom-open',
  'linear',
  'linear-closed',
  'monotone',
  'natural',
  'step',
  'step-after',
  'step-before'
];

const TEXT_BASELINE = [
  'alphabetic',
  'top',
  'middle',
  'bottom',
  'line-top',
  'line-bottom'
];

const TEXT_FONT_WEIGHT = [
  'normal',
  'bold',
  'bolder',
  'lighter',
  100,
  200,
  300,
  400,
  500,
  600,
  700,
  800,
  900
];

const MARKS = {
  'group': {
    'properties': {
      'clip': { 'type': 'boolean' },
      'cornerRadius': { 'type': 'number' },
      'cornerRadiusTopLeft': { 'type': 'number' },
      'cornerRadiusTopRight': { 'type': 'number' },
      'cornerRadiusBottomRight': { 'type': 'number' },
      'cornerRadiusBottomLeft': { 'type': 'number' },
      'items': { 'type': 'array', 'items': { '$ref': '#/refs/mark' } },
      'strokeForeground': { 'type': 'boolean' },
      'strokeOffset': { 'type': 'number' }
    }
  },
  'arc': {
    'properties': {
      'startAngle': { 'type': 'number' },
      'endAngle': { 'type': 'number' },
      'padAngle': { 'type': 'number' },
      'innerRadius': { 'type': 'number' },
      'outerRadius': { 'type': 'number' },
      'cornerRadius': { 'type': 'number' }
    }
  },
  'area': {
    'properties': {
      'defined': { 'type': 'boolean' },
      'interpolate': { 'enum': AREA_INTERPOLATE },
      'tension': { 'type': 'number' },
      'orient': { 'enum': [ 'horizontal', 'vertical' ] }
    }
  },
  'image': {
    'properties': {
      'url': { 'type': 'string', 'format': 'uri-reference' },
      'aspect': { 'type': 'boolean', 'default': true },
      'smooth': { 'type': 'boolean', 'default': true },
      'align': {
        'enum': [ 'left', 'center', 'right' ],
        'default': 'left'
      },
      'baseline': {
        'enum': [ 'top', 'middle', 'bottom' ],
        'default': 'top'
      }
    }
  },
  'line': {
    'properties': {
      'defined': { 'type': 'boolean' },
      'interpolate': { 'enum': LINE_INTERPOLATE },
      'tension': { 'type': 'number' },
      'orient': { 'enum': [ 'horizontal', 'vertical' ] },
      'size': { 'type': 'number' }
    }
  },
  'path': {
    'properties': {
      'angle': { 'type': 'number' },
      'path': { '$ref': '#/refs/path' },
      'scaleX': { 'type': 'number' },
      'scaleY': { 'type': 'number' }
    }
  },
  'rect': {
    'properties': {
      'cornerRadius': { 'type': 'number' },
      'cornerRadiusTopLeft': { 'type': 'number' },
      'cornerRadiusTopRight': { 'type': 'number' },
      'cornerRadiusBottomRight': { 'type': 'number' },
      'cornerRadiusBottomLeft': { 'type': 'number' }
    }
  },
  'rule': {
    'properties': {
      'x2': { 'type': 'number' },
      'y2': { 'type': 'number' }
    }
  },
  'symbol': {
    'properties': {
      'angle': { 'type': 'number', 'default': 0 },
      'size': { 'type': 'number', 'default': 100 },
      'shape': { 'type': 'string' }
    }
  },
  'text': {
    'properties': {
      'text': {
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'array', 'items': { 'type': 'string' } }
        ]
      },
      'limit': { 'type': 'number', 'default': 0 },
      'lineHeight': { 'type': 'number' },
      'dir': { 'type': 'string', 'default': 'ltr' },
      'ellipsis': { 'type': 'string', 'default': '\u2026' },
      'align': {
        'enum': [ 'left', 'center', 'right' ],
        'default': 'left'
      },
      'baseline': {
        'enum': TEXT_BASELINE,
        'default': 'alphabetic'
      },
      'angle': { 'type': 'number', 'default': 0 },
      'theta': { 'type': 'number', 'default': 0 },
      'radius': { 'type': 'number', 'default': 0 },
      'dx': { 'type': 'number', 'default': 0 },
      'dy': { 'type': 'number', 'default': 0 },
      'font': { 'type': 'string', 'default': 'sans-serif' },
      'fontSize': { 'type': 'number' },
      'fontStyle': {
        'enum': [ 'normal', 'italic', 'oblique' ],
        'default': 'normal'
      },
      'fontWeight': {
        'enum': TEXT_FONT_WEIGHT,
        'default': 'normal'
      },
      'fontVariant': {
        'enum': [ 'normal', 'small-caps' ],
        'default': 'normal'
      }
    }
  },
  'trail': {
    'properties': {
      'defined': { 'type': 'boolean' },
      'size': { 'type': 'number', 'default': 1 }
    }
  }
};

const schema = build(true);
process.stdout.write(JSON.stringify(schema, null, 2));
