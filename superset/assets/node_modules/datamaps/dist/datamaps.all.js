(function() {
  var svg;

  // Save off default references
  var d3 = window.d3, topojson = window.topojson;

  var defaultOptions = {
    scope: 'world',
    responsive: false,
    aspectRatio: 0.5625,
    setProjection: setProjection,
    projection: 'equirectangular',
    dataType: 'json',
    data: {},
    done: function() {},
    fills: {
      defaultFill: '#ABDDA4'
    },
    filters: {},
    geographyConfig: {
        dataUrl: null,
        hideAntarctica: true,
        hideHawaiiAndAlaska : false,
        borderWidth: 1,
        borderOpacity: 1,
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></div>';
        },
        popupOnHover: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightBorderOpacity: 1
    },
    projectionConfig: {
      rotation: [97, 0]
    },
    bubblesConfig: {
        borderWidth: 2,
        borderOpacity: 1,
        borderColor: '#FFFFFF',
        popupOnHover: true,
        radius: null,
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.75,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightBorderOpacity: 1,
        highlightFillOpacity: 0.85,
        exitDelay: 100,
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600,
      popupOnHover: false,
      popupTemplate: function(geography, data) {
        // Case with latitude and longitude
        if ( ( data.origin && data.destination ) && data.origin.latitude && data.origin.longitude && data.destination.latitude && data.destination.longitude ) {
          return '<div class="hoverinfo"><strong>Arc</strong><br>Origin: ' + JSON.stringify(data.origin) + '<br>Destination: ' + JSON.stringify(data.destination) + '</div>';
        }
        // Case with only country name
        else if ( data.origin && data.destination ) {
          return '<div class="hoverinfo"><strong>Arc</strong><br>' + data.origin + ' -> ' + data.destination + '</div>';
        }
        // Missing information
        else {
          return '';
        }
      }
    }
  };

  /*
    Getter for value. If not declared on datumValue, look up the chain into optionsValue
  */
  function val( datumValue, optionsValue, context ) {
    if ( typeof context === 'undefined' ) {
      context = optionsValue;
      optionsValues = undefined;
    }
    var value = typeof datumValue !== 'undefined' ? datumValue : optionsValue;

    if (typeof value === 'undefined') {
      return  null;
    }

    if ( typeof value === 'function' ) {
      var fnContext = [context];
      if ( context.geography ) {
        fnContext = [context.geography, context.data];
      }
      return value.apply(null, fnContext);
    }
    else {
      return value;
    }
  }

  function addContainer( element, height, width ) {
    this.svg = d3.select( element ).append('svg')
      .attr('width', width || element.offsetWidth)
      .attr('data-width', width || element.offsetWidth)
      .attr('class', 'datamap')
      .attr('height', height || element.offsetHeight)
      .style('overflow', 'hidden'); // IE10+ doesn't respect height/width when map is zoomed in

    if (this.options.responsive) {
      d3.select(this.options.element).style({'position': 'relative', 'padding-bottom': (this.options.aspectRatio*100) + '%'});
      d3.select(this.options.element).select('svg').style({'position': 'absolute', 'width': '100%', 'height': '100%'});
      d3.select(this.options.element).select('svg').select('g').selectAll('path').style('vector-effect', 'non-scaling-stroke');

    }

    return this.svg;
  }

  // setProjection takes the svg element and options
  function setProjection( element, options ) {
    var width = options.width || element.offsetWidth;
    var height = options.height || element.offsetHeight;
    var projection, path;
    var svg = this.svg;

    if ( options && typeof options.scope === 'undefined') {
      options.scope = 'world';
    }

    if ( options.scope === 'usa' ) {
      projection = d3.geo.albersUsa()
        .scale(width)
        .translate([width / 2, height / 2]);
    }
    else if ( options.scope === 'world' ) {
      projection = d3.geo[options.projection]()
        .scale((width + 1) / 2 / Math.PI)
        .translate([width / 2, height / (options.projection === "mercator" ? 1.45 : 1.8)]);
    }

    if ( options.projection === 'orthographic' ) {

      svg.append("defs").append("path")
        .datum({type: "Sphere"})
        .attr("id", "sphere")
        .attr("d", path);

      svg.append("use")
          .attr("class", "stroke")
          .attr("xlink:href", "#sphere");

      svg.append("use")
          .attr("class", "fill")
          .attr("xlink:href", "#sphere");
      projection.scale(250).clipAngle(90).rotate(options.projectionConfig.rotation)
    }

    path = d3.geo.path()
      .projection( projection );

    return {path: path, projection: projection};
  }

  function addStyleBlock() {
    if ( d3.select('.datamaps-style-block').empty() ) {
      d3.select('head').append('style').attr('class', 'datamaps-style-block')
      .html('.datamap path.datamaps-graticule { fill: none; stroke: #777; stroke-width: 0.5px; stroke-opacity: .5; pointer-events: none; } .datamap .labels {pointer-events: none;} .datamap path:not(.datamaps-arc), .datamap circle, .datamap line {stroke: #FFFFFF; vector-effect: non-scaling-stroke; stroke-width: 1px;} .datamaps-legend dt, .datamaps-legend dd { float: left; margin: 0 3px 0 0;} .datamaps-legend dd {width: 20px; margin-right: 6px; border-radius: 3px;} .datamaps-legend {padding-bottom: 20px; z-index: 1001; position: absolute; left: 4px; font-size: 12px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;} .datamaps-hoverover {display: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; } .hoverinfo {padding: 4px; border-radius: 1px; background-color: #FFF; box-shadow: 1px 1px 5px #CCC; font-size: 12px; border: 1px solid #CCC; } .hoverinfo hr {border:1px dotted #CCC; }');
    }
  }

  function drawSubunits( data ) {
    var fillData = this.options.fills,
        colorCodeData = this.options.data || {},
        geoConfig = this.options.geographyConfig;

    var subunits = this.svg.select('g.datamaps-subunits');
    if ( subunits.empty() ) {
      subunits = this.addLayer('datamaps-subunits', null, true);
    }

    var geoData = topojson.feature( data, data.objects[ this.options.scope ] ).features;
    if ( geoConfig.hideAntarctica ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "ATA";
      });
    }

    if ( geoConfig.hideHawaiiAndAlaska ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "HI" && feature.id !== 'AK';
      });
    }

    var geo = subunits.selectAll('path.datamaps-subunit').data( geoData );

    geo.enter()
      .append('path')
      .attr('d', this.path)
      .attr('class', function(d) {
        return 'datamaps-subunit ' + d.id;
      })
      .attr('data-info', function(d) {
        return JSON.stringify( colorCodeData[d.id]);
      })
      .style('fill', function(d) {
        // If fillKey - use that
        // Otherwise check 'fill'
        // Otherwise check 'defaultFill'
        var fillColor;

        var datum = colorCodeData[d.id];
        if ( datum && datum.fillKey ) {
          fillColor = fillData[ val(datum.fillKey, {data: colorCodeData[d.id], geography: d}) ];
        }

        if ( typeof fillColor === 'undefined' ) {
          fillColor = val(datum && datum.fillColor, fillData.defaultFill, {data: colorCodeData[d.id], geography: d});
        }

        return fillColor;
      })
      .style('stroke-width', geoConfig.borderWidth)
      .style('stroke-opacity', geoConfig.borderOpacity)
      .style('stroke', geoConfig.borderColor);
  }

  function handleGeographyConfig () {
    var hoverover;
    var svg = this.svg;
    var self = this;
    var options = this.options.geographyConfig;

    if ( options.highlightOnHover || options.popupOnHover ) {
      svg.selectAll('.datamaps-subunit')
        .on('mouseover', function(d) {
          var $this = d3.select(this);
          var datum = self.options.data[d.id] || {};
          if ( options.highlightOnHover ) {
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('stroke-opacity', val(datum.highlightBorderOpacity, options.highlightBorderOpacity, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));

            // As per discussion on https://github.com/markmarkoh/datamaps/issues/19
            if ( ! /((MSIE)|(Trident))/.test(navigator.userAgent) ) {
             moveToFront.call(this);
            }
          }

          if ( options.popupOnHover ) {
            self.updatePopup($this, d, options, svg);
          }
        })
        .on('mouseout', function() {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            // Reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }
          $this.on('mousemove', null);
          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        });
    }

    function moveToFront() {
      this.parentNode.appendChild(this);
    }
  }

  // Plugin to add a simple map legend
  function addLegend(layer, data, options) {
    data = data || {};
    if ( !this.options.fills ) {
      return;
    }

    var html = '<dl>';
    var label = '';
    if ( data.legendTitle ) {
      html = '<h2>' + data.legendTitle + '</h2>' + html;
    }
    for ( var fillKey in this.options.fills ) {

      if ( fillKey === 'defaultFill') {
        if (! data.defaultFillName ) {
          continue;
        }
        label = data.defaultFillName;
      } else {
        if (data.labels && data.labels[fillKey]) {
          label = data.labels[fillKey];
        } else {
          label= fillKey + ': ';
        }
      }
      html += '<dt>' + label + '</dt>';
      html += '<dd style="background-color:' +  this.options.fills[fillKey] + '">&nbsp;</dd>';
    }
    html += '</dl>';

    var hoverover = d3.select( this.options.element ).append('div')
      .attr('class', 'datamaps-legend')
      .html(html);
  }

    function addGraticule ( layer, options ) {
      var graticule = d3.geo.graticule();
      this.svg.insert("path", '.datamaps-subunits')
        .datum(graticule)
        .attr("class", "datamaps-graticule")
        .attr("d", this.path);
  }

  function handleArcs (layer, data, options) {
    var self = this,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - arcs must be an array";
    }

    // For some reason arc options were put in an `options` object instead of the parent arc
    // I don't like this, so to match bubbles and other plugins I'm moving it
    // This is to keep backwards compatability
    for ( var i = 0; i < data.length; i++ ) {
      data[i] = defaults(data[i], data[i].options);
      delete data[i].options;
    }

    if ( typeof options === "undefined" ) {
      options = defaultOptions.arcConfig;
    }

    var arcs = layer.selectAll('path.datamaps-arc').data( data, JSON.stringify );

    var path = d3.geo.path()
        .projection(self.projection);

    arcs
      .enter()
        .append('svg:path')
        .attr('class', 'datamaps-arc')
        .style('stroke-linecap', 'round')
        .style('stroke', function(datum) {
          return val(datum.strokeColor, options.strokeColor, datum);
        })
        .style('fill', 'none')
        .style('stroke-width', function(datum) {
            return val(datum.strokeWidth, options.strokeWidth, datum);
        })
        .attr('d', function(datum) {

            var originXY, destXY;

            if (typeof datum.origin === "string") {
              switch (datum.origin) {
                   case "CAN":
                       originXY = self.latLngToXY(56.624472, -114.665293);
                       break;
                   case "CHL":
                       originXY = self.latLngToXY(-33.448890, -70.669265);
                       break;
                   case "IDN":
                       originXY = self.latLngToXY(-6.208763, 106.845599);
                       break;
                   case "JPN":
                       originXY = self.latLngToXY(35.689487, 139.691706);
                       break;
                   case "MYS":
                       originXY = self.latLngToXY(3.139003, 101.686855);
                       break;
                   case "NOR":
                       originXY = self.latLngToXY(59.913869, 10.752245);
                       break;
                   case "USA":
                       originXY = self.latLngToXY(41.140276, -100.760145);
                       break;
                   case "VNM":
                       originXY = self.latLngToXY(21.027764, 105.834160);
                       break;
                   default:
                       originXY = self.path.centroid(svg.select('path.' + datum.origin).data()[0]);
               }
            } else {
              originXY = self.latLngToXY(val(datum.origin.latitude, datum), val(datum.origin.longitude, datum))
            }

            if (typeof datum.destination === 'string') {
              switch (datum.destination) {
                     case "CAN":
                        destXY = self.latLngToXY(56.624472, -114.665293);
                        break;
                    case "CHL":
                        destXY = self.latLngToXY(-33.448890, -70.669265);
                        break;
                    case "IDN":
                        destXY = self.latLngToXY(-6.208763, 106.845599);
                        break;
                    case "JPN":
                        destXY = self.latLngToXY(35.689487, 139.691706);
                        break;
                    case "MYS":
                        destXY = self.latLngToXY(3.139003, 101.686855);
                        break;
                    case "NOR":
                        destXY = self.latLngToXY(59.913869, 10.752245);
                        break;
                    case "USA":
                        destXY = self.latLngToXY(41.140276, -100.760145);
                        break;
                    case "VNM":
                        destXY = self.latLngToXY(21.027764, 105.834160);
                        break;
                    default:
                        destXY = self.path.centroid(svg.select('path.' + datum.destination).data()[0]);
              }
            } else {
              destXY = self.latLngToXY(val(datum.destination.latitude, datum), val(datum.destination.longitude, datum));
            }
            var midXY = [ (originXY[0] + destXY[0]) / 2, (originXY[1] + destXY[1]) / 2];
            if (options.greatArc) {
                  // TODO: Move this to inside `if` clause when setting attr `d`
              var greatArc = d3.geo.greatArc()
                  .source(function(d) { return [val(d.origin.longitude, d), val(d.origin.latitude, d)]; })
                  .target(function(d) { return [val(d.destination.longitude, d), val(d.destination.latitude, d)]; });

              return path(greatArc(datum))
            }
            var sharpness = val(datum.arcSharpness, options.arcSharpness, datum);
            return "M" + originXY[0] + ',' + originXY[1] + "S" + (midXY[0] + (50 * sharpness)) + "," + (midXY[1] - (75 * sharpness)) + "," + destXY[0] + "," + destXY[1];
        })
        .attr('data-info', function(datum) {
          return JSON.stringify(datum);
        })
        .on('mouseover', function ( datum ) {
          var $this = d3.select(this);

          if (options.popupOnHover) {
            self.updatePopup($this, datum, options, svg);
          }
        })
        .on('mouseout', function ( datum ) {
          var $this = d3.select(this);

          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        })
        .transition()
          .delay(100)
          .style('fill', function(datum) {
            /*
              Thank you Jake Archibald, this is awesome.
              Source: http://jakearchibald.com/2013/animated-line-drawing-svg/
            */
            var length = this.getTotalLength();
            this.style.transition = this.style.WebkitTransition = 'none';
            this.style.strokeDasharray = length + ' ' + length;
            this.style.strokeDashoffset = length;
            this.getBoundingClientRect();
            this.style.transition = this.style.WebkitTransition = 'stroke-dashoffset ' + val(datum.animationSpeed, options.animationSpeed, datum) + 'ms ease-out';
            this.style.strokeDashoffset = '0';
            return 'none';
          })

    arcs.exit()
      .transition()
      .style('opacity', 0)
      .remove();
  }

  function handleLabels ( layer, options ) {
    var self = this;
    options = options || {};
    var labelStartCoodinates = this.projection([-67.707617, 42.722131]);
    this.svg.selectAll(".datamaps-subunit")
      .attr("data-foo", function(d) {
        var center = self.path.centroid(d);
        var xOffset = 7.5, yOffset = 5;

        if ( ["FL", "KY", "MI"].indexOf(d.id) > -1 ) xOffset = -2.5;
        if ( d.id === "NY" ) xOffset = -1;
        if ( d.id === "MI" ) yOffset = 18;
        if ( d.id === "LA" ) xOffset = 13;

        var x,y;

        x = center[0] - xOffset;
        y = center[1] + yOffset;

        var smallStateIndex = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"].indexOf(d.id);
        if ( smallStateIndex > -1) {
          var yStart = labelStartCoodinates[1];
          x = labelStartCoodinates[0];
          y = yStart + (smallStateIndex * (2+ (options.fontSize || 12)));
          layer.append("line")
            .attr("x1", x - 3)
            .attr("y1", y - 5)
            .attr("x2", center[0])
            .attr("y2", center[1])
            .style("stroke", options.labelColor || "#000")
            .style("stroke-width", options.lineWidth || 1)
        }

          layer.append("text")
              .attr("x", x)
              .attr("y", y)
              .style("font-size", (options.fontSize || 10) + 'px')
              .style("font-family", options.fontFamily || "Verdana")
              .style("fill", options.labelColor || "#000")
              .text(function() {
                  if (options.customLabelText && options.customLabelText[d.id]) {
                      return options.customLabelText[d.id]
                  } else {
                      return d.id
                  }
              });

        return "bar";
      });
  }


  function handleBubbles (layer, data, options ) {
    var self = this,
        fillData = this.options.fills,
        filterData = this.options.filters,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - bubbles must be an array";
    }

    var bubbles = layer.selectAll('circle.datamaps-bubble').data( data, options.key );

    bubbles
      .enter()
        .append('svg:circle')
        .attr('class', 'datamaps-bubble')
        .attr('cx', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            if ( datum.centered === 'USA' ) {
              latLng = self.projection([-98.58333, 39.83333])
            } else {
              latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
            }
          }
          if ( latLng ) return latLng[0];
        })
        .attr('cy', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            if ( datum.centered === 'USA' ) {
              latLng = self.projection([-98.58333, 39.83333])
            } else {
              latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
            }
          }
          if ( latLng ) return latLng[1];
        })
        .attr('r', function(datum) {
          // If animation enabled start with radius 0, otherwise use full size.
          return options.animate ? 0 : val(datum.radius, options.radius, datum);
        })
        .attr('data-info', function(datum) {
          return JSON.stringify(datum);
        })
        .attr('filter', function (datum) {
          var filterKey = filterData[ val(datum.filterKey, options.filterKey, datum) ];

          if (filterKey) {
            return filterKey;
          }
        })
        .style('stroke', function ( datum ) {
          return val(datum.borderColor, options.borderColor, datum);
        })
        .style('stroke-width', function ( datum ) {
          return val(datum.borderWidth, options.borderWidth, datum);
        })
        .style('stroke-opacity', function ( datum ) {
          return val(datum.borderOpacity, options.borderOpacity, datum);
        })
        .style('fill-opacity', function ( datum ) {
          return val(datum.fillOpacity, options.fillOpacity, datum);
        })
        .style('fill', function ( datum ) {
          var fillColor = fillData[ val(datum.fillKey, options.fillKey, datum) ];
          return fillColor || fillData.defaultFill;
        })
        .on('mouseover', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            // Save all previous attributes for mouseout
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('stroke-opacity', val(datum.highlightBorderOpacity, options.highlightBorderOpacity, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));
          }

          if (options.popupOnHover) {
            self.updatePopup($this, datum, options, svg);
          }
        })
        .on('mouseout', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            // Reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }

          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        })

    bubbles.transition()
      .duration(400)
      .attr('r', function ( datum ) {
        return val(datum.radius, options.radius, datum);
      })
    .transition()
      .duration(0)
      .attr('data-info', function(d) {
        return JSON.stringify(d);
      });

    bubbles.exit()
      .transition()
        .delay(options.exitDelay)
        .attr("r", 0)
        .remove();

    function datumHasCoords (datum) {
      return typeof datum !== 'undefined' && typeof datum.latitude !== 'undefined' && typeof datum.longitude !== 'undefined';
    }
  }

  function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
      if (source) {
        for (var prop in source) {
          // Deep copy if property not set
          if (obj[prop] == null) {
            if (typeof source[prop] == 'function') {
              obj[prop] = source[prop];
            }
            else {
              obj[prop] = JSON.parse(JSON.stringify(source[prop]));
            }
          }
        }
      }
    });
    return obj;
  }
  /**************************************
             Public Functions
  ***************************************/

  function Datamap( options ) {

    if ( typeof d3 === 'undefined' || typeof topojson === 'undefined' ) {
      throw new Error('Include d3.js (v3.0.3 or greater) and topojson on this page before creating a new map');
   }
    // Set options for global use
    this.options = defaults(options, defaultOptions);
    this.options.geographyConfig = defaults(options.geographyConfig, defaultOptions.geographyConfig);
    this.options.projectionConfig = defaults(options.projectionConfig, defaultOptions.projectionConfig);
    this.options.bubblesConfig = defaults(options.bubblesConfig, defaultOptions.bubblesConfig);
    this.options.arcConfig = defaults(options.arcConfig, defaultOptions.arcConfig);

    // Add the SVG container
    if ( d3.select( this.options.element ).select('svg').length > 0 ) {
      addContainer.call(this, this.options.element, this.options.height, this.options.width );
    }

    // Add core plugins to this instance
    this.addPlugin('bubbles', handleBubbles);
    this.addPlugin('legend', addLegend);
    this.addPlugin('arc', handleArcs);
    this.addPlugin('labels', handleLabels);
    this.addPlugin('graticule', addGraticule);

    // Append style block with basic hoverover styles
    if ( ! this.options.disableDefaultStyles ) {
      addStyleBlock();
    }

    return this.draw();
  }

  // Resize map
  Datamap.prototype.resize = function () {

    var self = this;
    var options = self.options;

    if (options.responsive) {
      var newsize = options.element.clientWidth,
          oldsize = d3.select( options.element).select('svg').attr('data-width');

      d3.select(options.element).select('svg').selectAll('g').attr('transform', 'scale(' + (newsize / oldsize) + ')');
    }
  }

  // Actually draw the features(states & countries)
  Datamap.prototype.draw = function() {
    // Save off in a closure
    var self = this;
    var options = self.options;

    // Set projections and paths based on scope
    var pathAndProjection = options.setProjection.apply(this, [options.element, options] );

    this.path = pathAndProjection.path;
    this.projection = pathAndProjection.projection;

    // If custom URL for topojson data, retrieve it and render
    if ( options.geographyConfig.dataUrl ) {
      d3.json( options.geographyConfig.dataUrl, function(error, results) {
        if ( error ) throw new Error(error);
        self.customTopo = results;
        draw( results );
      });
    }
    else {
      draw( this[options.scope + 'Topo'] || options.geographyConfig.dataJson);
    }

    return this;

      function draw (data) {
        // If fetching remote data, draw the map first then call `updateChoropleth`
        if ( self.options.dataUrl ) {
          // Allow for csv or json data types
          d3[self.options.dataType](self.options.dataUrl, function(data) {
            // In the case of csv, transform data to object
            if ( self.options.dataType === 'csv' && (data && data.slice) ) {
              var tmpData = {};
              for(var i = 0; i < data.length; i++) {
                tmpData[data[i].id] = data[i];
              }
              data = tmpData;
            }
            Datamaps.prototype.updateChoropleth.call(self, data);
          });
        }
        drawSubunits.call(self, data);
        handleGeographyConfig.call(self);

        if ( self.options.geographyConfig.popupOnHover || self.options.bubblesConfig.popupOnHover) {
          hoverover = d3.select( self.options.element ).append('div')
            .attr('class', 'datamaps-hoverover')
            .style('z-index', 10001)
            .style('position', 'absolute');
        }

        // Fire off finished callback
        self.options.done(self);
      }
  };
  /**************************************
                TopoJSON
  ***************************************/
  Datamap.prototype.worldTopo = {
    "type": "Topology",
    "objects": {
        "world": {
            "type": "GeometryCollection",
            "geometries": [{
                "type": "Polygon",
                "properties": {
                    "name": "Afghanistan"
                },
                "id": "AFG",
                "arcs": [
                    [0, 1, 2, 3, 4, 5]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Angola"
                },
                "id": "AGO",
                "arcs": [
                    [
                        [6, 7, 8, 9]
                    ],
                    [
                        [10, 11, 12]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Albania"
                },
                "id": "ALB",
                "arcs": [
                    [13, 14, 15, 16, 17]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "United Arab Emirates"
                },
                "id": "ARE",
                "arcs": [
                    [18, 19, 20, 21, 22]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Argentina"
                },
                "id": "ARG",
                "arcs": [
                    [
                        [23, 24]
                    ],
                    [
                        [25, 26, 27, 28, 29, 30]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Armenia"
                },
                "id": "ARM",
                "arcs": [
                    [31, 32, 33, 34, 35]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Antarctica"
                },
                "id": "ATA",
                "arcs": [
                    [
                        [36]
                    ],
                    [
                        [37]
                    ],
                    [
                        [38]
                    ],
                    [
                        [39]
                    ],
                    [
                        [40]
                    ],
                    [
                        [41]
                    ],
                    [
                        [42]
                    ],
                    [
                        [43]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "French Southern and Antarctic Lands"
                },
                "id": "ATF",
                "arcs": [
                    [44]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Australia"
                },
                "id": "AUS",
                "arcs": [
                    [
                        [45]
                    ],
                    [
                        [46]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Austria"
                },
                "id": "AUT",
                "arcs": [
                    [47, 48, 49, 50, 51, 52, 53]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Azerbaijan"
                },
                "id": "AZE",
                "arcs": [
                    [
                        [54, -35]
                    ],
                    [
                        [55, 56, -33, 57, 58]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Burundi"
                },
                "id": "BDI",
                "arcs": [
                    [59, 60, 61]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Belgium"
                },
                "id": "BEL",
                "arcs": [
                    [62, 63, 64, 65, 66]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Benin"
                },
                "id": "BEN",
                "arcs": [
                    [67, 68, 69, 70, 71]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Burkina Faso"
                },
                "id": "BFA",
                "arcs": [
                    [72, 73, 74, -70, 75, 76]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Bangladesh"
                },
                "id": "BGD",
                "arcs": [
                    [77, 78, 79]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Bulgaria"
                },
                "id": "BGR",
                "arcs": [
                    [80, 81, 82, 83, 84, 85]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "The Bahamas"
                },
                "id": "BHS",
                "arcs": [
                    [
                        [86]
                    ],
                    [
                        [87]
                    ],
                    [
                        [88]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Bosnia and Herzegovina"
                },
                "id": "BIH",
                "arcs": [
                    [89, 90, 91]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Belarus"
                },
                "id": "BLR",
                "arcs": [
                    [92, 93, 94, 95, 96]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Belize"
                },
                "id": "BLZ",
                "arcs": [
                    [97, 98, 99]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Bolivia"
                },
                "id": "BOL",
                "arcs": [
                    [100, 101, 102, 103, -31]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Brazil"
                },
                "id": "BRA",
                "arcs": [
                    [-27, 104, -103, 105, 106, 107, 108, 109, 110, 111, 112]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Brunei"
                },
                "id": "BRN",
                "arcs": [
                    [113, 114]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Bhutan"
                },
                "id": "BTN",
                "arcs": [
                    [115, 116]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Botswana"
                },
                "id": "BWA",
                "arcs": [
                    [117, 118, 119, 120]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Central African Republic"
                },
                "id": "CAF",
                "arcs": [
                    [121, 122, 123, 124, 125, 126, 127]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Canada"
                },
                "id": "CAN",
                "arcs": [
                    [
                        [128]
                    ],
                    [
                        [129]
                    ],
                    [
                        [130]
                    ],
                    [
                        [131]
                    ],
                    [
                        [132]
                    ],
                    [
                        [133]
                    ],
                    [
                        [134]
                    ],
                    [
                        [135]
                    ],
                    [
                        [136]
                    ],
                    [
                        [137]
                    ],
                    [
                        [138, 139, 140, 141]
                    ],
                    [
                        [142]
                    ],
                    [
                        [143]
                    ],
                    [
                        [144]
                    ],
                    [
                        [145]
                    ],
                    [
                        [146]
                    ],
                    [
                        [147]
                    ],
                    [
                        [148]
                    ],
                    [
                        [149]
                    ],
                    [
                        [150]
                    ],
                    [
                        [151]
                    ],
                    [
                        [152]
                    ],
                    [
                        [153]
                    ],
                    [
                        [154]
                    ],
                    [
                        [155]
                    ],
                    [
                        [156]
                    ],
                    [
                        [157]
                    ],
                    [
                        [158]
                    ],
                    [
                        [159]
                    ],
                    [
                        [160]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Switzerland"
                },
                "id": "CHE",
                "arcs": [
                    [-51, 161, 162, 163]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Chile"
                },
                "id": "CHL",
                "arcs": [
                    [
                        [-24, 164]
                    ],
                    [
                        [-30, 165, 166, -101]
                    ]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "China"
                },
                "id": "CHN",
                "arcs": [
                    [
                        [167]
                    ],
                    [
                        [168, 169, 170, 171, 172, 173, -117, 174, 175, 176, 177, -4, 178, 179, 180, 181, 182, 183]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ivory Coast"
                },
                "id": "CIV",
                "arcs": [
                    [184, 185, 186, 187, -73, 188]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Cameroon"
                },
                "id": "CMR",
                "arcs": [
                    [189, 190, 191, 192, 193, 194, -128, 195]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Democratic Republic of the Congo"
                },
                "id": "COD",
                "arcs": [
                    [196, 197, -60, 198, 199, -10, 200, -13, 201, -126, 202]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Republic of the Congo"
                },
                "id": "COG",
                "arcs": [
                    [-12, 203, 204, -196, -127, -202]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Colombia"
                },
                "id": "COL",
                "arcs": [
                    [205, 206, 207, 208, 209, -107, 210]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Costa Rica"
                },
                "id": "CRI",
                "arcs": [
                    [211, 212, 213, 214]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Cuba"
                },
                "id": "CUB",
                "arcs": [
                    [215]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Northern Cyprus"
                },
                "id": "-99",
                "arcs": [
                    [216, 217]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Cyprus"
                },
                "id": "CYP",
                "arcs": [
                    [218, -218]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Czech Republic"
                },
                "id": "CZE",
                "arcs": [
                    [-53, 219, 220, 221]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Germany"
                },
                "id": "DEU",
                "arcs": [
                    [222, 223, -220, -52, -164, 224, 225, -64, 226, 227, 228]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Djibouti"
                },
                "id": "DJI",
                "arcs": [
                    [229, 230, 231, 232]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Denmark"
                },
                "id": "DNK",
                "arcs": [
                    [
                        [233]
                    ],
                    [
                        [-229, 234]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Dominican Republic"
                },
                "id": "DOM",
                "arcs": [
                    [235, 236]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Algeria"
                },
                "id": "DZA",
                "arcs": [
                    [237, 238, 239, 240, 241, 242, 243, 244]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ecuador"
                },
                "id": "ECU",
                "arcs": [
                    [245, -206, 246]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Egypt"
                },
                "id": "EGY",
                "arcs": [
                    [247, 248, 249, 250, 251]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Eritrea"
                },
                "id": "ERI",
                "arcs": [
                    [252, 253, 254, -233]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Spain"
                },
                "id": "ESP",
                "arcs": [
                    [255, 256, 257, 258]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Estonia"
                },
                "id": "EST",
                "arcs": [
                    [259, 260, 261]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ethiopia"
                },
                "id": "ETH",
                "arcs": [
                    [-232, 262, 263, 264, 265, 266, 267, -253]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Finland"
                },
                "id": "FIN",
                "arcs": [
                    [268, 269, 270, 271]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Fiji"
                },
                "id": "FJI",
                "arcs": [
                    [
                        [272]
                    ],
                    [
                        [273, 274]
                    ],
                    [
                        [275, -275]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Falkland Islands"
                },
                "id": "FLK",
                "arcs": [
                    [276]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "France"
                },
                "id": "FRA",
                "arcs": [
                    [
                        [277]
                    ],
                    [
                        [278, -225, -163, 279, 280, -257, 281, -66]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "French Guiana"
                },
                "id": "GUF",
                "arcs": [
                    [282, 283, 284, 285, -111]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Gabon"
                },
                "id": "GAB",
                "arcs": [
                    [286, 287, -190, -205]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "United Kingdom"
                },
                "id": "GBR",
                "arcs": [
                    [
                        [288, 289]
                    ],
                    [
                        [290]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Georgia"
                },
                "id": "GEO",
                "arcs": [
                    [291, 292, -58, -32, 293]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ghana"
                },
                "id": "GHA",
                "arcs": [
                    [294, -189, -77, 295]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Guinea"
                },
                "id": "GIN",
                "arcs": [
                    [296, 297, 298, 299, 300, 301, -187]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Gambia"
                },
                "id": "GMB",
                "arcs": [
                    [302, 303]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Guinea Bissau"
                },
                "id": "GNB",
                "arcs": [
                    [304, 305, -300]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Equatorial Guinea"
                },
                "id": "GNQ",
                "arcs": [
                    [306, -191, -288]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Greece"
                },
                "id": "GRC",
                "arcs": [
                    [
                        [307]
                    ],
                    [
                        [308, -15, 309, -84, 310]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Greenland"
                },
                "id": "GRL",
                "arcs": [
                    [311]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Guatemala"
                },
                "id": "GTM",
                "arcs": [
                    [312, 313, -100, 314, 315, 316]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Guyana"
                },
                "id": "GUY",
                "arcs": [
                    [317, 318, -109, 319]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Honduras"
                },
                "id": "HND",
                "arcs": [
                    [320, 321, -316, 322, 323]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Croatia"
                },
                "id": "HRV",
                "arcs": [
                    [324, -92, 325, 326, 327, 328]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Haiti"
                },
                "id": "HTI",
                "arcs": [
                    [-237, 329]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Hungary"
                },
                "id": "HUN",
                "arcs": [
                    [-48, 330, 331, 332, 333, -329, 334]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Indonesia"
                },
                "id": "IDN",
                "arcs": [
                    [
                        [335]
                    ],
                    [
                        [336, 337]
                    ],
                    [
                        [338]
                    ],
                    [
                        [339]
                    ],
                    [
                        [340]
                    ],
                    [
                        [341]
                    ],
                    [
                        [342]
                    ],
                    [
                        [343]
                    ],
                    [
                        [344, 345]
                    ],
                    [
                        [346]
                    ],
                    [
                        [347]
                    ],
                    [
                        [348, 349]
                    ],
                    [
                        [350]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "India"
                },
                "id": "IND",
                "arcs": [
                    [-177, 351, -175, -116, -174, 352, -80, 353, 354]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ireland"
                },
                "id": "IRL",
                "arcs": [
                    [355, -289]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Iran"
                },
                "id": "IRN",
                "arcs": [
                    [356, -6, 357, 358, 359, 360, -55, -34, -57, 361]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Iraq"
                },
                "id": "IRQ",
                "arcs": [
                    [362, 363, 364, 365, 366, 367, -360]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Iceland"
                },
                "id": "ISL",
                "arcs": [
                    [368]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Israel"
                },
                "id": "ISR",
                "arcs": [
                    [369, 370, 371, -252, 372, 373, 374]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Italy"
                },
                "id": "ITA",
                "arcs": [
                    [
                        [375]
                    ],
                    [
                        [376]
                    ],
                    [
                        [377, 378, -280, -162, -50]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Jamaica"
                },
                "id": "JAM",
                "arcs": [
                    [379]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Jordan"
                },
                "id": "JOR",
                "arcs": [
                    [-370, 380, -366, 381, 382, -372, 383]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Japan"
                },
                "id": "JPN",
                "arcs": [
                    [
                        [384]
                    ],
                    [
                        [385]
                    ],
                    [
                        [386]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Kazakhstan"
                },
                "id": "KAZ",
                "arcs": [
                    [387, 388, 389, 390, -181, 391]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Kenya"
                },
                "id": "KEN",
                "arcs": [
                    [392, 393, 394, 395, -265, 396]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Kyrgyzstan"
                },
                "id": "KGZ",
                "arcs": [
                    [-392, -180, 397, 398]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Cambodia"
                },
                "id": "KHM",
                "arcs": [
                    [399, 400, 401, 402]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "South Korea"
                },
                "id": "KOR",
                "arcs": [
                    [403, 404]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Kosovo"
                },
                "id": "-99",
                "arcs": [
                    [-18, 405, 406, 407]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Kuwait"
                },
                "id": "KWT",
                "arcs": [
                    [408, 409, -364]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Laos"
                },
                "id": "LAO",
                "arcs": [
                    [410, 411, -172, 412, -401]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Lebanon"
                },
                "id": "LBN",
                "arcs": [
                    [-374, 413, 414]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Liberia"
                },
                "id": "LBR",
                "arcs": [
                    [415, 416, -297, -186]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Libya"
                },
                "id": "LBY",
                "arcs": [
                    [417, -245, 418, 419, -250, 420, 421]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Sri Lanka"
                },
                "id": "LKA",
                "arcs": [
                    [422]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Lesotho"
                },
                "id": "LSO",
                "arcs": [
                    [423]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Lithuania"
                },
                "id": "LTU",
                "arcs": [
                    [424, 425, 426, -93, 427]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Luxembourg"
                },
                "id": "LUX",
                "arcs": [
                    [-226, -279, -65]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Latvia"
                },
                "id": "LVA",
                "arcs": [
                    [428, -262, 429, -94, -427]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Morocco"
                },
                "id": "MAR",
                "arcs": [
                    [-242, 430, 431]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Moldova"
                },
                "id": "MDA",
                "arcs": [
                    [432, 433]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Madagascar"
                },
                "id": "MDG",
                "arcs": [
                    [434]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Mexico"
                },
                "id": "MEX",
                "arcs": [
                    [435, -98, -314, 436, 437]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Macedonia"
                },
                "id": "MKD",
                "arcs": [
                    [-408, 438, -85, -310, -14]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Mali"
                },
                "id": "MLI",
                "arcs": [
                    [439, -239, 440, -74, -188, -302, 441]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Myanmar"
                },
                "id": "MMR",
                "arcs": [
                    [442, -78, -353, -173, -412, 443]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Montenegro"
                },
                "id": "MNE",
                "arcs": [
                    [444, -326, -91, 445, -406, -17]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Mongolia"
                },
                "id": "MNG",
                "arcs": [
                    [446, -183]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Mozambique"
                },
                "id": "MOZ",
                "arcs": [
                    [447, 448, 449, 450, 451, 452, 453, 454]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Mauritania"
                },
                "id": "MRT",
                "arcs": [
                    [455, 456, 457, -240, -440]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Malawi"
                },
                "id": "MWI",
                "arcs": [
                    [-455, 458, 459]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Malaysia"
                },
                "id": "MYS",
                "arcs": [
                    [
                        [460, 461]
                    ],
                    [
                        [-349, 462, -115, 463]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Namibia"
                },
                "id": "NAM",
                "arcs": [
                    [464, -8, 465, -119, 466]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "New Caledonia"
                },
                "id": "NCL",
                "arcs": [
                    [467]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Niger"
                },
                "id": "NER",
                "arcs": [
                    [-75, -441, -238, -418, 468, -194, 469, -71]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Nigeria"
                },
                "id": "NGA",
                "arcs": [
                    [470, -72, -470, -193]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Nicaragua"
                },
                "id": "NIC",
                "arcs": [
                    [471, -324, 472, -213]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Netherlands"
                },
                "id": "NLD",
                "arcs": [
                    [-227, -63, 473]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Norway"
                },
                "id": "NOR",
                "arcs": [
                    [
                        [474, -272, 475, 476]
                    ],
                    [
                        [477]
                    ],
                    [
                        [478]
                    ],
                    [
                        [479]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Nepal"
                },
                "id": "NPL",
                "arcs": [
                    [-352, -176]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "New Zealand"
                },
                "id": "NZL",
                "arcs": [
                    [
                        [480]
                    ],
                    [
                        [481]
                    ]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Oman"
                },
                "id": "OMN",
                "arcs": [
                    [
                        [482, 483, -22, 484]
                    ],
                    [
                        [-20, 485]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Pakistan"
                },
                "id": "PAK",
                "arcs": [
                    [-178, -355, 486, -358, -5]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Panama"
                },
                "id": "PAN",
                "arcs": [
                    [487, -215, 488, -208]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Peru"
                },
                "id": "PER",
                "arcs": [
                    [-167, 489, -247, -211, -106, -102]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Philippines"
                },
                "id": "PHL",
                "arcs": [
                    [
                        [490]
                    ],
                    [
                        [491]
                    ],
                    [
                        [492]
                    ],
                    [
                        [493]
                    ],
                    [
                        [494]
                    ],
                    [
                        [495]
                    ],
                    [
                        [496]
                    ]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Papua New Guinea"
                },
                "id": "PNG",
                "arcs": [
                    [
                        [497]
                    ],
                    [
                        [498]
                    ],
                    [
                        [-345, 499]
                    ],
                    [
                        [500]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Poland"
                },
                "id": "POL",
                "arcs": [
                    [-224, 501, 502, -428, -97, 503, 504, -221]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Puerto Rico"
                },
                "id": "PRI",
                "arcs": [
                    [505]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "North Korea"
                },
                "id": "PRK",
                "arcs": [
                    [506, 507, -405, 508, -169]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Portugal"
                },
                "id": "PRT",
                "arcs": [
                    [-259, 509]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Paraguay"
                },
                "id": "PRY",
                "arcs": [
                    [-104, -105, -26]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Qatar"
                },
                "id": "QAT",
                "arcs": [
                    [510, 511]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Romania"
                },
                "id": "ROU",
                "arcs": [
                    [512, -434, 513, 514, -81, 515, -333]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Russia"
                },
                "id": "RUS",
                "arcs": [
                    [
                        [516]
                    ],
                    [
                        [-503, 517, -425]
                    ],
                    [
                        [518, 519]
                    ],
                    [
                        [520]
                    ],
                    [
                        [521]
                    ],
                    [
                        [522]
                    ],
                    [
                        [523]
                    ],
                    [
                        [524]
                    ],
                    [
                        [525]
                    ],
                    [
                        [526, -507, -184, -447, -182, -391, 527, -59, -293, 528, 529, -95, -430, -261, 530, -269, -475, 531, -520]
                    ],
                    [
                        [532]
                    ],
                    [
                        [533]
                    ],
                    [
                        [534]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Rwanda"
                },
                "id": "RWA",
                "arcs": [
                    [535, -61, -198, 536]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Western Sahara"
                },
                "id": "ESH",
                "arcs": [
                    [-241, -458, 537, -431]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Saudi Arabia"
                },
                "id": "SAU",
                "arcs": [
                    [538, -382, -365, -410, 539, -512, 540, -23, -484, 541]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Sudan"
                },
                "id": "SDN",
                "arcs": [
                    [542, 543, -123, 544, -421, -249, 545, -254, -268, 546]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "South Sudan"
                },
                "id": "SSD",
                "arcs": [
                    [547, -266, -396, 548, -203, -125, 549, -543]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Senegal"
                },
                "id": "SEN",
                "arcs": [
                    [550, -456, -442, -301, -306, 551, -304]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Solomon Islands"
                },
                "id": "SLB",
                "arcs": [
                    [
                        [552]
                    ],
                    [
                        [553]
                    ],
                    [
                        [554]
                    ],
                    [
                        [555]
                    ],
                    [
                        [556]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Sierra Leone"
                },
                "id": "SLE",
                "arcs": [
                    [557, -298, -417]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "El Salvador"
                },
                "id": "SLV",
                "arcs": [
                    [558, -317, -322]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Somaliland"
                },
                "id": "-99",
                "arcs": [
                    [-263, -231, 559, 560]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Somalia"
                },
                "id": "SOM",
                "arcs": [
                    [-397, -264, -561, 561]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Republic of Serbia"
                },
                "id": "SRB",
                "arcs": [
                    [-86, -439, -407, -446, -90, -325, -334, -516]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Suriname"
                },
                "id": "SUR",
                "arcs": [
                    [562, -285, 563, -283, -110, -319]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Slovakia"
                },
                "id": "SVK",
                "arcs": [
                    [-505, 564, -331, -54, -222]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Slovenia"
                },
                "id": "SVN",
                "arcs": [
                    [-49, -335, -328, 565, -378]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Sweden"
                },
                "id": "SWE",
                "arcs": [
                    [-476, -271, 566]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Swaziland"
                },
                "id": "SWZ",
                "arcs": [
                    [567, -451]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Syria"
                },
                "id": "SYR",
                "arcs": [
                    [-381, -375, -415, 568, 569, -367]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Chad"
                },
                "id": "TCD",
                "arcs": [
                    [-469, -422, -545, -122, -195]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Togo"
                },
                "id": "TGO",
                "arcs": [
                    [570, -296, -76, -69]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Thailand"
                },
                "id": "THA",
                "arcs": [
                    [571, -462, 572, -444, -411, -400]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Tajikistan"
                },
                "id": "TJK",
                "arcs": [
                    [-398, -179, -3, 573]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Turkmenistan"
                },
                "id": "TKM",
                "arcs": [
                    [-357, 574, -389, 575, -1]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "East Timor"
                },
                "id": "TLS",
                "arcs": [
                    [576, -337]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Trinidad and Tobago"
                },
                "id": "TTO",
                "arcs": [
                    [577]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Tunisia"
                },
                "id": "TUN",
                "arcs": [
                    [-244, 578, -419]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Turkey"
                },
                "id": "TUR",
                "arcs": [
                    [
                        [-294, -36, -361, -368, -570, 579]
                    ],
                    [
                        [-311, -83, 580]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Taiwan"
                },
                "id": "TWN",
                "arcs": [
                    [581]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "United Republic of Tanzania"
                },
                "id": "TZA",
                "arcs": [
                    [-394, 582, -448, -460, 583, -199, -62, -536, 584]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Uganda"
                },
                "id": "UGA",
                "arcs": [
                    [-537, -197, -549, -395, -585]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Ukraine"
                },
                "id": "UKR",
                "arcs": [
                    [-530, 585, -514, -433, -513, -332, -565, -504, -96]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Uruguay"
                },
                "id": "URY",
                "arcs": [
                    [-113, 586, -28]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "United States of America"
                },
                "id": "USA",
                "arcs": [
                    [
                        [587]
                    ],
                    [
                        [588]
                    ],
                    [
                        [589]
                    ],
                    [
                        [590]
                    ],
                    [
                        [591]
                    ],
                    [
                        [592, -438, 593, -139]
                    ],
                    [
                        [594]
                    ],
                    [
                        [595]
                    ],
                    [
                        [596]
                    ],
                    [
                        [-141, 597]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Uzbekistan"
                },
                "id": "UZB",
                "arcs": [
                    [-576, -388, -399, -574, -2]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Venezuela"
                },
                "id": "VEN",
                "arcs": [
                    [598, -320, -108, -210]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Vietnam"
                },
                "id": "VNM",
                "arcs": [
                    [599, -402, -413, -171]
                ]
            }, {
                "type": "MultiPolygon",
                "properties": {
                    "name": "Vanuatu"
                },
                "id": "VUT",
                "arcs": [
                    [
                        [600]
                    ],
                    [
                        [601]
                    ]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "West Bank"
                },
                "id": "PSE",
                "arcs": [
                    [-384, -371]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Yemen"
                },
                "id": "YEM",
                "arcs": [
                    [602, -542, -483]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "South Africa"
                },
                "id": "ZAF",
                "arcs": [
                    [-467, -118, 603, -452, -568, -450, 604],
                    [-424]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Zambia"
                },
                "id": "ZMB",
                "arcs": [
                    [-459, -454, 605, -120, -466, -7, -200, -584]
                ]
            }, {
                "type": "Polygon",
                "properties": {
                    "name": "Zimbabwe"
                },
                "id": "ZWE",
                "arcs": [
                    [-604, -121, -606, -453]
                ]
            }]
        }
    },
    "arcs": [
        [
            [6700, 7164],
            [28, -23],
            [21, 8],
            [6, 27],
            [22, 9],
            [15, 18],
            [6, 47],
            [23, 11],
            [5, 21],
            [13, -15],
            [8, -2]
        ],
        [
            [6847, 7265],
            [16, -1],
            [20, -12]
        ],
        [
            [6883, 7252],
            [9, -7],
            [20, 19],
            [9, -12],
            [9, 27],
            [17, -1],
            [4, 9],
            [3, 24],
            [12, 20],
            [15, -13],
            [-3, -18],
            [9, -3],
            [-3, -50],
            [11, -19],
            [10, 12],
            [12, 6],
            [17, 27],
            [19, -5],
            [29, 0]
        ],
        [
            [7082, 7268],
            [5, -17]
        ],
        [
            [7087, 7251],
            [-16, -6],
            [-14, -11],
            [-32, -7],
            [-30, -13],
            [-16, -25],
            [6, -25],
            [4, -30],
            [-14, -25],
            [1, -22],
            [-8, -22],
            [-26, 2],
            [11, -39],
            [-18, -15],
            [-12, -35],
            [2, -36],
            [-11, -16],
            [-10, 5],
            [-22, -8],
            [-3, -16],
            [-20, 0],
            [-16, -34],
            [-1, -50],
            [-36, -24],
            [-19, 5],
            [-6, -13],
            [-16, 7],
            [-28, -8],
            [-47, 30]
        ],
        [
            [6690, 6820],
            [25, 53],
            [-2, 38],
            [-21, 10],
            [-2, 38],
            [-9, 47],
            [12, 32],
            [-12, 9],
            [7, 43],
            [12, 74]
        ],
        [
            [5664, 4412],
            [3, -18],
            [-4, -29],
            [5, -28],
            [-4, -22],
            [3, -20],
            [-58, 1],
            [-2, -188],
            [19, -49],
            [18, -37]
        ],
        [
            [5644, 4022],
            [-51, -24],
            [-67, 9],
            [-19, 28],
            [-113, -3],
            [-4, -4],
            [-17, 27],
            [-18, 2],
            [-16, -10],
            [-14, -12]
        ],
        [
            [5325, 4035],
            [-2, 38],
            [4, 51],
            [9, 55],
            [2, 25],
            [9, 53],
            [6, 24],
            [16, 39],
            [9, 26],
            [3, 44],
            [-1, 34],
            [-9, 21],
            [-7, 36],
            [-7, 35],
            [2, 12],
            [8, 24],
            [-8, 57],
            [-6, 39],
            [-14, 38],
            [3, 11]
        ],
        [
            [5342, 4697],
            [11, 8],
            [8, -1],
            [10, 7],
            [82, -1],
            [7, -44],
            [8, -35],
            [6, -19],
            [11, -31],
            [18, 5],
            [9, 8],
            [16, -8],
            [4, 14],
            [7, 35],
            [17, 2],
            [2, 10],
            [14, 1],
            [-3, -22],
            [34, 1],
            [1, -37],
            [5, -23],
            [-4, -36],
            [2, -36],
            [9, -22],
            [-1, -70],
            [7, 5],
            [12, -1],
            [17, 8],
            [13, -3]
        ],
        [
            [5338, 4715],
            [-8, 45]
        ],
        [
            [5330, 4760],
            [12, 25],
            [8, 10],
            [10, -20]
        ],
        [
            [5360, 4775],
            [-10, -12],
            [-4, -16],
            [-1, -25],
            [-7, -7]
        ],
        [
            [5571, 7530],
            [-3, -20],
            [4, -25],
            [11, -15]
        ],
        [
            [5583, 7470],
            [0, -15],
            [-9, -9],
            [-2, -19],
            [-13, -29]
        ],
        [
            [5559, 7398],
            [-5, 5],
            [0, 13],
            [-15, 19],
            [-3, 29],
            [2, 40],
            [4, 18],
            [-4, 10]
        ],
        [
            [5538, 7532],
            [-2, 18],
            [12, 29],
            [1, -11],
            [8, 6]
        ],
        [
            [5557, 7574],
            [6, -16],
            [7, -6],
            [1, -22]
        ],
        [
            [6432, 6490],
            [5, 3],
            [1, -16],
            [22, 9],
            [23, -2],
            [17, -1],
            [19, 39],
            [20, 38],
            [18, 37]
        ],
        [
            [6557, 6597],
            [5, -20]
        ],
        [
            [6562, 6577],
            [4, -47]
        ],
        [
            [6566, 6530],
            [-14, 0],
            [-3, -39],
            [5, -8],
            [-12, -12],
            [0, -24],
            [-8, -24],
            [-1, -24]
        ],
        [
            [6533, 6399],
            [-6, -12],
            [-83, 29],
            [-11, 60],
            [-1, 14]
        ],
        [
            [3140, 1814],
            [-17, 2],
            [-30, 0],
            [0, 132]
        ],
        [
            [3093, 1948],
            [11, -27],
            [14, -45],
            [36, -35],
            [39, -15],
            [-13, -30],
            [-26, -2],
            [-14, 20]
        ],
        [
            [3258, 3743],
            [51, -96],
            [23, -9],
            [34, -44],
            [29, -23],
            [4, -26],
            [-28, -90],
            [28, -16],
            [32, -9],
            [22, 10],
            [25, 45],
            [4, 52]
        ],
        [
            [3482, 3537],
            [14, 11],
            [14, -34],
            [-1, -47],
            [-23, -33],
            [-19, -24],
            [-31, -57],
            [-37, -81]
        ],
        [
            [3399, 3272],
            [-7, -47],
            [-7, -61],
            [0, -58],
            [-6, -14],
            [-2, -38]
        ],
        [
            [3377, 3054],
            [-2, -31],
            [35, -50],
            [-4, -41],
            [18, -26],
            [-2, -29],
            [-26, -75],
            [-42, -32],
            [-55, -12],
            [-31, 6],
            [6, -36],
            [-6, -44],
            [5, -30],
            [-16, -20],
            [-29, -8],
            [-26, 21],
            [-11, -15],
            [4, -59],
            [18, -18],
            [16, 19],
            [8, -31],
            [-26, -18],
            [-22, -37],
            [-4, -59],
            [-7, -32],
            [-26, 0],
            [-22, -31],
            [-8, -44],
            [28, -43],
            [26, -12],
            [-9, -53],
            [-33, -33],
            [-18, -70],
            [-25, -23],
            [-12, -28],
            [9, -61],
            [19, -34],
            [-12, 3]
        ],
        [
            [3095, 1968],
            [-26, 9],
            [-67, 8],
            [-11, 34],
            [0, 45],
            [-18, -4],
            [-10, 21],
            [-3, 63],
            [22, 26],
            [9, 37],
            [-4, 30],
            [15, 51],
            [10, 78],
            [-3, 35],
            [12, 11],
            [-3, 22],
            [-13, 12],
            [10, 25],
            [-13, 22],
            [-6, 68],
            [11, 12],
            [-5, 72],
            [7, 61],
            [7, 52],
            [17, 22],
            [-9, 58],
            [0, 54],
            [21, 38],
            [-1, 50],
            [16, 57],
            [0, 55],
            [-7, 11],
            [-13, 102],
            [17, 60],
            [-2, 58],
            [10, 53],
            [18, 56],
            [20, 36],
            [-9, 24],
            [6, 19],
            [-1, 98],
            [30, 29],
            [10, 62],
            [-3, 14]
        ],
        [
            [3136, 3714],
            [23, 54],
            [36, -15],
            [16, -42],
            [11, 47],
            [32, -2],
            [4, -13]
        ],
        [
            [6210, 7485],
            [39, 9]
        ],
        [
            [6249, 7494],
            [5, -15],
            [11, -10],
            [-6, -15],
            [15, -21],
            [-8, -18],
            [12, -16],
            [13, -10],
            [0, -41]
        ],
        [
            [6291, 7348],
            [-10, -2]
        ],
        [
            [6281, 7346],
            [-11, 34],
            [0, 10],
            [-12, -1],
            [-9, 16],
            [-5, -1]
        ],
        [
            [6244, 7404],
            [-11, 17],
            [-21, 15],
            [3, 28],
            [-5, 21]
        ],
        [
            [3345, 329],
            [-8, -30],
            [-8, -27],
            [-59, 8],
            [-62, -3],
            [-34, 20],
            [0, 2],
            [-16, 17],
            [63, -2],
            [60, -6],
            [20, 24],
            [15, 21],
            [29, -24]
        ],
        [
            [577, 361],
            [-53, -8],
            [-36, 21],
            [-17, 21],
            [-1, 3],
            [-18, 16],
            [17, 22],
            [52, -9],
            [28, -18],
            [21, -21],
            [7, -27]
        ],
        [
            [3745, 447],
            [35, -26],
            [12, -36],
            [3, -25],
            [1, -30],
            [-43, -19],
            [-45, -15],
            [-52, -14],
            [-59, -11],
            [-65, 3],
            [-37, 20],
            [5, 24],
            [59, 16],
            [24, 20],
            [18, 26],
            [12, 22],
            [17, 20],
            [18, 25],
            [14, 0],
            [41, 12],
            [42, -12]
        ],
        [
            [1633, 715],
            [36, -9],
            [33, 10],
            [-16, -20],
            [-26, -15],
            [-39, 4],
            [-27, 21],
            [6, 20],
            [33, -11]
        ],
        [
            [1512, 716],
            [43, -23],
            [-17, 3],
            [-36, 5],
            [-38, 17],
            [20, 12],
            [28, -14]
        ],
        [
            [2250, 808],
            [31, -8],
            [30, 7],
            [17, -34],
            [-22, 5],
            [-34, -2],
            [-34, 2],
            [-38, -4],
            [-28, 12],
            [-15, 24],
            [18, 11],
            [35, -8],
            [40, -5]
        ],
        [
            [3098, 866],
            [4, -27],
            [-5, -23],
            [-8, -22],
            [-33, -8],
            [-31, -12],
            [-36, 1],
            [14, 24],
            [-33, -9],
            [-31, -8],
            [-21, 18],
            [-2, 24],
            [30, 23],
            [20, 7],
            [32, -2],
            [8, 30],
            [1, 22],
            [0, 47],
            [16, 28],
            [25, 9],
            [15, -22],
            [6, -22],
            [12, -26],
            [10, -26],
            [7, -26]
        ],
        [
            [3371, 1268],
            [-11, -13],
            [-21, 9],
            [-23, -6],
            [-19, -14],
            [-20, -15],
            [-14, -17],
            [-4, -23],
            [2, -22],
            [13, -20],
            [-19, -14],
            [-26, -4],
            [-15, -20],
            [-17, -19],
            [-17, -25],
            [-4, -22],
            [9, -24],
            [15, -19],
            [23, -14],
            [21, -18],
            [12, -23],
            [6, -22],
            [8, -24],
            [13, -19],
            [8, -22],
            [4, -55],
            [8, -22],
            [2, -23],
            [9, -23],
            [-4, -31],
            [-15, -24],
            [-17, -20],
            [-37, -8],
            [-12, -21],
            [-17, -20],
            [-42, -22],
            [-37, -9],
            [-35, -13],
            [-37, -13],
            [-22, -24],
            [-45, -2],
            [-49, 2],
            [-44, -4],
            [-47, 0],
            [9, -24],
            [42, -10],
            [31, -16],
            [18, -21],
            [-31, -19],
            [-48, 6],
            [-40, -15],
            [-2, -24],
            [-1, -23],
            [33, -20],
            [6, -22],
            [35, -22],
            [59, -9],
            [50, -16],
            [40, -19],
            [50, -18],
            [70, -10],
            [68, -16],
            [47, -17],
            [52, -20],
            [27, -28],
            [13, -22],
            [34, 21],
            [46, 17],
            [48, 19],
            [58, 15],
            [49, 16],
            [69, 1],
            [68, -8],
            [56, -14],
            [18, 26],
            [39, 17],
            [70, 1],
            [55, 13],
            [52, 13],
            [58, 8],
            [62, 10],
            [43, 15],
            [-20, 21],
            [-12, 21],
            [0, 22],
            [-54, -2],
            [-57, -10],
            [-54, 0],
            [-8, 22],
            [4, 44],
            [12, 13],
            [40, 14],
            [47, 14],
            [34, 17],
            [33, 18],
            [25, 23],
            [38, 10],
            [38, 8],
            [19, 5],
            [43, 2],
            [41, 8],
            [34, 12],
            [34, 14],
            [30, 14],
            [39, 18],
            [24, 20],
            [26, 17],
            [9, 24],
            [-30, 13],
            [10, 25],
            [18, 18],
            [29, 12],
            [31, 14],
            [28, 18],
            [22, 23],
            [13, 28],
            [21, 16],
            [33, -3],
            [13, -20],
            [34, -2],
            [1, 22],
            [14, 23],
            [30, -6],
            [7, -22],
            [33, -3],
            [36, 10],
            [35, 7],
            [31, -3],
            [12, -25],
            [31, 20],
            [28, 10],
            [31, 9],
            [31, 8],
            [29, 14],
            [31, 9],
            [24, 13],
            [17, 20],
            [20, -15],
            [29, 8],
            [20, -27],
            [16, -21],
            [32, 11],
            [12, 24],
            [28, 16],
            [37, -4],
            [11, -22],
            [22, 22],
            [30, 7],
            [33, 3],
            [29, -2],
            [31, -7],
            [30, -3],
            [13, -20],
            [18, -17],
            [31, 10],
            [32, 3],
            [32, 0],
            [31, 1],
            [28, 8],
            [29, 7],
            [25, 16],
            [26, 11],
            [28, 5],
            [21, 17],
            [15, 32],
            [16, 20],
            [29, -10],
            [11, -21],
            [24, -13],
            [29, 4],
            [19, -21],
            [21, -15],
            [28, 14],
            [10, 26],
            [25, 10],
            [29, 20],
            [27, 8],
            [33, 11],
            [22, 13],
            [22, 14],
            [22, 13],
            [26, -7],
            [25, 21],
            [18, 16],
            [26, -1],
            [23, 14],
            [6, 21],
            [23, 16],
            [23, 11],
            [28, 10],
            [25, 4],
            [25, -3],
            [26, -6],
            [22, -16],
            [3, -26],
            [24, -19],
            [17, -17],
            [33, -7],
            [19, -16],
            [23, -16],
            [26, -3],
            [23, 11],
            [24, 24],
            [26, -12],
            [27, -7],
            [26, -7],
            [27, -5],
            [28, 0],
            [23, -61],
            [-1, -15],
            [-4, -27],
            [-26, -15],
            [-22, -22],
            [4, -23],
            [31, 1],
            [-4, -23],
            [-14, -22],
            [-13, -24],
            [21, -19],
            [32, -6],
            [32, 11],
            [15, 23],
            [10, 22],
            [15, 18],
            [17, 18],
            [7, 21],
            [15, 29],
            [18, 5],
            [31, 3],
            [28, 7],
            [28, 9],
            [14, 23],
            [8, 22],
            [19, 22],
            [27, 15],
            [23, 12],
            [16, 19],
            [15, 11],
            [21, 9],
            [27, -6],
            [25, 6],
            [28, 7],
            [30, -4],
            [20, 17],
            [14, 39],
            [11, -16],
            [13, -28],
            [23, -12],
            [27, -4],
            [26, 7],
            [29, -5],
            [26, -1],
            [17, 6],
            [24, -4],
            [21, -12],
            [25, 8],
            [30, 0],
            [25, 8],
            [29, -8],
            [19, 19],
            [14, 20],
            [19, 16],
            [35, 44],
            [18, -8],
            [21, -16],
            [18, -21],
            [36, -36],
            [27, -1],
            [25, 0],
            [30, 7],
            [30, 8],
            [23, 16],
            [19, 18],
            [31, 2],
            [21, 13],
            [22, -12],
            [14, -18],
            [19, -19],
            [31, 2],
            [19, -15],
            [33, -15],
            [35, -5],
            [29, 4],
            [21, 19],
            [19, 18],
            [25, 5],
            [25, -8],
            [29, -6],
            [26, 9],
            [25, 0],
            [24, -6],
            [26, -5],
            [25, 10],
            [30, 9],
            [28, 3],
            [32, 0],
            [25, 5],
            [25, 5],
            [8, 29],
            [1, 24],
            [17, -16],
            [5, -27],
            [10, -24],
            [11, -20],
            [23, -10],
            [32, 4],
            [36, 1],
            [25, 3],
            [37, 0],
            [26, 1],
            [36, -2],
            [31, -5],
            [20, -18],
            [-5, -22],
            [18, -18],
            [30, -13],
            [31, -15],
            [35, -11],
            [38, -9],
            [28, -9],
            [32, -2],
            [18, 20],
            [24, -16],
            [21, -19],
            [25, -13],
            [34, -6],
            [32, -7],
            [13, -23],
            [32, -14],
            [21, -21],
            [31, -9],
            [32, 1],
            [30, -4],
            [33, 1],
            [34, -4],
            [31, -8],
            [28, -14],
            [29, -12],
            [20, -17],
            [-3, -23],
            [-15, -21],
            [-13, -27],
            [-9, -21],
            [-14, -24],
            [-36, -9],
            [-16, -21],
            [-36, -13],
            [-13, -23],
            [-19, -22],
            [-20, -18],
            [-11, -25],
            [-7, -22],
            [-3, -26],
            [0, -22],
            [16, -23],
            [6, -22],
            [13, -21],
            [52, -8],
            [11, -26],
            [-50, -9],
            [-43, -13],
            [-52, -2],
            [-24, -34],
            [-5, -27],
            [-12, -22],
            [-14, -22],
            [37, -20],
            [14, -24],
            [24, -22],
            [33, -20],
            [39, -19],
            [42, -18],
            [64, -19],
            [14, -29],
            [80, -12],
            [5, -5],
            [21, -17],
            [77, 15],
            [63, -19],
            [48, -14],
            [-9997, -1],
            [24, 35],
            [50, -19],
            [3, 2],
            [30, 19],
            [4, 0],
            [3, -1],
            [40, -25],
            [35, 25],
            [7, 3],
            [81, 11],
            [27, -14],
            [13, -7],
            [41, -20],
            [79, -15],
            [63, -18],
            [107, -14],
            [80, 16],
            [118, -11],
            [67, -19],
            [73, 17],
            [78, 17],
            [6, 27],
            [-110, 3],
            [-89, 14],
            [-24, 23],
            [-74, 12],
            [5, 27],
            [10, 24],
            [10, 22],
            [-5, 25],
            [-46, 16],
            [-22, 21],
            [-43, 18],
            [68, -3],
            [64, 9],
            [40, -20],
            [50, 18],
            [45, 22],
            [23, 19],
            [-10, 25],
            [-36, 16],
            [-41, 17],
            [-57, 4],
            [-50, 8],
            [-54, 6],
            [-18, 22],
            [-36, 18],
            [-21, 21],
            [-9, 67],
            [14, -6],
            [25, -18],
            [45, 6],
            [44, 8],
            [23, -26],
            [44, 6],
            [37, 13],
            [35, 16],
            [32, 20],
            [41, 5],
            [-1, 22],
            [-9, 22],
            [8, 21],
            [36, 11],
            [16, -20],
            [42, 12],
            [32, 15],
            [40, 1],
            [38, 6],
            [37, 13],
            [30, 13],
            [34, 13],
            [22, -4],
            [19, -4],
            [41, 8],
            [37, -10],
            [38, 1],
            [37, 8],
            [37, -6],
            [41, -6],
            [39, 3],
            [40, -2],
            [42, -1],
            [38, 3],
            [28, 17],
            [34, 9],
            [35, -13],
            [33, 11],
            [30, 21],
            [18, -19],
            [9, -21],
            [18, -19],
            [29, 17],
            [33, -22],
            [38, -7],
            [32, -16],
            [39, 3],
            [36, 11],
            [41, -3],
            [38, -8],
            [38, -10],
            [15, 25],
            [-18, 20],
            [-14, 21],
            [-36, 5],
            [-15, 22],
            [-6, 22],
            [-10, 43],
            [21, -8],
            [36, -3],
            [36, 3],
            [33, -9],
            [28, -17],
            [12, -21],
            [38, -4],
            [36, 9],
            [38, 11],
            [34, 7],
            [28, -14],
            [37, 5],
            [24, 45],
            [23, -27],
            [32, -10],
            [34, 6],
            [23, -23],
            [37, -3],
            [33, -7],
            [34, -12],
            [21, 22],
            [11, 20],
            [28, -23],
            [38, 6],
            [28, -13],
            [19, -19],
            [37, 5],
            [29, 13],
            [29, 15],
            [33, 8],
            [39, 7],
            [36, 8],
            [27, 13],
            [16, 19],
            [7, 25],
            [-3, 24],
            [-9, 24],
            [-10, 23],
            [-9, 23],
            [-7, 21],
            [-1, 23],
            [2, 23],
            [13, 22],
            [11, 24],
            [5, 23],
            [-6, 26],
            [-3, 23],
            [14, 27],
            [15, 17],
            [18, 22],
            [19, 19],
            [22, 17],
            [11, 25],
            [15, 17],
            [18, 15],
            [26, 3],
            [18, 19],
            [19, 11],
            [23, 7],
            [20, 15],
            [16, 19],
            [22, 7],
            [16, -15],
            [-10, -20],
            [-29, -17]
        ],
        [
            [6914, 2185],
            [18, -19],
            [26, -7],
            [1, -11],
            [-7, -27],
            [-43, -4],
            [-1, 31],
            [4, 25],
            [2, 12]
        ],
        [
            [9038, 2648],
            [27, -21],
            [15, 8],
            [22, 12],
            [16, -4],
            [2, -70],
            [-9, -21],
            [-3, -47],
            [-10, 16],
            [-19, -41],
            [-6, 3],
            [-17, 2],
            [-17, 50],
            [-4, 39],
            [-16, 52],
            [1, 27],
            [18, -5]
        ],
        [
            [8987, 4244],
            [10, -46],
            [18, 22],
            [9, -25],
            [13, -23],
            [-3, -26],
            [6, -51],
            [5, -29],
            [7, -7],
            [7, -51],
            [-3, -30],
            [9, -40],
            [31, -31],
            [19, -28],
            [19, -26],
            [-4, -14],
            [16, -37],
            [11, -64],
            [11, 13],
            [11, -26],
            [7, 9],
            [5, -63],
            [19, -36],
            [13, -22],
            [22, -48],
            [8, -48],
            [1, -33],
            [-2, -37],
            [13, -50],
            [-2, -52],
            [-5, -28],
            [-7, -52],
            [1, -34],
            [-6, -43],
            [-12, -53],
            [-21, -29],
            [-10, -46],
            [-9, -29],
            [-8, -51],
            [-11, -30],
            [-7, -44],
            [-4, -41],
            [2, -18],
            [-16, -21],
            [-31, -2],
            [-26, -24],
            [-13, -23],
            [-17, -26],
            [-23, 27],
            [-17, 10],
            [5, 31],
            [-15, -11],
            [-25, -43],
            [-24, 16],
            [-15, 9],
            [-16, 4],
            [-27, 17],
            [-18, 37],
            [-5, 45],
            [-7, 30],
            [-13, 24],
            [-27, 7],
            [9, 28],
            [-7, 44],
            [-13, -41],
            [-25, -11],
            [14, 33],
            [5, 34],
            [10, 29],
            [-2, 44],
            [-22, -50],
            [-18, -21],
            [-10, -47],
            [-22, 25],
            [1, 31],
            [-18, 43],
            [-14, 22],
            [5, 14],
            [-36, 35],
            [-19, 2],
            [-27, 29],
            [-50, -6],
            [-36, -21],
            [-31, -20],
            [-27, 4],
            [-29, -30],
            [-24, -14],
            [-6, -31],
            [-10, -24],
            [-23, -1],
            [-18, -5],
            [-24, 10],
            [-20, -6],
            [-19, -3],
            [-17, -31],
            [-8, 2],
            [-14, -16],
            [-13, -19],
            [-21, 2],
            [-18, 0],
            [-30, 38],
            [-15, 11],
            [1, 34],
            [14, 8],
            [4, 14],
            [-1, 21],
            [4, 41],
            [-3, 35],
            [-15, 60],
            [-4, 33],
            [1, 34],
            [-11, 38],
            [-1, 18],
            [-12, 23],
            [-4, 47],
            [-16, 46],
            [-4, 26],
            [13, -26],
            [-10, 55],
            [14, -17],
            [8, -23],
            [0, 30],
            [-14, 47],
            [-3, 18],
            [-6, 18],
            [3, 34],
            [6, 15],
            [4, 29],
            [-3, 35],
            [11, 42],
            [2, -45],
            [12, 41],
            [22, 20],
            [14, 25],
            [21, 22],
            [13, 4],
            [7, -7],
            [22, 22],
            [17, 6],
            [4, 13],
            [8, 6],
            [15, -2],
            [29, 18],
            [15, 26],
            [7, 31],
            [17, 30],
            [1, 24],
            [1, 32],
            [19, 50],
            [12, -51],
            [12, 12],
            [-10, 28],
            [9, 29],
            [12, -13],
            [3, 45],
            [15, 29],
            [7, 23],
            [14, 10],
            [0, 17],
            [13, -7],
            [0, 15],
            [12, 8],
            [14, 8],
            [20, -27],
            [16, -35],
            [17, 0],
            [18, -6],
            [-6, 33],
            [13, 47],
            [13, 15],
            [-5, 15],
            [12, 34],
            [17, 21],
            [14, -7],
            [24, 11],
            [-1, 30],
            [-20, 19],
            [15, 9],
            [18, -15],
            [15, -24],
            [23, -15],
            [8, 6],
            [17, -18],
            [17, 17],
            [10, -5],
            [7, 11],
            [12, -29],
            [-7, -32],
            [-11, -24],
            [-9, -2],
            [3, -23],
            [-8, -30],
            [-10, -29],
            [2, -17],
            [22, -32],
            [21, -19],
            [15, -20],
            [20, -35],
            [8, 0],
            [14, -15],
            [4, -19],
            [27, -20],
            [18, 20],
            [6, 32],
            [5, 26],
            [4, 33],
            [8, 47],
            [-4, 28],
            [2, 17],
            [-3, 34],
            [4, 45],
            [5, 12],
            [-4, 20],
            [7, 31],
            [5, 32],
            [1, 17],
            [10, 22],
            [8, -29],
            [2, -37],
            [7, -7],
            [1, -25],
            [10, -30],
            [2, -33],
            [-1, -22]
        ],
        [
            [5471, 7900],
            [-2, -24],
            [-16, 0],
            [6, -13],
            [-9, -38]
        ],
        [
            [5450, 7825],
            [-6, -10],
            [-24, -1],
            [-14, -13],
            [-23, 4]
        ],
        [
            [5383, 7805],
            [-40, 15],
            [-6, 21],
            [-27, -10],
            [-4, -12],
            [-16, 9]
        ],
        [
            [5290, 7828],
            [-15, 1],
            [-12, 11],
            [4, 15],
            [-1, 10]
        ],
        [
            [5266, 7865],
            [8, 3],
            [14, -16],
            [4, 16],
            [25, -3],
            [20, 11],
            [13, -2],
            [9, -12],
            [2, 10],
            [-4, 38],
            [10, 8],
            [10, 27]
        ],
        [
            [5377, 7945],
            [21, -19],
            [15, 24],
            [10, 5],
            [22, -18],
            [13, 3],
            [13, -12]
        ],
        [
            [5471, 7928],
            [-3, -7],
            [3, -21]
        ],
        [
            [6281, 7346],
            [-19, 8],
            [-14, 27],
            [-4, 23]
        ],
        [
            [6349, 7527],
            [15, -31],
            [14, -42],
            [13, -2],
            [8, -16],
            [-23, -5],
            [-5, -46],
            [-4, -21],
            [-11, -13],
            [1, -30]
        ],
        [
            [6357, 7321],
            [-7, -3],
            [-17, 31],
            [10, 30],
            [-9, 17],
            [-10, -4],
            [-33, -44]
        ],
        [
            [6249, 7494],
            [6, 10],
            [21, -17],
            [15, -4],
            [4, 7],
            [-14, 32],
            [7, 9]
        ],
        [
            [6288, 7531],
            [8, -2],
            [19, -36],
            [13, -4],
            [4, 15],
            [17, 23]
        ],
        [
            [5814, 4792],
            [-1, 71],
            [-7, 27]
        ],
        [
            [5806, 4890],
            [17, -5],
            [8, 34],
            [15, -4]
        ],
        [
            [5846, 4915],
            [1, -23],
            [6, -14],
            [1, -19],
            [-7, -12],
            [-11, -31],
            [-10, -22],
            [-12, -2]
        ],
        [
            [5092, 8091],
            [20, -5],
            [26, 12],
            [17, -25],
            [16, -14]
        ],
        [
            [5171, 8059],
            [-4, -40]
        ],
        [
            [5167, 8019],
            [-7, -2],
            [-3, -33]
        ],
        [
            [5157, 7984],
            [-24, 26],
            [-14, -4],
            [-20, 28],
            [-13, 23],
            [-13, 1],
            [-4, 21]
        ],
        [
            [5069, 8079],
            [23, 12]
        ],
        [
            [5074, 5427],
            [-23, -7]
        ],
        [
            [5051, 5420],
            [-7, 41],
            [2, 136],
            [-6, 12],
            [-1, 29],
            [-10, 21],
            [-8, 17],
            [3, 31]
        ],
        [
            [5024, 5707],
            [10, 7],
            [6, 26],
            [13, 5],
            [6, 18]
        ],
        [
            [5059, 5763],
            [10, 17],
            [10, 0],
            [21, -34]
        ],
        [
            [5100, 5746],
            [-1, -19],
            [6, -35],
            [-6, -24],
            [3, -16],
            [-13, -37],
            [-9, -18],
            [-5, -37],
            [1, -38],
            [-2, -95]
        ],
        [
            [4921, 5627],
            [-19, 15],
            [-13, -2],
            [-10, -15],
            [-12, 13],
            [-5, 19],
            [-13, 13]
        ],
        [
            [4849, 5670],
            [-1, 34],
            [7, 26],
            [-1, 20],
            [23, 48],
            [4, 41],
            [7, 14],
            [14, -8],
            [11, 12],
            [4, 16],
            [22, 26],
            [5, 19],
            [26, 24],
            [15, 9],
            [7, -12],
            [18, 0]
        ],
        [
            [5010, 5939],
            [-2, -28],
            [3, -27],
            [16, -39],
            [1, -28],
            [32, -14],
            [-1, -40]
        ],
        [
            [5024, 5707],
            [-24, 1]
        ],
        [
            [5000, 5708],
            [-13, 5],
            [-9, -9],
            [-12, 4],
            [-48, -3],
            [-1, -33],
            [4, -45]
        ],
        [
            [7573, 6360],
            [0, -43],
            [-10, 9],
            [2, -47]
        ],
        [
            [7565, 6279],
            [-8, 30],
            [-1, 31],
            [-6, 28],
            [-11, 34],
            [-26, 3],
            [3, -25],
            [-9, -32],
            [-12, 12],
            [-4, -11],
            [-8, 6],
            [-11, 5]
        ],
        [
            [7472, 6360],
            [-4, 49],
            [-10, 45],
            [5, 35],
            [-17, 16],
            [6, 22],
            [18, 22],
            [-20, 31],
            [9, 40],
            [22, -26],
            [14, -3],
            [2, -41],
            [26, -8],
            [26, 1],
            [16, -10],
            [-13, -50],
            [-12, -3],
            [-9, -34],
            [16, -31],
            [4, 38],
            [8, 0],
            [14, -93]
        ],
        [
            [5629, 7671],
            [8, -25],
            [11, 5],
            [21, -9],
            [41, -4],
            [13, 16],
            [33, 13],
            [20, -21],
            [17, -6]
        ],
        [
            [5793, 7640],
            [-15, -25],
            [-10, -42],
            [9, -34]
        ],
        [
            [5777, 7539],
            [-24, 8],
            [-28, -18]
        ],
        [
            [5725, 7529],
            [0, -30],
            [-26, -5],
            [-19, 20],
            [-22, -16],
            [-21, 2]
        ],
        [
            [5637, 7500],
            [-2, 39],
            [-14, 19]
        ],
        [
            [5621, 7558],
            [5, 8],
            [-3, 7],
            [4, 19],
            [11, 18],
            [-14, 26],
            [-2, 21],
            [7, 14]
        ],
        [
            [2846, 6461],
            [-7, -3],
            [-7, 34],
            [-10, 17],
            [6, 38],
            [8, -3],
            [10, -49],
            [0, -34]
        ],
        [
            [2838, 6628],
            [-30, -10],
            [-2, 22],
            [13, 5],
            [18, -2],
            [1, -15]
        ],
        [
            [2861, 6628],
            [-5, -42],
            [-5, 8],
            [0, 31],
            [-12, 23],
            [0, 7],
            [22, -27]
        ],
        [
            [5527, 7708],
            [10, 0],
            [-7, -26],
            [14, -23],
            [-4, -28],
            [-7, -2]
        ],
        [
            [5533, 7629],
            [-5, -6],
            [-9, -13],
            [-4, -33]
        ],
        [
            [5515, 7577],
            [-25, 23],
            [-10, 24],
            [-11, 13],
            [-12, 22],
            [-6, 19],
            [-14, 27],
            [6, 25],
            [10, -14],
            [6, 12],
            [13, 2],
            [24, -10],
            [19, 1],
            [12, -13]
        ],
        [
            [5652, 8242],
            [27, 0],
            [30, 22],
            [6, 34],
            [23, 19],
            [-3, 26]
        ],
        [
            [5735, 8343],
            [17, 10],
            [30, 23]
        ],
        [
            [5782, 8376],
            [29, -15],
            [4, -15],
            [15, 7],
            [27, -14],
            [3, -27],
            [-6, -16],
            [17, -39],
            [12, -11],
            [-2, -11],
            [19, -10],
            [8, -16],
            [-11, -13],
            [-23, 2],
            [-5, -5],
            [7, -20],
            [6, -37]
        ],
        [
            [5882, 8136],
            [-23, -4],
            [-9, -13],
            [-2, -30],
            [-11, 6],
            [-25, -3],
            [-7, 14],
            [-11, -10],
            [-10, 8],
            [-22, 1],
            [-31, 15],
            [-28, 4],
            [-22, -1],
            [-15, -16],
            [-13, -2]
        ],
        [
            [5653, 8105],
            [-1, 26],
            [-8, 27],
            [17, 12],
            [0, 24],
            [-8, 22],
            [-1, 26]
        ],
        [
            [2524, 6110],
            [-1, 8],
            [4, 3],
            [5, -7],
            [10, 36],
            [5, 0]
        ],
        [
            [2547, 6150],
            [0, -8],
            [5, -1],
            [0, -16],
            [-5, -25],
            [3, -9],
            [-3, -21],
            [2, -6],
            [-4, -30],
            [-5, -16],
            [-5, -1],
            [-6, -21]
        ],
        [
            [2529, 5996],
            [-8, 0],
            [2, 67],
            [1, 47]
        ],
        [
            [3136, 3714],
            [-20, -8],
            [-11, 82],
            [-15, 66],
            [9, 57],
            [-15, 25],
            [-4, 43],
            [-13, 40]
        ],
        [
            [3067, 4019],
            [17, 64],
            [-12, 49],
            [7, 20],
            [-5, 22],
            [10, 30],
            [1, 50],
            [1, 41],
            [6, 20],
            [-24, 96]
        ],
        [
            [3068, 4411],
            [21, -5],
            [14, 1],
            [6, 18],
            [25, 24],
            [14, 22],
            [37, 10],
            [-3, -44],
            [3, -23],
            [-2, -40],
            [30, -53],
            [31, -9],
            [11, -23],
            [19, -11],
            [11, -17],
            [18, 0],
            [16, -17],
            [1, -34],
            [6, -18],
            [0, -25],
            [-8, -1],
            [11, -69],
            [53, -2],
            [-4, -35],
            [3, -23],
            [15, -16],
            [6, -37],
            [-4, -47],
            [-8, -26],
            [3, -33],
            [-9, -12]
        ],
        [
            [3384, 3866],
            [-1, 18],
            [-25, 30],
            [-26, 1],
            [-49, -17],
            [-13, -52],
            [-1, -32],
            [-11, -71]
        ],
        [
            [3482, 3537],
            [6, 34],
            [3, 35],
            [1, 32],
            [-10, 11],
            [-11, -9],
            [-10, 2],
            [-4, 23],
            [-2, 54],
            [-5, 18],
            [-19, 16],
            [-11, -12],
            [-30, 11],
            [2, 81],
            [-8, 33]
        ],
        [
            [3068, 4411],
            [-15, -11],
            [-13, 7],
            [2, 90],
            [-23, -35],
            [-24, 2],
            [-11, 31],
            [-18, 4],
            [5, 25],
            [-15, 36],
            [-11, 53],
            [7, 11],
            [0, 25],
            [17, 17],
            [-3, 32],
            [7, 20],
            [2, 28],
            [32, 40],
            [22, 11],
            [4, 9],
            [25, -2]
        ],
        [
            [3058, 4804],
            [13, 162],
            [0, 25],
            [-4, 34],
            [-12, 22],
            [0, 42],
            [15, 10],
            [6, -6],
            [1, 23],
            [-16, 6],
            [-1, 37],
            [54, -2],
            [10, 21],
            [7, -19],
            [6, -35],
            [5, 8]
        ],
        [
            [3142, 5132],
            [15, -32],
            [22, 4],
            [5, 18],
            [21, 14],
            [11, 10],
            [4, 25],
            [19, 17],
            [-1, 12],
            [-24, 5],
            [-3, 37],
            [1, 40],
            [-13, 15],
            [5, 6],
            [21, -8],
            [22, -15],
            [8, 14],
            [20, 9],
            [31, 23],
            [10, 22],
            [-3, 17]
        ],
        [
            [3313, 5365],
            [14, 2],
            [7, -13],
            [-4, -26],
            [9, -9],
            [7, -28],
            [-8, -20],
            [-4, -51],
            [7, -30],
            [2, -27],
            [17, -28],
            [14, -3],
            [3, 12],
            [8, 3],
            [13, 10],
            [9, 16],
            [15, -5],
            [7, 2]
        ],
        [
            [3429, 5170],
            [15, -5],
            [3, 12],
            [-5, 12],
            [3, 17],
            [11, -5],
            [13, 6],
            [16, -13]
        ],
        [
            [3485, 5194],
            [12, -12],
            [9, 16],
            [6, -3],
            [4, -16],
            [13, 4],
            [11, 22],
            [8, 44],
            [17, 54]
        ],
        [
            [3565, 5303],
            [9, 3],
            [7, -33],
            [16, -103],
            [14, -10],
            [1, -41],
            [-21, -48],
            [9, -18],
            [49, -9],
            [1, -60],
            [21, 39],
            [35, -21],
            [46, -36],
            [14, -35],
            [-5, -32],
            [33, 18],
            [54, -32],
            [41, 3],
            [41, -49],
            [36, -66],
            [21, -17],
            [24, -3],
            [10, -18],
            [9, -76],
            [5, -35],
            [-11, -98],
            [-14, -39],
            [-39, -82],
            [-18, -67],
            [-21, -51],
            [-7, -1],
            [-7, -43],
            [2, -111],
            [-8, -91],
            [-3, -39],
            [-9, -23],
            [-5, -79],
            [-28, -77],
            [-5, -61],
            [-22, -26],
            [-7, -35],
            [-30, 0],
            [-44, -23],
            [-19, -26],
            [-31, -18],
            [-33, -47],
            [-23, -58],
            [-5, -44],
            [5, -33],
            [-5, -60],
            [-6, -28],
            [-20, -33],
            [-31, -104],
            [-24, -47],
            [-19, -27],
            [-13, -57],
            [-18, -33]
        ],
        [
            [3517, 3063],
            [-8, 33],
            [13, 28],
            [-16, 40],
            [-22, 33],
            [-29, 38],
            [-10, -2],
            [-28, 46],
            [-18, -7]
        ],
        [
            [8172, 5325],
            [11, 22],
            [23, 32]
        ],
        [
            [8206, 5379],
            [-1, -29],
            [-2, -37],
            [-13, 1],
            [-6, -20],
            [-12, 31]
        ],
        [
            [7546, 6698],
            [12, -19],
            [-2, -36],
            [-23, -2],
            [-23, 4],
            [-18, -9],
            [-25, 22],
            [-1, 12]
        ],
        [
            [7466, 6670],
            [19, 44],
            [15, 15],
            [20, -14],
            [14, -1],
            [12, -16]
        ],
        [
            [5817, 3752],
            [-39, -43],
            [-25, -44],
            [-10, -40],
            [-8, -22],
            [-15, -4],
            [-5, -29],
            [-3, -18],
            [-17, -14],
            [-23, 3],
            [-13, 17],
            [-12, 7],
            [-14, -14],
            [-6, -28],
            [-14, -18],
            [-13, -26],
            [-20, -6],
            [-6, 20],
            [2, 36],
            [-16, 56],
            [-8, 9]
        ],
        [
            [5552, 3594],
            [0, 173],
            [27, 2],
            [1, 210],
            [21, 2],
            [43, 21],
            [10, -24],
            [18, 23],
            [9, 0],
            [15, 13]
        ],
        [
            [5696, 4014],
            [5, -4]
        ],
        [
            [5701, 4010],
            [11, -48],
            [5, -10],
            [9, -34],
            [32, -65],
            [12, -7],
            [0, -20],
            [8, -38],
            [21, -9],
            [18, -27]
        ],
        [
            [5424, 5496],
            [23, 4],
            [5, 16],
            [5, -2],
            [7, -13],
            [34, 23],
            [12, 23],
            [15, 20],
            [-3, 21],
            [8, 6],
            [27, -4],
            [26, 27],
            [20, 65],
            [14, 24],
            [18, 10]
        ],
        [
            [5635, 5716],
            [3, -26],
            [16, -36],
            [0, -25],
            [-5, -24],
            [2, -18],
            [10, -18]
        ],
        [
            [5661, 5569],
            [21, -25]
        ],
        [
            [5682, 5544],
            [15, -24],
            [0, -19],
            [19, -31],
            [12, -26],
            [7, -35],
            [20, -24],
            [5, -18]
        ],
        [
            [5760, 5367],
            [-9, -7],
            [-18, 2],
            [-21, 6],
            [-10, -5],
            [-5, -14],
            [-9, -2],
            [-10, 12],
            [-31, -29],
            [-13, 6],
            [-4, -5],
            [-8, -35],
            [-21, 11],
            [-20, 6],
            [-18, 22],
            [-23, 20],
            [-15, -19],
            [-10, -30],
            [-3, -41]
        ],
        [
            [5512, 5265],
            [-18, 3],
            [-19, 10],
            [-16, -32],
            [-15, -55]
        ],
        [
            [5444, 5191],
            [-3, 18],
            [-1, 27],
            [-13, 19],
            [-10, 30],
            [-2, 21],
            [-13, 31],
            [2, 18],
            [-3, 25],
            [2, 45],
            [7, 11],
            [14, 60]
        ],
        [
            [3231, 7808],
            [20, -8],
            [26, 1],
            [-14, -24],
            [-10, -4],
            [-35, 25],
            [-7, 20],
            [10, 18],
            [10, -28]
        ],
        [
            [3283, 7958],
            [-14, -1],
            [-36, 19],
            [-26, 28],
            [10, 5],
            [37, -15],
            [28, -25],
            [1, -11]
        ],
        [
            [1569, 7923],
            [-14, -8],
            [-46, 27],
            [-8, 21],
            [-25, 21],
            [-5, 16],
            [-28, 11],
            [-11, 32],
            [2, 14],
            [30, -13],
            [17, -9],
            [26, -6],
            [9, -21],
            [14, -28],
            [28, -24],
            [11, -33]
        ],
        [
            [3440, 8052],
            [-18, -52],
            [18, 20],
            [19, -12],
            [-10, -21],
            [25, -16],
            [12, 14],
            [28, -18],
            [-8, -43],
            [19, 10],
            [4, -32],
            [8, -36],
            [-11, -52],
            [-13, -2],
            [-18, 11],
            [6, 48],
            [-8, 8],
            [-32, -52],
            [-17, 2],
            [20, 28],
            [-27, 14],
            [-30, -3],
            [-54, 2],
            [-4, 17],
            [17, 21],
            [-12, 16],
            [24, 36],
            [28, 94],
            [18, 33],
            [24, 21],
            [13, -3],
            [-6, -16],
            [-15, -37]
        ],
        [
            [1313, 8250],
            [27, 5],
            [-8, -67],
            [24, -48],
            [-11, 0],
            [-17, 27],
            [-10, 27],
            [-14, 19],
            [-5, 26],
            [1, 19],
            [13, -8]
        ],
        [
            [2798, 8730],
            [-11, -31],
            [-12, 5],
            [-8, 17],
            [2, 4],
            [10, 18],
            [12, -1],
            [7, -12]
        ],
        [
            [2725, 8762],
            [-33, -32],
            [-19, 1],
            [-6, 16],
            [20, 27],
            [38, 0],
            [0, -12]
        ],
        [
            [2634, 8936],
            [5, -26],
            [15, 9],
            [16, -15],
            [30, -20],
            [32, -19],
            [2, -28],
            [21, 5],
            [20, -20],
            [-25, -18],
            [-43, 14],
            [-16, 26],
            [-27, -31],
            [-40, -31],
            [-9, 35],
            [-38, -6],
            [24, 30],
            [4, 46],
            [9, 54],
            [20, -5]
        ],
        [
            [2892, 9024],
            [-31, -3],
            [-7, 29],
            [12, 34],
            [26, 8],
            [21, -17],
            [1, -25],
            [-4, -8],
            [-18, -18]
        ],
        [
            [2343, 9140],
            [-17, -21],
            [-38, 18],
            [-22, -6],
            [-38, 26],
            [24, 19],
            [19, 25],
            [30, -16],
            [17, -11],
            [8, -11],
            [17, -23]
        ],
        [
            [3135, 7724],
            [-18, 33],
            [0, 81],
            [-13, 17],
            [-18, -10],
            [-10, 16],
            [-21, -45],
            [-8, -46],
            [-10, -27],
            [-12, -9],
            [-9, -3],
            [-3, -15],
            [-51, 0],
            [-42, 0],
            [-12, -11],
            [-30, -42],
            [-3, -5],
            [-9, -23],
            [-26, 0],
            [-27, 0],
            [-12, -10],
            [4, -11],
            [2, -18],
            [0, -6],
            [-36, -30],
            [-29, -9],
            [-32, -31],
            [-7, 0],
            [-10, 9],
            [-3, 8],
            [1, 6],
            [6, 21],
            [13, 33],
            [8, 35],
            [-5, 51],
            [-6, 53],
            [-29, 28],
            [3, 11],
            [-4, 7],
            [-8, 0],
            [-5, 9],
            [-2, 14],
            [-5, -6],
            [-7, 2],
            [1, 6],
            [-6, 6],
            [-3, 15],
            [-21, 19],
            [-23, 20],
            [-27, 23],
            [-26, 21],
            [-25, -17],
            [-9, 0],
            [-34, 15],
            [-23, -8],
            [-27, 19],
            [-28, 9],
            [-19, 4],
            [-9, 10],
            [-5, 32],
            [-9, 0],
            [-1, -23],
            [-57, 0],
            [-95, 0],
            [-94, 0],
            [-84, 0],
            [-83, 0],
            [-82, 0],
            [-85, 0],
            [-27, 0],
            [-82, 0],
            [-79, 0]
        ],
        [
            [1588, 7952],
            [-4, 0],
            [-54, 58],
            [-20, 26],
            [-50, 24],
            [-15, 53],
            [3, 36],
            [-35, 25],
            [-5, 48],
            [-34, 43],
            [0, 30]
        ],
        [
            [1374, 8295],
            [15, 29],
            [0, 37],
            [-48, 37],
            [-28, 68],
            [-17, 42],
            [-26, 27],
            [-19, 24],
            [-14, 31],
            [-28, -20],
            [-27, -33],
            [-25, 39],
            [-19, 26],
            [-27, 16],
            [-28, 2],
            [0, 337],
            [1, 219]
        ],
        [
            [1084, 9176],
            [51, -14],
            [44, -29],
            [29, -5],
            [24, 24],
            [34, 19],
            [41, -7],
            [42, 26],
            [45, 14],
            [20, -24],
            [20, 14],
            [6, 27],
            [20, -6],
            [47, -53],
            [37, 40],
            [3, -45],
            [34, 10],
            [11, 17],
            [34, -3],
            [42, -25],
            [65, -22],
            [38, -10],
            [28, 4],
            [37, -30],
            [-39, -29],
            [50, -13],
            [75, 7],
            [24, 11],
            [29, -36],
            [31, 30],
            [-29, 25],
            [18, 20],
            [34, 3],
            [22, 6],
            [23, -14],
            [28, -32],
            [31, 5],
            [49, -27],
            [43, 9],
            [40, -1],
            [-3, 37],
            [25, 10],
            [43, -20],
            [0, -56],
            [17, 47],
            [23, -1],
            [12, 59],
            [-30, 36],
            [-32, 24],
            [2, 65],
            [33, 43],
            [37, -9],
            [28, -26],
            [38, -67],
            [-25, -29],
            [52, -12],
            [-1, -60],
            [38, 46],
            [33, -38],
            [-9, -44],
            [27, -40],
            [29, 43],
            [21, 51],
            [1, 65],
            [40, -5],
            [41, -8],
            [37, -30],
            [2, -29],
            [-21, -31],
            [20, -32],
            [-4, -29],
            [-54, -41],
            [-39, -9],
            [-29, 18],
            [-8, -30],
            [-27, -50],
            [-8, -26],
            [-32, -40],
            [-40, -4],
            [-22, -25],
            [-2, -38],
            [-32, -7],
            [-34, -48],
            [-30, -67],
            [-11, -46],
            [-1, -69],
            [40, -10],
            [13, -55],
            [13, -45],
            [39, 12],
            [51, -26],
            [28, -22],
            [20, -28],
            [35, -17],
            [29, -24],
            [46, -4],
            [30, -6],
            [-4, -51],
            [8, -59],
            [21, -66],
            [41, -56],
            [21, 19],
            [15, 61],
            [-14, 93],
            [-20, 31],
            [45, 28],
            [31, 41],
            [16, 41],
            [-3, 40],
            [-19, 50],
            [-33, 44],
            [32, 62],
            [-12, 54],
            [-9, 92],
            [19, 14],
            [48, -16],
            [29, -6],
            [23, 15],
            [25, -20],
            [35, -34],
            [8, -23],
            [50, -4],
            [-1, -50],
            [9, -74],
            [25, -10],
            [21, -35],
            [40, 33],
            [26, 65],
            [19, 28],
            [21, -53],
            [36, -75],
            [31, -71],
            [-11, -37],
            [37, -33],
            [25, -34],
            [44, -15],
            [18, -19],
            [11, -50],
            [22, -8],
            [11, -22],
            [2, -67],
            [-20, -22],
            [-20, -21],
            [-46, -21],
            [-35, -48],
            [-47, -10],
            [-59, 13],
            [-42, 0],
            [-29, -4],
            [-23, -43],
            [-35, -26],
            [-40, -78],
            [-32, -54],
            [23, 9],
            [45, 78],
            [58, 49],
            [42, 6],
            [24, -29],
            [-26, -40],
            [9, -63],
            [9, -45],
            [36, -29],
            [46, 8],
            [28, 67],
            [2, -43],
            [17, -22],
            [-34, -38],
            [-61, -36],
            [-28, -23],
            [-31, -43],
            [-21, 4],
            [-1, 50],
            [48, 49],
            [-44, -2],
            [-31, -7]
        ],
        [
            [1829, 9377],
            [-14, -27],
            [61, 17],
            [39, -29],
            [31, 30],
            [26, -20],
            [23, -58],
            [14, 25],
            [-20, 60],
            [24, 9],
            [28, -9],
            [31, -24],
            [17, -58],
            [9, -41],
            [47, -30],
            [50, -28],
            [-3, -26],
            [-46, -4],
            [18, -23],
            [-9, -22],
            [-51, 9],
            [-48, 16],
            [-32, -3],
            [-52, -20],
            [-70, -9],
            [-50, -6],
            [-15, 28],
            [-38, 16],
            [-24, -6],
            [-35, 47],
            [19, 6],
            [43, 10],
            [39, -3],
            [36, 11],
            [-54, 13],
            [-59, -4],
            [-39, 1],
            [-15, 22],
            [64, 23],
            [-42, -1],
            [-49, 16],
            [23, 44],
            [20, 24],
            [74, 36],
            [29, -12]
        ],
        [
            [2097, 9395],
            [-24, -39],
            [-44, 41],
            [10, 9],
            [37, 2],
            [21, -13]
        ],
        [
            [2879, 9376],
            [3, -16],
            [-30, 2],
            [-30, 1],
            [-30, -8],
            [-8, 3],
            [-31, 32],
            [1, 21],
            [14, 4],
            [63, -6],
            [48, -33]
        ],
        [
            [2595, 9379],
            [22, -36],
            [26, 47],
            [70, 24],
            [48, -61],
            [-4, -38],
            [55, 17],
            [26, 23],
            [62, -30],
            [38, -28],
            [3, -25],
            [52, 13],
            [29, -38],
            [67, -23],
            [24, -24],
            [26, -55],
            [-51, -28],
            [66, -38],
            [44, -13],
            [40, -55],
            [44, -3],
            [-9, -42],
            [-49, -69],
            [-34, 26],
            [-44, 57],
            [-36, -8],
            [-3, -34],
            [29, -34],
            [38, -27],
            [11, -16],
            [18, -58],
            [-9, -43],
            [-35, 16],
            [-70, 47],
            [39, -51],
            [29, -35],
            [5, -21],
            [-76, 24],
            [-59, 34],
            [-34, 29],
            [10, 17],
            [-42, 30],
            [-40, 29],
            [0, -18],
            [-80, -9],
            [-23, 20],
            [18, 44],
            [52, 1],
            [57, 7],
            [-9, 21],
            [10, 30],
            [36, 57],
            [-8, 27],
            [-11, 20],
            [-42, 29],
            [-57, 20],
            [18, 15],
            [-29, 36],
            [-25, 4],
            [-22, 20],
            [-14, -18],
            [-51, -7],
            [-101, 13],
            [-59, 17],
            [-45, 9],
            [-23, 21],
            [29, 27],
            [-39, 0],
            [-9, 60],
            [21, 53],
            [29, 24],
            [72, 16],
            [-21, -39]
        ],
        [
            [2212, 9420],
            [33, -12],
            [50, 7],
            [7, -17],
            [-26, -28],
            [42, -26],
            [-5, -53],
            [-45, -23],
            [-27, 5],
            [-19, 23],
            [-69, 45],
            [0, 19],
            [57, -7],
            [-31, 38],
            [33, 29]
        ],
        [
            [2411, 9357],
            [-30, -45],
            [-32, 3],
            [-17, 52],
            [1, 29],
            [14, 25],
            [28, 16],
            [58, -2],
            [53, -14],
            [-42, -53],
            [-33, -11]
        ],
        [
            [1654, 9275],
            [-73, -29],
            [-15, 26],
            [-64, 31],
            [12, 25],
            [19, 43],
            [24, 39],
            [-27, 36],
            [94, 10],
            [39, -13],
            [71, -3],
            [27, -17],
            [30, -25],
            [-35, -15],
            [-68, -41],
            [-34, -42],
            [0, -25]
        ],
        [
            [2399, 9487],
            [-15, -23],
            [-40, 5],
            [-34, 15],
            [15, 27],
            [40, 16],
            [24, -21],
            [10, -19]
        ],
        [
            [2264, 9590],
            [21, -27],
            [1, -31],
            [-13, -44],
            [-46, -6],
            [-30, 10],
            [1, 34],
            [-45, -4],
            [-2, 45],
            [30, -2],
            [41, 21],
            [40, -4],
            [2, 8]
        ],
        [
            [1994, 9559],
            [11, -21],
            [25, 10],
            [29, -2],
            [5, -29],
            [-17, -28],
            [-94, -10],
            [-70, -25],
            [-43, -2],
            [-3, 20],
            [57, 26],
            [-125, -7],
            [-39, 10],
            [38, 58],
            [26, 17],
            [78, -20],
            [50, -35],
            [48, -5],
            [-40, 57],
            [26, 21],
            [29, -7],
            [9, -28]
        ],
        [
            [2370, 9612],
            [30, -19],
            [55, 0],
            [24, -19],
            [-6, -22],
            [32, -14],
            [17, -14],
            [38, -2],
            [40, -5],
            [44, 13],
            [57, 5],
            [45, -5],
            [30, -22],
            [6, -24],
            [-17, -16],
            [-42, -13],
            [-35, 8],
            [-80, -10],
            [-57, -1],
            [-45, 8],
            [-74, 19],
            [-9, 32],
            [-4, 29],
            [-27, 26],
            [-58, 7],
            [-32, 19],
            [10, 24],
            [58, -4]
        ],
        [
            [1772, 9645],
            [-4, -46],
            [-21, -20],
            [-26, -3],
            [-52, -26],
            [-44, -9],
            [-38, 13],
            [47, 44],
            [57, 39],
            [43, -1],
            [38, 9]
        ],
        [
            [2393, 9637],
            [-13, -2],
            [-52, 4],
            [-7, 17],
            [56, -1],
            [19, -11],
            [-3, -7]
        ],
        [
            [1939, 9648],
            [-52, -17],
            [-41, 19],
            [23, 19],
            [40, 6],
            [39, -10],
            [-9, -17]
        ],
        [
            [1954, 9701],
            [-34, -11],
            [-46, 0],
            [0, 8],
            [29, 18],
            [14, -3],
            [37, -12]
        ],
        [
            [2338, 9669],
            [-41, -12],
            [-23, 13],
            [-12, 23],
            [-2, 24],
            [36, -2],
            [16, -4],
            [33, -21],
            [-7, -21]
        ],
        [
            [2220, 9685],
            [11, -25],
            [-45, 7],
            [-46, 19],
            [-62, 2],
            [27, 18],
            [-34, 14],
            [-2, 22],
            [55, -8],
            [75, -21],
            [21, -28]
        ],
        [
            [2583, 9764],
            [33, -20],
            [-38, -17],
            [-51, -45],
            [-50, -4],
            [-57, 8],
            [-30, 24],
            [0, 21],
            [22, 16],
            [-50, 0],
            [-31, 19],
            [-18, 27],
            [20, 26],
            [19, 18],
            [28, 4],
            [-12, 14],
            [65, 3],
            [35, -32],
            [47, -12],
            [46, -11],
            [22, -39]
        ],
        [
            [3097, 9967],
            [74, -4],
            [60, -8],
            [51, -16],
            [-2, -16],
            [-67, -25],
            [-68, -12],
            [-25, -14],
            [61, 1],
            [-66, -36],
            [-45, -17],
            [-48, -48],
            [-57, -10],
            [-18, -12],
            [-84, -6],
            [39, -8],
            [-20, -10],
            [23, -29],
            [-26, -21],
            [-43, -16],
            [-13, -24],
            [-39, -17],
            [4, -14],
            [48, 3],
            [0, -15],
            [-74, -35],
            [-73, 16],
            [-81, -9],
            [-42, 7],
            [-52, 3],
            [-4, 29],
            [52, 13],
            [-14, 43],
            [17, 4],
            [74, -26],
            [-38, 38],
            [-45, 11],
            [23, 23],
            [49, 14],
            [8, 21],
            [-39, 23],
            [-12, 31],
            [76, -3],
            [22, -6],
            [43, 21],
            [-62, 7],
            [-98, -4],
            [-49, 20],
            [-23, 24],
            [-32, 17],
            [-6, 21],
            [41, 11],
            [32, 2],
            [55, 9],
            [41, 22],
            [34, -3],
            [30, -16],
            [21, 32],
            [37, 9],
            [50, 7],
            [85, 2],
            [14, -6],
            [81, 10],
            [60, -4],
            [60, -4]
        ],
        [
            [5290, 7828],
            [-3, -24],
            [-12, -10],
            [-20, 7],
            [-6, -24],
            [-14, -2],
            [-5, 10],
            [-15, -20],
            [-13, -3],
            [-12, 13]
        ],
        [
            [5190, 7775],
            [-10, 25],
            [-13, -9],
            [0, 27],
            [21, 33],
            [-1, 15],
            [12, -5],
            [8, 10]
        ],
        [
            [5207, 7871],
            [24, -1],
            [5, 13],
            [30, -18]
        ],
        [
            [3140, 1814],
            [-10, -24],
            [-23, -18],
            [-14, 2],
            [-16, 5],
            [-21, 18],
            [-29, 8],
            [-35, 33],
            [-28, 32],
            [-38, 66],
            [23, -12],
            [39, -40],
            [36, -21],
            [15, 27],
            [9, 41],
            [25, 24],
            [20, -7]
        ],
        [
            [3095, 1968],
            [-25, 0],
            [-13, -14],
            [-25, -22],
            [-5, -55],
            [-11, -1],
            [-32, 19],
            [-32, 41],
            [-34, 34],
            [-9, 37],
            [8, 35],
            [-14, 39],
            [-4, 101],
            [12, 57],
            [30, 45],
            [-43, 18],
            [27, 52],
            [9, 98],
            [31, -21],
            [15, 123],
            [-19, 15],
            [-9, -73],
            [-17, 8],
            [9, 84],
            [9, 110],
            [13, 40],
            [-8, 58],
            [-2, 66],
            [11, 2],
            [17, 96],
            [20, 94],
            [11, 88],
            [-6, 89],
            [8, 49],
            [-3, 72],
            [16, 73],
            [5, 114],
            [9, 123],
            [9, 132],
            [-2, 96],
            [-6, 84]
        ],
        [
            [3045, 3974],
            [14, 15],
            [8, 30]
        ],
        [
            [8064, 6161],
            [-24, -28],
            [-23, 18],
            [0, 51],
            [13, 26],
            [31, 17],
            [16, -1],
            [6, -23],
            [-12, -26],
            [-7, -34]
        ],
        [
            [8628, 7562],
            [-18, 35],
            [-11, -33],
            [-43, -26],
            [4, -31],
            [-24, 2],
            [-13, 19],
            [-19, -42],
            [-30, -32],
            [-23, -38]
        ],
        [
            [8451, 7416],
            [-39, -17],
            [-20, -27],
            [-30, -17],
            [15, 28],
            [-6, 23],
            [22, 40],
            [-15, 30],
            [-24, -20],
            [-32, -41],
            [-17, -39],
            [-27, -2],
            [-14, -28],
            [15, -40],
            [22, -10],
            [1, -26],
            [22, -17],
            [31, 42],
            [25, -23],
            [18, -2],
            [4, -31],
            [-39, -16],
            [-13, -32],
            [-27, -30],
            [-14, -41],
            [30, -33],
            [11, -58],
            [17, -54],
            [18, -45],
            [0, -44],
            [-17, -16],
            [6, -32],
            [17, -18],
            [-5, -48],
            [-7, -47],
            [-15, -5],
            [-21, -64],
            [-22, -78],
            [-26, -70],
            [-38, -55],
            [-39, -50],
            [-31, -6],
            [-17, -27],
            [-10, 20],
            [-15, -30],
            [-39, -29],
            [-29, -9],
            [-10, -63],
            [-15, -3],
            [-8, 43],
            [7, 22],
            [-37, 19],
            [-13, -9]
        ],
        [
            [8001, 6331],
            [-28, 15],
            [-14, 24],
            [5, 34],
            [-26, 11],
            [-13, 22],
            [-24, -31],
            [-27, -7],
            [-22, 0],
            [-15, -14]
        ],
        [
            [7837, 6385],
            [-14, -9],
            [4, -68],
            [-15, 2],
            [-2, 14]
        ],
        [
            [7810, 6324],
            [-1, 24],
            [-20, -17],
            [-12, 11],
            [-21, 22],
            [8, 49],
            [-18, 12],
            [-6, 54],
            [-30, -10],
            [4, 70],
            [26, 50],
            [1, 48],
            [-1, 46],
            [-12, 14],
            [-9, 35],
            [-16, -5]
        ],
        [
            [7703, 6727],
            [-30, 9],
            [9, 25],
            [-13, 36],
            [-20, -24],
            [-23, 14],
            [-32, -37],
            [-25, -44],
            [-23, -8]
        ],
        [
            [7466, 6670],
            [-2, 47],
            [-17, -13]
        ],
        [
            [7447, 6704],
            [-32, 6],
            [-32, 14],
            [-22, 26],
            [-22, 11],
            [-9, 29],
            [-16, 8],
            [-28, 39],
            [-22, 18],
            [-12, -14]
        ],
        [
            [7252, 6841],
            [-38, 41],
            [-28, 37],
            [-7, 65],
            [20, -7],
            [1, 30],
            [-12, 30],
            [3, 48],
            [-30, 69]
        ],
        [
            [7161, 7154],
            [-45, 24],
            [-8, 46],
            [-21, 27]
        ],
        [
            [7082, 7268],
            [-4, 34],
            [1, 23],
            [-17, 13],
            [-9, -6],
            [-7, 55]
        ],
        [
            [7046, 7387],
            [8, 13],
            [-4, 14],
            [26, 28],
            [20, 12],
            [29, -8],
            [11, 38],
            [35, 7],
            [10, 23],
            [44, 32],
            [4, 13]
        ],
        [
            [7229, 7559],
            [-2, 34],
            [19, 15],
            [-25, 103],
            [55, 24],
            [14, 13],
            [20, 106],
            [55, -20],
            [15, 27],
            [2, 59],
            [23, 6],
            [21, 39]
        ],
        [
            [7426, 7965],
            [11, 5]
        ],
        [
            [7437, 7970],
            [7, -41],
            [23, -32],
            [40, -22],
            [19, -47],
            [-10, -70],
            [10, -25],
            [33, -10],
            [37, -8],
            [33, -37],
            [18, -7],
            [12, -54],
            [17, -35],
            [30, 1],
            [58, -13],
            [36, 8],
            [28, -9],
            [41, -36],
            [34, 0],
            [12, -18],
            [32, 32],
            [45, 20],
            [42, 2],
            [32, 21],
            [20, 32],
            [20, 20],
            [-5, 19],
            [-9, 23],
            [15, 38],
            [15, -5],
            [29, -12],
            [28, 31],
            [42, 23],
            [20, 39],
            [20, 17],
            [40, 8],
            [22, -7],
            [3, 21],
            [-25, 41],
            [-22, 19],
            [-22, -22],
            [-27, 10],
            [-16, -8],
            [-7, 24],
            [20, 59],
            [13, 45]
        ],
        [
            [8240, 8005],
            [34, -23],
            [39, 38],
            [-1, 26],
            [26, 62],
            [15, 19],
            [0, 33],
            [-16, 14],
            [23, 29],
            [35, 11],
            [37, 2],
            [41, -18],
            [25, -22],
            [17, -59],
            [10, -26],
            [10, -36],
            [10, -58],
            [49, -19],
            [32, -42],
            [12, -55],
            [42, 0],
            [24, 23],
            [46, 17],
            [-15, -53],
            [-11, -21],
            [-9, -65],
            [-19, -58],
            [-33, 11],
            [-24, -21],
            [7, -51],
            [-4, -69],
            [-14, -2],
            [0, -30]
        ],
        [
            [4920, 5353],
            [-12, -1],
            [-20, 12],
            [-18, -1],
            [-33, -10],
            [-19, -18],
            [-27, -21],
            [-6, 1]
        ],
        [
            [4785, 5315],
            [2, 49],
            [3, 7],
            [-1, 24],
            [-12, 24],
            [-8, 4],
            [-8, 17],
            [6, 26],
            [-3, 28],
            [1, 18]
        ],
        [
            [4765, 5512],
            [5, 0],
            [1, 25],
            [-2, 12],
            [3, 8],
            [10, 7],
            [-7, 47],
            [-6, 25],
            [2, 20],
            [5, 4]
        ],
        [
            [4776, 5660],
            [4, 6],
            [8, -9],
            [21, -1],
            [5, 18],
            [5, -1],
            [8, 6],
            [4, -25],
            [7, 7],
            [11, 9]
        ],
        [
            [4921, 5627],
            [7, -84],
            [-11, -50],
            [-8, -66],
            [12, -51],
            [-1, -23]
        ],
        [
            [5363, 5191],
            [-4, 4],
            [-16, -8],
            [-17, 8],
            [-13, -4]
        ],
        [
            [5313, 5191],
            [-45, 1]
        ],
        [
            [5268, 5192],
            [4, 47],
            [-11, 39],
            [-13, 10],
            [-6, 27],
            [-7, 8],
            [1, 16]
        ],
        [
            [5236, 5339],
            [7, 42],
            [13, 57],
            [8, 1],
            [17, 34],
            [10, 1],
            [16, -24],
            [19, 20],
            [2, 25],
            [7, 23],
            [4, 30],
            [15, 25],
            [5, 41],
            [6, 13],
            [4, 31],
            [7, 37],
            [24, 46],
            [1, 20],
            [3, 10],
            [-11, 24]
        ],
        [
            [5393, 5795],
            [1, 19],
            [8, 3]
        ],
        [
            [5402, 5817],
            [11, -38],
            [2, -39],
            [-1, -39],
            [15, -54],
            [-15, 1],
            [-8, -4],
            [-13, 6],
            [-6, -28],
            [16, -35],
            [13, -10],
            [3, -24],
            [9, -41],
            [-4, -16]
        ],
        [
            [5444, 5191],
            [-2, -31],
            [-22, 14],
            [-22, 15],
            [-35, 2]
        ],
        [
            [5856, 5265],
            [-2, -69],
            [11, -8],
            [-9, -21],
            [-10, -16],
            [-11, -31],
            [-6, -27],
            [-1, -48],
            [-7, -22],
            [0, -45]
        ],
        [
            [5821, 4978],
            [-8, -16],
            [-1, -35],
            [-4, -5],
            [-2, -32]
        ],
        [
            [5814, 4792],
            [5, -55],
            [-2, -30],
            [5, -35],
            [16, -33],
            [15, -74]
        ],
        [
            [5853, 4565],
            [-11, 6],
            [-37, -10],
            [-7, -7],
            [-8, -38],
            [6, -26],
            [-5, -70],
            [-3, -59],
            [7, -11],
            [19, -23],
            [8, 11],
            [2, -64],
            [-21, 1],
            [-11, 32],
            [-10, 25],
            [-22, 9],
            [-6, 31],
            [-17, -19],
            [-22, 8],
            [-10, 27],
            [-17, 6],
            [-13, -2],
            [-2, 19],
            [-9, 1]
        ],
        [
            [5342, 4697],
            [-4, 18]
        ],
        [
            [5360, 4775],
            [8, -6],
            [9, 23],
            [15, -1],
            [2, -17],
            [11, -10],
            [16, 37],
            [16, 29],
            [7, 19],
            [-1, 48],
            [12, 58],
            [13, 30],
            [18, 29],
            [3, 18],
            [1, 22],
            [5, 21],
            [-2, 33],
            [4, 52],
            [5, 37],
            [8, 32],
            [2, 36]
        ],
        [
            [5760, 5367],
            [17, -49],
            [12, -7],
            [8, 10],
            [12, -4],
            [16, 12],
            [6, -25],
            [25, -39]
        ],
        [
            [5330, 4760],
            [-22, 62]
        ],
        [
            [5308, 4822],
            [21, 33],
            [-11, 39],
            [10, 15],
            [19, 7],
            [2, 26],
            [15, -28],
            [24, -2],
            [9, 27],
            [3, 40],
            [-3, 46],
            [-13, 35],
            [12, 68],
            [-7, 12],
            [-21, -5],
            [-7, 31],
            [2, 25]
        ],
        [
            [2906, 5049],
            [-12, 14],
            [-14, 19],
            [-7, -9],
            [-24, 8],
            [-7, 25],
            [-5, -1],
            [-28, 34]
        ],
        [
            [2809, 5139],
            [-3, 18],
            [10, 5],
            [-1, 29],
            [6, 22],
            [14, 4],
            [12, 37],
            [10, 31],
            [-10, 14],
            [5, 34],
            [-6, 54],
            [6, 16],
            [-4, 50],
            [-12, 31]
        ],
        [
            [2836, 5484],
            [4, 29],
            [9, -4],
            [5, 17],
            [-6, 35],
            [3, 9]
        ],
        [
            [2851, 5570],
            [14, -2],
            [21, 41],
            [12, 6],
            [0, 20],
            [5, 50],
            [16, 27],
            [17, 1],
            [3, 13],
            [21, -5],
            [22, 30],
            [11, 13],
            [14, 28],
            [9, -3],
            [8, -16],
            [-6, -20]
        ],
        [
            [3018, 5753],
            [-18, -10],
            [-7, -29],
            [-10, -17],
            [-8, -22],
            [-4, -42],
            [-8, -35],
            [15, -4],
            [3, -27],
            [6, -13],
            [3, -24],
            [-4, -22],
            [1, -12],
            [7, -5],
            [7, -20],
            [36, 5],
            [16, -7],
            [19, -51],
            [11, 6],
            [20, -3],
            [16, 7],
            [10, -10],
            [-5, -32],
            [-6, -20],
            [-2, -42],
            [5, -40],
            [8, -17],
            [1, -13],
            [-14, -30],
            [10, -13],
            [8, -21],
            [8, -58]
        ],
        [
            [3058, 4804],
            [-14, 31],
            [-8, 1],
            [18, 61],
            [-21, 27],
            [-17, -5],
            [-10, 10],
            [-15, -15],
            [-21, 7],
            [-16, 62],
            [-13, 15],
            [-9, 28],
            [-19, 28],
            [-7, -5]
        ],
        [
            [2695, 5543],
            [-15, 14],
            [-6, 12],
            [4, 10],
            [-1, 13],
            [-8, 14],
            [-11, 12],
            [-10, 8],
            [-1, 17],
            [-8, 10],
            [2, -17],
            [-5, -14],
            [-7, 17],
            [-9, 5],
            [-4, 12],
            [1, 18],
            [3, 19],
            [-8, 8],
            [7, 12]
        ],
        [
            [2619, 5713],
            [4, 7],
            [18, -15],
            [7, 7],
            [9, -5],
            [4, -12],
            [8, -4],
            [7, 13]
        ],
        [
            [2676, 5704],
            [7, -32],
            [11, -24],
            [13, -25]
        ],
        [
            [2707, 5623],
            [-11, -6],
            [0, -23],
            [6, -9],
            [-4, -7],
            [1, -11],
            [-2, -12],
            [-2, -12]
        ],
        [
            [2715, 6427],
            [23, -4],
            [22, 0],
            [26, -21],
            [11, -21],
            [26, 6],
            [10, -13],
            [24, -37],
            [17, -27],
            [9, 1],
            [17, -12],
            [-2, -17],
            [20, -2],
            [21, -24],
            [-3, -14],
            [-19, -7],
            [-18, -3],
            [-19, 4],
            [-40, -5],
            [18, 32],
            [-11, 16],
            [-18, 4],
            [-9, 17],
            [-7, 33],
            [-16, -2],
            [-26, 16],
            [-8, 12],
            [-36, 10],
            [-10, 11],
            [11, 15],
            [-28, 3],
            [-20, -31],
            [-11, -1],
            [-4, -14],
            [-14, -7],
            [-12, 6],
            [15, 18],
            [6, 22],
            [13, 13],
            [14, 11],
            [21, 6],
            [7, 6]
        ],
        [
            [5909, 7133],
            [2, 1],
            [4, 14],
            [20, -1],
            [25, 18],
            [-19, -25],
            [2, -11]
        ],
        [
            [5943, 7129],
            [-3, 2],
            [-5, -5],
            [-4, 1],
            [-2, -2],
            [0, 6],
            [-2, 4],
            [-6, 0],
            [-7, -5],
            [-5, 3]
        ],
        [
            [5943, 7129],
            [1, -5],
            [-28, -24],
            [-14, 8],
            [-7, 23],
            [14, 2]
        ],
        [
            [5377, 7945],
            [-16, 25],
            [-14, 15],
            [-3, 25],
            [-5, 17],
            [21, 13],
            [10, 15],
            [20, 11],
            [7, 11],
            [7, -6],
            [13, 6]
        ],
        [
            [5417, 8077],
            [13, -19],
            [21, -5],
            [-2, -17],
            [15, -12],
            [4, 15],
            [19, -6],
            [3, -19],
            [20, -3],
            [13, -29]
        ],
        [
            [5523, 7982],
            [-8, 0],
            [-4, -11],
            [-7, -3],
            [-2, -13],
            [-5, -3],
            [-1, -5],
            [-9, -7],
            [-12, 1],
            [-4, -13]
        ],
        [
            [5275, 8306],
            [1, -23],
            [28, -14],
            [-1, -21],
            [29, 11],
            [15, 16],
            [32, -23],
            [13, -19]
        ],
        [
            [5392, 8233],
            [6, -30],
            [-8, -16],
            [11, -21],
            [6, -31],
            [-2, -21],
            [12, -37]
        ],
        [
            [5207, 7871],
            [3, 42],
            [14, 40],
            [-40, 11],
            [-13, 16]
        ],
        [
            [5171, 7980],
            [2, 26],
            [-6, 13]
        ],
        [
            [5171, 8059],
            [-5, 62],
            [17, 0],
            [7, 22],
            [6, 54],
            [-5, 20]
        ],
        [
            [5191, 8217],
            [6, 13],
            [23, 3],
            [5, -13],
            [19, 29],
            [-6, 22],
            [-2, 34]
        ],
        [
            [5236, 8305],
            [21, -8],
            [18, 9]
        ],
        [
            [6196, 5808],
            [7, -19],
            [-1, -24],
            [-16, -14],
            [12, -16]
        ],
        [
            [6198, 5735],
            [-10, -32]
        ],
        [
            [6188, 5703],
            [-7, 11],
            [-6, -5],
            [-16, 1],
            [0, 18],
            [-2, 17],
            [9, 27],
            [10, 26]
        ],
        [
            [6176, 5798],
            [12, -5],
            [8, 15]
        ],
        [
            [5352, 8343],
            [-17, -48],
            [-29, 33],
            [-4, 25],
            [41, 19],
            [9, -29]
        ],
        [
            [5236, 8305],
            [-11, 32],
            [-1, 61],
            [5, 16],
            [8, 17],
            [24, 4],
            [10, 16],
            [22, 17],
            [-1, -30],
            [-8, -20],
            [4, -16],
            [15, -9],
            [-7, -22],
            [-8, 6],
            [-20, -42],
            [7, -29]
        ],
        [
            [3008, 6222],
            [3, 10],
            [22, 0],
            [16, -15],
            [8, 1],
            [5, -21],
            [15, 1],
            [-1, -17],
            [12, -2],
            [14, -22],
            [-10, -24],
            [-14, 13],
            [-12, -3],
            [-9, 3],
            [-5, -11],
            [-11, -3],
            [-4, 14],
            [-10, -8],
            [-11, -41],
            [-7, 10],
            [-1, 17]
        ],
        [
            [3008, 6124],
            [0, 16],
            [-7, 17],
            [7, 10],
            [2, 23],
            [-2, 32]
        ],
        [
            [5333, 6444],
            [-95, -112],
            [-81, -117],
            [-39, -26]
        ],
        [
            [5118, 6189],
            [-31, -6],
            [0, 38],
            [-13, 10],
            [-17, 16],
            [-7, 28],
            [-94, 129],
            [-93, 129]
        ],
        [
            [4863, 6533],
            [-105, 143]
        ],
        [
            [4758, 6676],
            [1, 11],
            [0, 4]
        ],
        [
            [4759, 6691],
            [0, 70],
            [44, 44],
            [28, 9],
            [23, 16],
            [11, 29],
            [32, 24],
            [1, 44],
            [16, 5],
            [13, 22],
            [36, 9],
            [5, 23],
            [-7, 13],
            [-10, 62],
            [-1, 36],
            [-11, 38]
        ],
        [
            [4939, 7135],
            [27, 32],
            [30, 11],
            [17, 24],
            [27, 18],
            [47, 11],
            [46, 4],
            [14, -8],
            [26, 23],
            [30, 0],
            [11, -13],
            [19, 3]
        ],
        [
            [5233, 7240],
            [-5, -30],
            [4, -56],
            [-6, -49],
            [-18, -33],
            [3, -45],
            [23, -35],
            [0, -14],
            [17, -24],
            [12, -106]
        ],
        [
            [5263, 6848],
            [9, -52],
            [1, -28],
            [-5, -48],
            [2, -27],
            [-3, -32],
            [2, -37],
            [-11, -25],
            [17, -43],
            [1, -25],
            [10, -33],
            [13, 11],
            [22, -28],
            [12, -37]
        ],
        [
            [2769, 4856],
            [15, 45],
            [-6, 25],
            [-11, -27],
            [-16, 26],
            [5, 16],
            [-4, 54],
            [9, 9],
            [5, 37],
            [11, 38],
            [-2, 24],
            [15, 13],
            [19, 23]
        ],
        [
            [2906, 5049],
            [4, -45],
            [-9, -39],
            [-30, -62],
            [-33, -23],
            [-17, -51],
            [-6, -40],
            [-15, -24],
            [-12, 29],
            [-11, 7],
            [-12, -5],
            [-1, 22],
            [8, 14],
            [-3, 24]
        ],
        [
            [5969, 6800],
            [-7, -23],
            [-6, -45],
            [-8, -31],
            [-6, -10],
            [-10, 19],
            [-12, 26],
            [-20, 85],
            [-3, -5],
            [12, -63],
            [17, -59],
            [21, -92],
            [10, -32],
            [9, -34],
            [25, -65],
            [-6, -10],
            [1, -39],
            [33, -53],
            [4, -12]
        ],
        [
            [6023, 6357],
            [-110, 0],
            [-107, 0],
            [-112, 0]
        ],
        [
            [5694, 6357],
            [0, 218],
            [0, 210],
            [-8, 47],
            [7, 37],
            [-5, 25],
            [10, 29]
        ],
        [
            [5698, 6923],
            [37, 0],
            [27, -15],
            [28, -18],
            [13, -9],
            [21, 19],
            [11, 17],
            [25, 5],
            [20, -8],
            [7, -29],
            [7, 19],
            [22, -14],
            [22, -3],
            [13, 15]
        ],
        [
            [5951, 6902],
            [18, -102]
        ],
        [
            [6176, 5798],
            [-10, 20],
            [-11, 34],
            [-12, 19],
            [-8, 21],
            [-24, 23],
            [-19, 1],
            [-7, 12],
            [-16, -14],
            [-17, 27],
            [-8, -44],
            [-33, 13]
        ],
        [
            [6011, 5910],
            [-3, 23],
            [12, 87],
            [3, 39],
            [9, 18],
            [20, 10],
            [14, 34]
        ],
        [
            [6066, 6121],
            [16, -69],
            [8, -54],
            [15, -29],
            [38, -55],
            [16, -34],
            [15, -34],
            [8, -20],
            [14, -18]
        ],
        [
            [4749, 7532],
            [1, 42],
            [-11, 25],
            [39, 43],
            [34, -11],
            [37, 1],
            [30, -10],
            [23, 3],
            [45, -2]
        ],
        [
            [4947, 7623],
            [11, -23],
            [51, -27],
            [10, 13],
            [31, -27],
            [32, 8]
        ],
        [
            [5082, 7567],
            [2, -35],
            [-26, -39],
            [-36, -12],
            [-2, -20],
            [-18, -33],
            [-10, -48],
            [11, -34],
            [-16, -26],
            [-6, -39],
            [-21, -11],
            [-20, -46],
            [-35, -1],
            [-27, 1],
            [-17, -21],
            [-11, -22],
            [-13, 5],
            [-11, 20],
            [-8, 34],
            [-26, 9]
        ],
        [
            [4792, 7249],
            [-2, 20],
            [10, 22],
            [4, 16],
            [-9, 17],
            [7, 39],
            [-11, 36],
            [12, 5],
            [1, 27],
            [5, 9],
            [0, 46],
            [13, 16],
            [-8, 30],
            [-16, 2],
            [-5, -8],
            [-16, 0],
            [-7, 29],
            [-11, -8],
            [-10, -15]
        ],
        [
            [5675, 8472],
            [3, 35],
            [-10, -8],
            [-18, 21],
            [-2, 34],
            [35, 17],
            [35, 8],
            [30, -10],
            [29, 2]
        ],
        [
            [5777, 8571],
            [4, -10],
            [-20, -34],
            [8, -55],
            [-12, -19]
        ],
        [
            [5757, 8453],
            [-22, 0],
            [-24, 22],
            [-13, 7],
            [-23, -10]
        ],
        [
            [6188, 5703],
            [-6, -21],
            [10, -32],
            [10, -29],
            [11, -21],
            [90, -70],
            [24, 0]
        ],
        [
            [6327, 5530],
            [-79, -177],
            [-36, -3],
            [-25, -41],
            [-17, -1],
            [-8, -19]
        ],
        [
            [6162, 5289],
            [-19, 0],
            [-11, 20],
            [-26, -25],
            [-8, -24],
            [-18, 4],
            [-6, 7],
            [-7, -1],
            [-9, 0],
            [-35, 50],
            [-19, 0],
            [-10, 20],
            [0, 33],
            [-14, 10]
        ],
        [
            [5980, 5383],
            [-17, 64],
            [-12, 14],
            [-5, 23],
            [-14, 29],
            [-17, 4],
            [9, 34],
            [15, 2],
            [4, 18]
        ],
        [
            [5943, 5571],
            [0, 53]
        ],
        [
            [5943, 5624],
            [8, 62],
            [13, 16],
            [3, 24],
            [12, 45],
            [17, 30],
            [11, 58],
            [4, 51]
        ],
        [
            [5794, 9138],
            [-4, -42],
            [42, -39],
            [-26, -45],
            [33, -67],
            [-19, -51],
            [25, -43],
            [-11, -39],
            [41, -40],
            [-11, -31],
            [-25, -34],
            [-60, -75]
        ],
        [
            [5779, 8632],
            [-50, -5],
            [-49, -21],
            [-45, -13],
            [-16, 32],
            [-27, 20],
            [6, 58],
            [-14, 53],
            [14, 35],
            [25, 37],
            [63, 64],
            [19, 12],
            [-3, 25],
            [-39, 28]
        ],
        [
            [5663, 8957],
            [-9, 23],
            [-1, 91],
            [-43, 40],
            [-37, 29]
        ],
        [
            [5573, 9140],
            [17, 16],
            [30, -32],
            [37, 3],
            [30, -14],
            [26, 26],
            [14, 44],
            [43, 20],
            [35, -24],
            [-11, -41]
        ],
        [
            [9954, 4033],
            [9, -17],
            [-4, -31],
            [-17, -8],
            [-16, 7],
            [-2, 26],
            [10, 21],
            [13, -8],
            [7, 10]
        ],
        [
            [0, 4079],
            [9981, -14],
            [-17, -13],
            [-4, 23],
            [14, 12],
            [9, 3],
            [-9983, 18]
        ],
        [
            [0, 4108],
            [0, -29]
        ],
        [
            [0, 4108],
            [6, 3],
            [-4, -28],
            [-2, -4]
        ],
        [
            [3300, 1994],
            [33, 36],
            [24, -15],
            [16, 24],
            [22, -27],
            [-8, -21],
            [-37, -17],
            [-13, 20],
            [-23, -26],
            [-14, 26]
        ],
        [
            [5265, 7548],
            [-9, -46],
            [-13, 12],
            [-6, 40],
            [5, 22],
            [18, 22],
            [5, -50]
        ],
        [
            [5157, 7984],
            [6, -6],
            [8, 2]
        ],
        [
            [5190, 7775],
            [-2, -17],
            [9, -22],
            [-10, -18],
            [7, -46],
            [15, -8],
            [-3, -25]
        ],
        [
            [5206, 7639],
            [-25, -34],
            [-55, 16],
            [-40, -19],
            [-4, -35]
        ],
        [
            [4947, 7623],
            [14, 35],
            [5, 118],
            [-28, 62],
            [-21, 30],
            [-42, 23],
            [-3, 43],
            [36, 12],
            [47, -15],
            [-9, 67],
            [26, -25],
            [65, 46],
            [8, 48],
            [24, 12]
        ],
        [
            [3485, 5194],
            [7, 25],
            [3, 27]
        ],
        [
            [3495, 5246],
            [4, 26],
            [-10, 34]
        ],
        [
            [3489, 5306],
            [-3, 41],
            [15, 51]
        ],
        [
            [3501, 5398],
            [9, -7],
            [21, -14],
            [29, -50],
            [5, -24]
        ],
        [
            [5308, 4822],
            [-29, 60],
            [-18, 49],
            [-17, 61],
            [1, 19],
            [6, 19],
            [7, 43],
            [5, 44]
        ],
        [
            [5263, 5117],
            [10, 4],
            [40, -1],
            [0, 71]
        ],
        [
            [4827, 8240],
            [-21, 12],
            [-17, -1],
            [6, 32],
            [-6, 32]
        ],
        [
            [4789, 8315],
            [23, 2],
            [30, -37],
            [-15, -40]
        ],
        [
            [4916, 8521],
            [-30, -63],
            [29, 8],
            [30, -1],
            [-7, -48],
            [-25, -53],
            [29, -4],
            [2, -6],
            [25, -69],
            [19, -10],
            [17, -67],
            [8, -24],
            [33, -11],
            [-3, -38],
            [-14, -17],
            [11, -30],
            [-25, -31],
            [-37, 0],
            [-48, -16],
            [-13, 12],
            [-18, -28],
            [-26, 7],
            [-19, -23],
            [-15, 12],
            [41, 62],
            [25, 13],
            [-1, 0],
            [-43, 9],
            [-8, 24],
            [29, 18],
            [-15, 32],
            [5, 39],
            [42, -6],
            [4, 35],
            [-19, 36],
            [0, 1],
            [-34, 10],
            [-7, 16],
            [10, 27],
            [-9, 16],
            [-15, -28],
            [-1, 57],
            [-14, 30],
            [10, 61],
            [21, 48],
            [23, -4],
            [33, 4]
        ],
        [
            [6154, 7511],
            [4, 26],
            [-7, 40],
            [-16, 22],
            [-16, 6],
            [-10, 19]
        ],
        [
            [6109, 7624],
            [4, 6],
            [23, -10],
            [41, -9],
            [38, -28],
            [5, -11],
            [17, 9],
            [25, -13],
            [9, -24],
            [17, -13]
        ],
        [
            [6210, 7485],
            [-27, 29],
            [-29, -3]
        ],
        [
            [5029, 5408],
            [-44, -35],
            [-15, -20],
            [-25, -17],
            [-25, 17]
        ],
        [
            [5000, 5708],
            [-2, -18],
            [12, -30],
            [0, -43],
            [2, -47],
            [7, -21],
            [-6, -54],
            [2, -29],
            [8, -37],
            [6, -21]
        ],
        [
            [4765, 5512],
            [-8, 1],
            [-5, -24],
            [-8, 1],
            [-6, 12],
            [2, 24],
            [-11, 36],
            [-8, -7],
            [-6, -1]
        ],
        [
            [4715, 5554],
            [-7, -3],
            [0, 21],
            [-4, 16],
            [0, 17],
            [-6, 25],
            [-7, 21],
            [-23, 0],
            [-6, -11],
            [-8, -1],
            [-4, -13],
            [-4, -17],
            [-14, -26]
        ],
        [
            [4632, 5583],
            [-13, 35],
            [-10, 24],
            [-8, 7],
            [-6, 12],
            [-4, 26],
            [-4, 13],
            [-8, 10]
        ],
        [
            [4579, 5710],
            [13, 29],
            [8, -2],
            [7, 10],
            [6, 0],
            [5, 8],
            [-3, 20],
            [3, 6],
            [1, 20]
        ],
        [
            [4619, 5801],
            [13, -1],
            [20, -14],
            [6, 1],
            [3, 7],
            [15, -5],
            [4, 4]
        ],
        [
            [4680, 5793],
            [1, -22],
            [5, 0],
            [7, 8],
            [5, -2],
            [7, -15],
            [12, -5],
            [8, 13],
            [9, 8],
            [6, 8],
            [6, -1],
            [6, -13],
            [3, -17],
            [12, -24],
            [-6, -16],
            [-1, -19],
            [6, 6],
            [3, -7],
            [-1, -17],
            [8, -18]
        ],
        [
            [4532, 5834],
            [3, 27]
        ],
        [
            [4535, 5861],
            [31, 1],
            [6, 14],
            [9, 1],
            [11, -14],
            [8, -1],
            [9, 10],
            [6, -17],
            [-12, -13],
            [-12, 1],
            [-12, 13],
            [-10, -14],
            [-5, -1],
            [-7, -8],
            [-25, 1]
        ],
        [
            [4579, 5710],
            [-15, 24],
            [-11, 4],
            [-7, 17],
            [1, 9],
            [-9, 13],
            [-2, 12]
        ],
        [
            [4536, 5789],
            [15, 10],
            [9, -2],
            [8, 7],
            [51, -3]
        ],
        [
            [5263, 5117],
            [-5, 9],
            [10, 66]
        ],
        [
            [5658, 7167],
            [15, -20],
            [22, 3],
            [20, -4],
            [0, -10],
            [15, 7],
            [-4, -18],
            [-40, -5],
            [1, 10],
            [-34, 12],
            [5, 25]
        ],
        [
            [5723, 7469],
            [-17, 2],
            [-14, 6],
            [-34, -16],
            [19, -33],
            [-14, -10],
            [-15, 0],
            [-15, 31],
            [-5, -13],
            [6, -36],
            [14, -27],
            [-10, -13],
            [15, -27],
            [14, -18],
            [0, -33],
            [-25, 16],
            [8, -30],
            [-18, -7],
            [11, -52],
            [-19, -1],
            [-23, 26],
            [-10, 47],
            [-5, 40],
            [-11, 27],
            [-14, 34],
            [-2, 16]
        ],
        [
            [5583, 7470],
            [18, 6],
            [11, 13],
            [15, -2],
            [5, 11],
            [5, 2]
        ],
        [
            [5725, 7529],
            [13, -16],
            [-8, -37],
            [-7, -7]
        ],
        [
            [3701, 9939],
            [93, 35],
            [97, -2],
            [36, 21],
            [98, 6],
            [222, -7],
            [174, -47],
            [-52, -23],
            [-106, -3],
            [-150, -5],
            [14, -11],
            [99, 7],
            [83, -21],
            [54, 18],
            [23, -21],
            [-30, -34],
            [71, 22],
            [135, 23],
            [83, -12],
            [15, -25],
            [-113, -42],
            [-16, -14],
            [-88, -10],
            [64, -3],
            [-32, -43],
            [-23, -38],
            [1, -66],
            [33, -38],
            [-43, -3],
            [-46, -19],
            [52, -31],
            [6, -50],
            [-30, -6],
            [36, -50],
            [-61, -5],
            [32, -24],
            [-9, -20],
            [-39, -10],
            [-39, 0],
            [35, -40],
            [0, -26],
            [-55, 24],
            [-14, -15],
            [37, -15],
            [37, -36],
            [10, -48],
            [-49, -11],
            [-22, 22],
            [-34, 34],
            [10, -40],
            [-33, -31],
            [73, -2],
            [39, -3],
            [-75, -52],
            [-75, -46],
            [-81, -21],
            [-31, 0],
            [-29, -23],
            [-38, -62],
            [-60, -42],
            [-19, -2],
            [-37, -15],
            [-40, -13],
            [-24, -37],
            [0, -41],
            [-15, -39],
            [-45, -47],
            [11, -47],
            [-12, -48],
            [-14, -58],
            [-39, -4],
            [-41, 49],
            [-56, 0],
            [-27, 32],
            [-18, 58],
            [-49, 73],
            [-14, 39],
            [-3, 53],
            [-39, 54],
            [10, 44],
            [-18, 21],
            [27, 69],
            [42, 22],
            [11, 25],
            [6, 46],
            [-32, -21],
            [-15, -9],
            [-25, -8],
            [-34, 19],
            [-2, 40],
            [11, 31],
            [25, 1],
            [57, -15],
            [-48, 37],
            [-24, 20],
            [-28, -8],
            [-23, 15],
            [31, 55],
            [-17, 22],
            [-22, 41],
            [-34, 62],
            [-35, 23],
            [0, 25],
            [-74, 34],
            [-59, 5],
            [-74, -3],
            [-68, -4],
            [-32, 19],
            [-49, 37],
            [73, 19],
            [56, 3],
            [-119, 15],
            [-62, 24],
            [3, 23],
            [106, 28],
            [101, 29],
            [11, 21],
            [-75, 22],
            [24, 23],
            [97, 41],
            [40, 7],
            [-12, 26],
            [66, 16],
            [86, 9],
            [85, 1],
            [30, -19],
            [74, 33],
            [66, -22],
            [39, -5],
            [58, -19],
            [-66, 32],
            [4, 25]
        ],
        [
            [2497, 5869],
            [-14, 10],
            [-17, 1],
            [-13, 12],
            [-15, 24]
        ],
        [
            [2438, 5916],
            [1, 18],
            [3, 13],
            [-4, 12],
            [13, 48],
            [36, 0],
            [1, 20],
            [-5, 4],
            [-3, 12],
            [-10, 14],
            [-11, 20],
            [13, 0],
            [0, 33],
            [26, 0],
            [26, 0]
        ],
        [
            [2529, 5996],
            [10, -11],
            [2, 9],
            [8, -7]
        ],
        [
            [2549, 5987],
            [-13, -23],
            [-13, -16],
            [-2, -12],
            [2, -11],
            [-5, -15]
        ],
        [
            [2518, 5910],
            [-7, -4],
            [2, -7],
            [-6, -6],
            [-9, -15],
            [-1, -9]
        ],
        [
            [3340, 5552],
            [18, -22],
            [17, -38],
            [1, -31],
            [10, -1],
            [15, -29],
            [11, -21]
        ],
        [
            [3412, 5410],
            [-4, -53],
            [-17, -15],
            [1, -14],
            [-5, -31],
            [13, -42],
            [9, -1],
            [3, -33],
            [17, -51]
        ],
        [
            [3313, 5365],
            [-19, 45],
            [7, 16],
            [0, 27],
            [17, 10],
            [7, 11],
            [-10, 22],
            [3, 21],
            [22, 35]
        ],
        [
            [2574, 5825],
            [-5, 18],
            [-8, 5]
        ],
        [
            [2561, 5848],
            [2, 24],
            [-4, 6],
            [-6, 4],
            [-12, -7],
            [-1, 8],
            [-8, 10],
            [-6, 12],
            [-8, 5]
        ],
        [
            [2549, 5987],
            [3, -3],
            [6, 11],
            [8, 1],
            [3, -5],
            [4, 3],
            [13, -6],
            [13, 2],
            [9, 6],
            [3, 7],
            [9, -3],
            [6, -4],
            [8, 1],
            [5, 5],
            [13, -8],
            [4, -1],
            [9, -11],
            [8, -13],
            [10, -9],
            [7, -17]
        ],
        [
            [2690, 5943],
            [-9, 2],
            [-4, -8],
            [-10, -8],
            [-7, 0],
            [-6, -8],
            [-6, 3],
            [-4, 9],
            [-3, -2],
            [-4, -14],
            [-3, 1],
            [0, -12],
            [-10, -17],
            [-5, -7],
            [-3, -7],
            [-8, 12],
            [-6, -16],
            [-6, 1],
            [-6, -2],
            [0, -29],
            [-4, 0],
            [-3, -14],
            [-9, -2]
        ],
        [
            [5522, 7770],
            [7, -23],
            [9, -17],
            [-11, -22]
        ],
        [
            [5515, 7577],
            [-3, -10]
        ],
        [
            [5512, 7567],
            [-26, 22],
            [-16, 21],
            [-26, 18],
            [-23, 43],
            [6, 5],
            [-13, 25],
            [-1, 19],
            [-17, 10],
            [-9, -26],
            [-8, 20],
            [0, 21],
            [1, 1]
        ],
        [
            [5380, 7746],
            [20, -2],
            [5, 9],
            [9, -9],
            [11, -1],
            [0, 16],
            [10, 6],
            [2, 24],
            [23, 16]
        ],
        [
            [5460, 7805],
            [8, -7],
            [21, -26],
            [23, -11],
            [10, 9]
        ],
        [
            [3008, 6124],
            [-19, 10],
            [-13, -5],
            [-17, 5],
            [-13, -11],
            [-15, 18],
            [3, 19],
            [25, -8],
            [21, -5],
            [10, 13],
            [-12, 26],
            [0, 23],
            [-18, 9],
            [7, 16],
            [17, -3],
            [24, -9]
        ],
        [
            [5471, 7900],
            [14, -15],
            [10, -6],
            [24, 7],
            [2, 12],
            [11, 2],
            [14, 9],
            [3, -4],
            [13, 8],
            [6, 13],
            [9, 4],
            [30, -18],
            [6, 6]
        ],
        [
            [5613, 7918],
            [15, -16],
            [2, -16]
        ],
        [
            [5630, 7886],
            [-17, -12],
            [-13, -40],
            [-17, -40],
            [-22, -11]
        ],
        [
            [5561, 7783],
            [-17, 2],
            [-22, -15]
        ],
        [
            [5460, 7805],
            [-6, 20],
            [-4, 0]
        ],
        [
            [8352, 4453],
            [-11, -2],
            [-37, 42],
            [26, 11],
            [14, -18],
            [10, -17],
            [-2, -16]
        ],
        [
            [8471, 4532],
            [2, -11],
            [1, -18]
        ],
        [
            [8474, 4503],
            [-18, -45],
            [-24, -13],
            [-3, 8],
            [2, 20],
            [12, 36],
            [28, 23]
        ],
        [
            [8274, 4579],
            [10, -16],
            [17, 5],
            [7, -25],
            [-32, -12],
            [-19, -8],
            [-15, 1],
            [10, 34],
            [15, 0],
            [7, 21]
        ],
        [
            [8413, 4579],
            [-4, -32],
            [-42, -17],
            [-37, 7],
            [0, 22],
            [22, 12],
            [18, -18],
            [18, 5],
            [25, 21]
        ],
        [
            [8017, 4657],
            [53, -6],
            [6, 25],
            [51, -29],
            [10, -38],
            [42, -11],
            [34, -35],
            [-31, -23],
            [-31, 24],
            [-25, -1],
            [-29, 4],
            [-26, 11],
            [-32, 22],
            [-21, 6],
            [-11, -7],
            [-51, 24],
            [-5, 25],
            [-25, 5],
            [19, 56],
            [34, -3],
            [22, -23],
            [12, -5],
            [4, -21]
        ],
        [
            [8741, 4690],
            [-14, -40],
            [-3, 45],
            [5, 21],
            [6, 20],
            [7, -17],
            [-1, -29]
        ],
        [
            [8534, 4853],
            [-11, -19],
            [-19, 10],
            [-5, 26],
            [28, 3],
            [7, -20]
        ],
        [
            [8623, 4875],
            [10, -45],
            [-23, 24],
            [-23, 5],
            [-16, -4],
            [-19, 2],
            [6, 33],
            [35, 2],
            [30, -17]
        ],
        [
            [8916, 4904],
            [0, -193],
            [1, -192]
        ],
        [
            [8917, 4519],
            [-25, 48],
            [-28, 12],
            [-7, -17],
            [-35, -1],
            [12, 48],
            [17, 16],
            [-7, 64],
            [-14, 50],
            [-53, 50],
            [-23, 5],
            [-42, 54],
            [-8, -28],
            [-11, -5],
            [-6, 21],
            [0, 26],
            [-21, 29],
            [29, 21],
            [20, -1],
            [-2, 16],
            [-41, 0],
            [-11, 35],
            [-25, 11],
            [-11, 29],
            [37, 14],
            [14, 20],
            [45, -25],
            [4, -22],
            [8, -95],
            [29, -35],
            [23, 62],
            [32, 36],
            [25, 0],
            [23, -21],
            [21, -21],
            [30, -11]
        ],
        [
            [8478, 5141],
            [-22, -58],
            [-21, -12],
            [-27, 12],
            [-46, -3],
            [-24, -8],
            [-4, -45],
            [24, -53],
            [15, 27],
            [52, 20],
            [-2, -27],
            [-12, 9],
            [-12, -35],
            [-25, -23],
            [27, -76],
            [-5, -20],
            [25, -68],
            [-1, -39],
            [-14, -17],
            [-11, 20],
            [13, 49],
            [-27, -23],
            [-7, 16],
            [3, 23],
            [-20, 35],
            [3, 57],
            [-19, -18],
            [2, -69],
            [1, -84],
            [-17, -9],
            [-12, 18],
            [8, 54],
            [-4, 57],
            [-12, 1],
            [-9, 40],
            [12, 39],
            [4, 47],
            [14, 89],
            [5, 24],
            [24, 44],
            [22, -18],
            [35, -8],
            [32, 3],
            [27, 43],
            [5, -14]
        ],
        [
            [8574, 5124],
            [-2, -51],
            [-14, 6],
            [-4, -36],
            [11, -32],
            [-8, -7],
            [-11, 38],
            [-8, 75],
            [6, 47],
            [9, 22],
            [2, -32],
            [16, -5],
            [3, -25]
        ],
        [
            [8045, 5176],
            [5, -39],
            [19, -34],
            [18, 12],
            [18, -4],
            [16, 30],
            [13, 5],
            [26, -17],
            [23, 13],
            [14, 82],
            [11, 21],
            [10, 67],
            [32, 0],
            [24, -10]
        ],
        [
            [8274, 5302],
            [-16, -53],
            [20, -56],
            [-5, -28],
            [32, -54],
            [-33, -7],
            [-10, -40],
            [2, -54],
            [-27, -40],
            [-1, -59],
            [-10, -91],
            [-5, 21],
            [-31, -26],
            [-11, 36],
            [-20, 3],
            [-14, 19],
            [-33, -21],
            [-10, 29],
            [-18, -4],
            [-23, 7],
            [-4, 79],
            [-14, 17],
            [-13, 50],
            [-4, 52],
            [3, 55],
            [16, 39]
        ],
        [
            [7939, 4712],
            [-31, -1],
            [-24, 49],
            [-35, 48],
            [-12, 36],
            [-21, 48],
            [-14, 44],
            [-21, 83],
            [-24, 49],
            [-9, 51],
            [-10, 46],
            [-25, 37],
            [-14, 51],
            [-21, 33],
            [-29, 65],
            [-3, 30],
            [18, -2],
            [43, -12],
            [25, -57],
            [21, -40],
            [16, -25],
            [26, -63],
            [28, -1],
            [23, -41],
            [16, -49],
            [22, -27],
            [-12, -49],
            [16, -20],
            [10, -2],
            [5, -41],
            [10, -33],
            [20, -5],
            [14, -37],
            [-7, -74],
            [-1, -91]
        ],
        [
            [7252, 6841],
            [-17, -27],
            [-11, -55],
            [27, -23],
            [26, -29],
            [36, -33],
            [38, -8],
            [16, -30],
            [22, -5],
            [33, -14],
            [23, 1],
            [4, 23],
            [-4, 38],
            [2, 25]
        ],
        [
            [7703, 6727],
            [2, -22],
            [-10, -11],
            [2, -36],
            [-19, 10],
            [-36, -41],
            [0, -33],
            [-15, -50],
            [-1, -29],
            [-13, -48],
            [-21, 13],
            [-1, -61],
            [-7, -20],
            [3, -25],
            [-14, -14]
        ],
        [
            [7472, 6360],
            [-4, -21],
            [-19, 1],
            [-34, -13],
            [2, -44],
            [-15, -35],
            [-40, -40],
            [-31, -69],
            [-21, -38],
            [-28, -38],
            [0, -27],
            [-13, -15],
            [-26, -21],
            [-12, -3],
            [-9, -45],
            [6, -77],
            [1, -49],
            [-11, -56],
            [0, -101],
            [-15, -2],
            [-12, -46],
            [8, -19],
            [-25, -17],
            [-10, -40],
            [-11, -17],
            [-26, 55],
            [-13, 83],
            [-11, 60],
            [-9, 28],
            [-15, 56],
            [-7, 74],
            [-5, 37],
            [-25, 81],
            [-12, 115],
            [-8, 75],
            [0, 72],
            [-5, 55],
            [-41, -35],
            [-19, 7],
            [-36, 71],
            [13, 22],
            [-8, 23],
            [-33, 50]
        ],
        [
            [6893, 6457],
            [19, 40],
            [61, -1],
            [-6, 51],
            [-15, 30],
            [-4, 46],
            [-18, 26],
            [31, 62],
            [32, -4],
            [29, 61],
            [18, 60],
            [27, 60],
            [-1, 42],
            [24, 34],
            [-23, 29],
            [-9, 40],
            [-10, 52],
            [14, 25],
            [42, -14],
            [31, 9],
            [26, 49]
        ],
        [
            [4827, 8240],
            [5, -42],
            [-21, -53],
            [-49, -35],
            [-40, 9],
            [23, 62],
            [-15, 60],
            [38, 46],
            [21, 28]
        ],
        [
            [6497, 7255],
            [25, 12],
            [19, 33],
            [19, -1],
            [12, 11],
            [20, -6],
            [31, -30],
            [22, -6],
            [31, -53],
            [21, -2],
            [3, -49]
        ],
        [
            [6690, 6820],
            [14, -31],
            [11, -36],
            [27, -26],
            [1, -52],
            [13, -10],
            [2, -27],
            [-40, -30],
            [-10, -69]
        ],
        [
            [6708, 6539],
            [-53, 18],
            [-30, 13],
            [-31, 8],
            [-12, 73],
            [-13, 10],
            [-22, -11],
            [-28, -28],
            [-34, 20],
            [-28, 45],
            [-27, 17],
            [-18, 56],
            [-21, 79],
            [-15, -10],
            [-17, 20],
            [-11, -24]
        ],
        [
            [6348, 6825],
            [-15, 32],
            [0, 31],
            [-9, 0],
            [5, 43],
            [-15, 45],
            [-34, 32],
            [-19, 56],
            [6, 46],
            [14, 21],
            [-2, 34],
            [-18, 18],
            [-18, 70]
        ],
        [
            [6243, 7253],
            [-15, 48],
            [5, 18],
            [-8, 68],
            [19, 17]
        ],
        [
            [6357, 7321],
            [9, -43],
            [26, -13],
            [20, -29],
            [39, -10],
            [44, 15],
            [2, 14]
        ],
        [
            [6348, 6825],
            [-16, 3]
        ],
        [
            [6332, 6828],
            [-19, 5],
            [-20, -56]
        ],
        [
            [6293, 6777],
            [-52, 4],
            [-78, 119],
            [-41, 41],
            [-34, 16]
        ],
        [
            [6088, 6957],
            [-11, 72]
        ],
        [
            [6077, 7029],
            [61, 62],
            [11, 71],
            [-3, 43],
            [16, 15],
            [14, 37]
        ],
        [
            [6176, 7257],
            [12, 9],
            [32, -8],
            [10, -15],
            [13, 10]
        ],
        [
            [4597, 8984],
            [-7, -39],
            [31, -40],
            [-36, -45],
            [-80, -41],
            [-24, -10],
            [-36, 8],
            [-78, 19],
            [28, 26],
            [-61, 29],
            [49, 12],
            [-1, 17],
            [-58, 14],
            [19, 38],
            [42, 9],
            [43, -40],
            [42, 32],
            [35, -17],
            [45, 32],
            [47, -4]
        ],
        [
            [5992, 6990],
            [-5, -19]
        ],
        [
            [5987, 6971],
            [-10, 8],
            [-6, -39],
            [7, -7],
            [-7, -8],
            [-1, -15],
            [13, 8]
        ],
        [
            [5983, 6918],
            [0, -23],
            [-14, -95]
        ],
        [
            [5951, 6902],
            [8, 19],
            [-2, 4],
            [8, 27],
            [5, 45],
            [4, 15],
            [1, 0]
        ],
        [
            [5975, 7012],
            [9, 0],
            [3, 11],
            [7, 0]
        ],
        [
            [5994, 7023],
            [1, -24],
            [-4, -9],
            [1, 0]
        ],
        [
            [5431, 7316],
            [-10, -46],
            [4, -19],
            [-6, -30],
            [-21, 22],
            [-14, 7],
            [-39, 30],
            [4, 30],
            [32, -6],
            [28, 7],
            [22, 5]
        ],
        [
            [5255, 7492],
            [17, -42],
            [-4, -78],
            [-13, 4],
            [-11, -20],
            [-10, 16],
            [-2, 71],
            [-6, 34],
            [15, -3],
            [14, 18]
        ],
        [
            [5383, 7805],
            [-3, -29],
            [7, -25]
        ],
        [
            [5387, 7751],
            [-22, 8],
            [-23, -20],
            [1, -30],
            [-3, -17],
            [9, -30],
            [26, -29],
            [14, -49],
            [31, -48],
            [22, 0],
            [7, -13],
            [-8, -11],
            [25, -22],
            [20, -18],
            [24, -30],
            [3, -11],
            [-5, -22],
            [-16, 28],
            [-24, 10],
            [-12, -39],
            [20, -21],
            [-3, -31],
            [-11, -4],
            [-15, -50],
            [-12, -5],
            [0, 18],
            [6, 32],
            [6, 12],
            [-11, 35],
            [-8, 29],
            [-12, 8],
            [-8, 25],
            [-18, 11],
            [-12, 24],
            [-21, 4],
            [-21, 26],
            [-26, 39],
            [-19, 34],
            [-8, 58],
            [-14, 7],
            [-23, 20],
            [-12, -8],
            [-16, -28],
            [-12, -4]
        ],
        [
            [2845, 6150],
            [19, -5],
            [14, -15],
            [5, -16],
            [-19, -1],
            [-9, -10],
            [-15, 10],
            [-16, 21],
            [3, 14],
            [12, 4],
            [6, -2]
        ],
        [
            [5992, 6990],
            [31, -24],
            [54, 63]
        ],
        [
            [6088, 6957],
            [-5, -8],
            [-56, -30],
            [28, -59],
            [-9, -10],
            [-5, -20],
            [-21, -8],
            [-7, -21],
            [-12, -19],
            [-31, 10]
        ],
        [
            [5970, 6792],
            [-1, 8]
        ],
        [
            [5983, 6918],
            [4, 17],
            [0, 36]
        ],
        [
            [8739, 7075],
            [4, -20],
            [-16, -36],
            [-11, 19],
            [-15, -14],
            [-7, -34],
            [-18, 16],
            [0, 28],
            [15, 36],
            [16, -7],
            [12, 25],
            [20, -13]
        ],
        [
            [8915, 7252],
            [-10, -47],
            [4, -30],
            [-14, -42],
            [-35, -27],
            [-49, -4],
            [-40, -67],
            [-19, 22],
            [-1, 44],
            [-48, -13],
            [-33, -27],
            [-32, -2],
            [28, -43],
            [-19, -101],
            [-18, -24],
            [-13, 23],
            [7, 53],
            [-18, 17],
            [-11, 41],
            [26, 18],
            [15, 37],
            [28, 30],
            [20, 41],
            [55, 17],
            [30, -12],
            [29, 105],
            [19, -28],
            [40, 59],
            [16, 23],
            [18, 72],
            [-5, 67],
            [11, 37],
            [30, 11],
            [15, -82],
            [-1, -48],
            [-25, -59],
            [0, -61]
        ],
        [
            [8997, 7667],
            [19, -12],
            [20, 25],
            [6, -67],
            [-41, -16],
            [-25, -59],
            [-43, 41],
            [-15, -65],
            [-31, -1],
            [-4, 59],
            [14, 46],
            [29, 3],
            [8, 82],
            [9, 46],
            [32, -62],
            [22, -20]
        ],
        [
            [6970, 7554],
            [-15, -10],
            [-37, -42],
            [-12, -42],
            [-11, 0],
            [-7, 28],
            [-36, 2],
            [-5, 48],
            [-14, 0],
            [2, 60],
            [-33, 43],
            [-48, -5],
            [-32, -8],
            [-27, 53],
            [-22, 22],
            [-43, 43],
            [-6, 5],
            [-71, -35],
            [1, -218]
        ],
        [
            [6554, 7498],
            [-14, -3],
            [-20, 46],
            [-18, 17],
            [-32, -12],
            [-12, -20]
        ],
        [
            [6458, 7526],
            [-2, 14],
            [7, 25],
            [-5, 21],
            [-32, 20],
            [-13, 53],
            [-15, 15],
            [-1, 19],
            [27, -6],
            [1, 44],
            [23, 9],
            [25, -9],
            [5, 58],
            [-5, 36],
            [-28, -2],
            [-24, 14],
            [-32, -26],
            [-26, -12]
        ],
        [
            [6363, 7799],
            [-14, 9],
            [3, 31],
            [-18, 39],
            [-20, -2],
            [-24, 40],
            [16, 45],
            [-8, 12],
            [22, 65],
            [29, -34],
            [3, 43],
            [58, 64],
            [43, 2],
            [61, -41],
            [33, -24],
            [30, 25],
            [44, 1],
            [35, -30],
            [8, 17],
            [39, -2],
            [7, 28],
            [-45, 40],
            [27, 29],
            [-5, 16],
            [26, 15],
            [-20, 41],
            [13, 20],
            [104, 21],
            [13, 14],
            [70, 22],
            [25, 24],
            [50, -12],
            [9, -61],
            [29, 14],
            [35, -20],
            [-2, -32],
            [27, 3],
            [69, 56],
            [-10, -19],
            [35, -46],
            [62, -150],
            [15, 31],
            [39, -34],
            [39, 16],
            [16, -11],
            [13, -34],
            [20, -12],
            [11, -25],
            [36, 8],
            [15, -36]
        ],
        [
            [7229, 7559],
            [-17, 9],
            [-14, 21],
            [-42, 6],
            [-46, 2],
            [-10, -6],
            [-39, 24],
            [-16, -12],
            [-4, -35],
            [-46, 21],
            [-18, -9],
            [-7, -26]
        ],
        [
            [6155, 4958],
            [-20, -24],
            [-7, -24],
            [-10, -4],
            [-4, -42],
            [-9, -24],
            [-5, -39],
            [-12, -20]
        ],
        [
            [6088, 4781],
            [-40, 59],
            [-1, 35],
            [-101, 120],
            [-5, 6]
        ],
        [
            [5941, 5001],
            [0, 63],
            [8, 24],
            [14, 39],
            [10, 43],
            [-13, 68],
            [-3, 30],
            [-13, 41]
        ],
        [
            [5944, 5309],
            [17, 35],
            [19, 39]
        ],
        [
            [6162, 5289],
            [-24, -67],
            [0, -215],
            [17, -49]
        ],
        [
            [7046, 7387],
            [-53, -9],
            [-34, 19],
            [-30, -4],
            [3, 34],
            [30, -10],
            [10, 18]
        ],
        [
            [6972, 7435],
            [21, -6],
            [36, 43],
            [-33, 31],
            [-20, -15],
            [-21, 22],
            [24, 39],
            [-9, 5]
        ],
        [
            [7849, 5777],
            [-7, 72],
            [18, 49],
            [36, 11],
            [26, -8]
        ],
        [
            [7922, 5901],
            [23, -23],
            [12, 40],
            [25, -21]
        ],
        [
            [7982, 5897],
            [6, -40],
            [-3, -71],
            [-47, -45],
            [13, -36],
            [-30, -4],
            [-24, -24]
        ],
        [
            [7897, 5677],
            [-23, 9],
            [-11, 30],
            [-14, 61]
        ],
        [
            [8564, 7339],
            [24, -70],
            [7, -38],
            [0, -68],
            [-10, -33],
            [-25, -11],
            [-22, -25],
            [-25, -5],
            [-3, 32],
            [5, 45],
            [-13, 61],
            [21, 10],
            [-19, 51]
        ],
        [
            [8504, 7288],
            [2, 5],
            [12, -2],
            [11, 27],
            [20, 2],
            [11, 4],
            [4, 15]
        ],
        [
            [5557, 7574],
            [5, 13]
        ],
        [
            [5562, 7587],
            [7, 4],
            [4, 20],
            [5, 3],
            [4, -8],
            [5, -4],
            [3, -10],
            [5, -2],
            [5, -11],
            [4, 0],
            [-3, -14],
            [-3, -7],
            [1, -5]
        ],
        [
            [5599, 7553],
            [-6, -2],
            [-17, -9],
            [-1, -12],
            [-4, 0]
        ],
        [
            [6332, 6828],
            [6, -26],
            [-3, -13],
            [9, -45]
        ],
        [
            [6344, 6744],
            [-19, -1],
            [-7, 28],
            [-25, 6]
        ],
        [
            [7922, 5901],
            [9, 26],
            [1, 50],
            [-22, 52],
            [-2, 58],
            [-21, 48],
            [-21, 4],
            [-6, -20],
            [-16, -2],
            [-8, 10],
            [-30, -35],
            [0, 53],
            [7, 62],
            [-19, 3],
            [-2, 36],
            [-12, 18]
        ],
        [
            [7780, 6264],
            [6, 21],
            [24, 39]
        ],
        [
            [7837, 6385],
            [17, -47],
            [12, -54],
            [34, 0],
            [11, -52],
            [-18, -15],
            [-8, -21],
            [34, -36],
            [23, -70],
            [17, -52],
            [21, -41],
            [7, -41],
            [-5, -59]
        ],
        [
            [5975, 7012],
            [10, 49],
            [14, 41],
            [0, 2]
        ],
        [
            [5999, 7104],
            [13, -3],
            [4, -23],
            [-15, -22],
            [-7, -33]
        ],
        [
            [4785, 5315],
            [-7, 0],
            [-29, 28],
            [-25, 45],
            [-24, 32],
            [-18, 38]
        ],
        [
            [4682, 5458],
            [6, 19],
            [2, 17],
            [12, 33],
            [13, 27]
        ],
        [
            [5412, 6408],
            [-20, -22],
            [-15, 33],
            [-44, 25]
        ],
        [
            [5263, 6848],
            [13, 14],
            [3, 25],
            [-3, 24],
            [19, 23],
            [8, 19],
            [14, 17],
            [2, 45]
        ],
        [
            [5319, 7015],
            [32, -20],
            [12, 5],
            [23, -10],
            [37, -26],
            [13, -53],
            [25, -11],
            [39, -25],
            [30, -29],
            [13, 15],
            [13, 27],
            [-6, 45],
            [9, 29],
            [20, 28],
            [19, 8],
            [37, -12],
            [10, -27],
            [10, 0],
            [9, -10],
            [28, -7],
            [6, -19]
        ],
        [
            [5694, 6357],
            [0, -118],
            [-32, 0],
            [0, -25]
        ],
        [
            [5662, 6214],
            [-111, 113],
            [-111, 113],
            [-28, -32]
        ],
        [
            [7271, 5502],
            [-4, -62],
            [-12, -16],
            [-24, -14],
            [-13, 47],
            [-5, 85],
            [13, 96],
            [19, -33],
            [13, -42],
            [13, -61]
        ],
        [
            [5804, 3347],
            [10, -18],
            [-9, -29],
            [-4, -19],
            [-16, -9],
            [-5, -19],
            [-10, -6],
            [-21, 46],
            [15, 37],
            [15, 23],
            [13, 12],
            [12, -18]
        ],
        [
            [5631, 8267],
            [-2, 15],
            [3, 16],
            [-13, 10],
            [-29, 10]
        ],
        [
            [5590, 8318],
            [-6, 50]
        ],
        [
            [5584, 8368],
            [32, 18],
            [47, -4],
            [27, 6],
            [4, -12],
            [15, -4],
            [26, -29]
        ],
        [
            [5652, 8242],
            [-7, 19],
            [-14, 6]
        ],
        [
            [5584, 8368],
            [1, 44],
            [14, 37],
            [26, 20],
            [22, -44],
            [22, 1],
            [6, 46]
        ],
        [
            [5757, 8453],
            [14, -14],
            [2, -28],
            [9, -35]
        ],
        [
            [4759, 6691],
            [-4, 0],
            [0, -31],
            [-17, -2],
            [-9, -14],
            [-13, 0],
            [-10, 8],
            [-23, -6],
            [-9, -46],
            [-9, -5],
            [-13, -74],
            [-38, -64],
            [-9, -81],
            [-12, -27],
            [-3, -21],
            [-63, -5]
        ],
        [
            [4527, 6323],
            [1, 27],
            [11, 17],
            [9, 30],
            [-2, 20],
            [10, 42],
            [15, 38],
            [9, 9],
            [8, 35],
            [0, 31],
            [10, 37],
            [19, 21],
            [18, 60],
            [0, 1],
            [14, 23],
            [26, 6],
            [22, 41],
            [14, 16],
            [23, 49],
            [-7, 73],
            [10, 51],
            [4, 31],
            [18, 40],
            [28, 27],
            [21, 25],
            [18, 61],
            [9, 36],
            [20, 0],
            [17, -25],
            [26, 4],
            [29, -13],
            [12, -1]
        ],
        [
            [5739, 7906],
            [6, 9],
            [19, 6],
            [20, -19],
            [12, -2],
            [12, -16],
            [-2, -20],
            [11, -9],
            [4, -25],
            [9, -15],
            [-2, -9],
            [5, -6],
            [-7, -4],
            [-16, 1],
            [-3, 9],
            [-6, -5],
            [2, -11],
            [-7, -19],
            [-5, -20],
            [-7, -6]
        ],
        [
            [5784, 7745],
            [-5, 27],
            [3, 25],
            [-1, 26],
            [-16, 35],
            [-9, 25],
            [-9, 17],
            [-8, 6]
        ],
        [
            [6376, 4321],
            [7, -25],
            [7, -39],
            [4, -71],
            [7, -28],
            [-2, -28],
            [-5, -18],
            [-10, 35],
            [-5, -18],
            [5, -43],
            [-2, -25],
            [-8, -14],
            [-1, -50],
            [-11, -69],
            [-14, -81],
            [-17, -112],
            [-11, -82],
            [-12, -69],
            [-23, -14],
            [-24, -25],
            [-16, 15],
            [-22, 21],
            [-8, 31],
            [-2, 53],
            [-10, 47],
            [-2, 42],
            [5, 43],
            [13, 10],
            [0, 20],
            [13, 45],
            [2, 37],
            [-6, 28],
            [-5, 38],
            [-2, 54],
            [9, 33],
            [4, 38],
            [14, 2],
            [15, 12],
            [11, 10],
            [12, 1],
            [16, 34],
            [23, 36],
            [8, 30],
            [-4, 25],
            [12, -7],
            [15, 41],
            [1, 36],
            [9, 26],
            [10, -25]
        ],
        [
            [2301, 6586],
            [-10, -52],
            [-5, -43],
            [-2, -79],
            [-3, -29],
            [5, -32],
            [9, -29],
            [5, -45],
            [19, -44],
            [6, -34],
            [11, -29],
            [29, -16],
            [12, -25],
            [24, 17],
            [21, 6],
            [21, 11],
            [18, 10],
            [17, 24],
            [7, 34],
            [2, 50],
            [5, 17],
            [19, 16],
            [29, 13],
            [25, -2],
            [17, 5],
            [6, -12],
            [-1, -29],
            [-15, -35],
            [-6, -36],
            [5, -10],
            [-4, -26],
            [-7, -46],
            [-7, 15],
            [-6, -1]
        ],
        [
            [2438, 5916],
            [-32, 64],
            [-14, 19],
            [-23, 16],
            [-15, -5],
            [-22, -22],
            [-14, -6],
            [-20, 16],
            [-21, 11],
            [-26, 27],
            [-21, 8],
            [-31, 28],
            [-23, 28],
            [-7, 16],
            [-16, 3],
            [-28, 19],
            [-12, 27],
            [-30, 34],
            [-14, 37],
            [-6, 29],
            [9, 5],
            [-3, 17],
            [7, 16],
            [0, 20],
            [-10, 27],
            [-2, 23],
            [-9, 30],
            [-25, 59],
            [-28, 46],
            [-13, 37],
            [-24, 24],
            [-5, 14],
            [4, 37],
            [-14, 13],
            [-17, 29],
            [-7, 41],
            [-14, 5],
            [-17, 31],
            [-13, 29],
            [-1, 19],
            [-15, 44],
            [-10, 45],
            [1, 23],
            [-20, 23],
            [-10, -2],
            [-15, 16],
            [-5, -24],
            [5, -28],
            [2, -45],
            [10, -24],
            [21, -41],
            [4, -14],
            [4, -4],
            [4, -20],
            [5, 1],
            [6, -38],
            [8, -15],
            [6, -21],
            [17, -30],
            [10, -55],
            [8, -26],
            [8, -28],
            [1, -31],
            [13, -2],
            [12, -27],
            [10, -26],
            [-1, -11],
            [-12, -21],
            [-5, 0],
            [-7, 36],
            [-18, 33],
            [-20, 29],
            [-14, 15],
            [1, 43],
            [-5, 32],
            [-13, 19],
            [-19, 26],
            [-4, -8],
            [-7, 16],
            [-17, 14],
            [-16, 34],
            [2, 5],
            [11, -4],
            [11, 22],
            [1, 27],
            [-22, 42],
            [-16, 17],
            [-10, 36],
            [-11, 39],
            [-12, 47],
            [-12, 54]
        ],
        [
            [1746, 6980],
            [32, 4],
            [35, 7],
            [-2, -12],
            [41, -29],
            [64, -41],
            [55, 0],
            [22, 0],
            [0, 24],
            [48, 0],
            [10, -20],
            [15, -19],
            [16, -26],
            [9, -31],
            [7, -32],
            [15, -18],
            [23, -18],
            [17, 47],
            [23, 1],
            [19, -24],
            [14, -40],
            [10, -35],
            [16, -34],
            [6, -41],
            [8, -28],
            [22, -18],
            [20, -13],
            [10, 2]
        ],
        [
            [5599, 7553],
            [9, 4],
            [13, 1]
        ],
        [
            [4661, 5921],
            [10, 11],
            [4, 35],
            [9, 1],
            [20, -16],
            [15, 11],
            [11, -4],
            [4, 13],
            [112, 1],
            [6, 42],
            [-5, 7],
            [-13, 255],
            [-14, 255],
            [43, 1]
        ],
        [
            [5118, 6189],
            [0, -136],
            [-15, -39],
            [-2, -37],
            [-25, -9],
            [-38, -5],
            [-10, -21],
            [-18, -3]
        ],
        [
            [4680, 5793],
            [1, 18],
            [-2, 23],
            [-11, 16],
            [-5, 34],
            [-2, 37]
        ],
        [
            [7737, 5644],
            [-3, 44],
            [9, 45],
            [-10, 35],
            [3, 65],
            [-12, 30],
            [-9, 71],
            [-5, 75],
            [-12, 49],
            [-18, -30],
            [-32, -42],
            [-15, 5],
            [-17, 14],
            [9, 73],
            [-6, 56],
            [-21, 68],
            [3, 21],
            [-16, 7],
            [-20, 49]
        ],
        [
            [7780, 6264],
            [-16, -14],
            [-16, -26],
            [-20, -2],
            [-12, -64],
            [-12, -11],
            [14, -52],
            [17, -43],
            [12, -39],
            [-11, -51],
            [-9, -11],
            [6, -30],
            [19, -47],
            [3, -33],
            [0, -27],
            [11, -54],
            [-16, -55],
            [-13, -61]
        ],
        [
            [5538, 7532],
            [-6, 4],
            [-8, 19],
            [-12, 12]
        ],
        [
            [5533, 7629],
            [8, -10],
            [4, -9],
            [9, -6],
            [10, -12],
            [-2, -5]
        ],
        [
            [7437, 7970],
            [29, 10],
            [53, 51],
            [42, 28],
            [24, -18],
            [29, -1],
            [19, -28],
            [28, -2],
            [40, -15],
            [27, 41],
            [-11, 35],
            [28, 61],
            [31, -24],
            [26, -7],
            [32, -15],
            [6, -44],
            [39, -25],
            [26, 11],
            [36, 7],
            [27, -7],
            [28, -29],
            [16, -30],
            [26, 1],
            [35, -10],
            [26, 15],
            [36, 9],
            [41, 42],
            [17, -6],
            [14, -20],
            [33, 5]
        ],
        [
            [5959, 4377],
            [21, 5],
            [34, -17],
            [7, 8],
            [19, 1],
            [10, 18],
            [17, -1],
            [30, 23],
            [22, 34]
        ],
        [
            [6119, 4448],
            [5, -26],
            [-1, -59],
            [3, -52],
            [1, -92],
            [5, -29],
            [-8, -43],
            [-11, -41],
            [-18, -36],
            [-25, -23],
            [-31, -28],
            [-32, -64],
            [-10, -11],
            [-20, -42],
            [-11, -13],
            [-3, -42],
            [14, -45],
            [5, -35],
            [0, -17],
            [5, 3],
            [-1, -58],
            [-4, -28],
            [6, -10],
            [-4, -25],
            [-11, -21],
            [-23, -20],
            [-34, -32],
            [-12, -21],
            [3, -25],
            [7, -4],
            [-3, -31]
        ],
        [
            [5911, 3478],
            [-21, 0]
        ],
        [
            [5890, 3478],
            [-2, 26],
            [-4, 27]
        ],
        [
            [5884, 3531],
            [-3, 21],
            [5, 66],
            [-7, 42],
            [-13, 83]
        ],
        [
            [5866, 3743],
            [29, 67],
            [7, 43],
            [5, 5],
            [3, 35],
            [-5, 17],
            [1, 44],
            [6, 41],
            [0, 75],
            [-15, 19],
            [-13, 4],
            [-6, 15],
            [-13, 12],
            [-23, -1],
            [-2, 22]
        ],
        [
            [5840, 4141],
            [-2, 42],
            [84, 49]
        ],
        [
            [5922, 4232],
            [16, -28],
            [8, 5],
            [11, -15],
            [1, -23],
            [-6, -28],
            [2, -42],
            [19, -36],
            [8, 41],
            [12, 12],
            [-2, 76],
            [-12, 43],
            [-10, 19],
            [-10, -1],
            [-7, 77],
            [7, 45]
        ],
        [
            [4661, 5921],
            [-18, 41],
            [-17, 43],
            [-18, 16],
            [-13, 17],
            [-16, -1],
            [-13, -12],
            [-14, 5],
            [-10, -19]
        ],
        [
            [4542, 6011],
            [-2, 32],
            [8, 29],
            [3, 55],
            [-3, 59],
            [-3, 29],
            [2, 30],
            [-7, 28],
            [-14, 25]
        ],
        [
            [4526, 6298],
            [6, 20],
            [108, -1],
            [-5, 86],
            [7, 30],
            [26, 5],
            [-1, 152],
            [91, -4],
            [0, 90]
        ],
        [
            [5922, 4232],
            [-15, 15],
            [9, 55],
            [9, 21],
            [-6, 49],
            [6, 48],
            [5, 16],
            [-7, 50],
            [-14, 26]
        ],
        [
            [5909, 4512],
            [28, -11],
            [5, -16],
            [10, -28],
            [7, -80]
        ],
        [
            [7836, 5425],
            [7, -5],
            [16, -36],
            [12, -40],
            [2, -39],
            [-3, -27],
            [2, -21],
            [2, -35],
            [10, -16],
            [11, -52],
            [-1, -20],
            [-19, -4],
            [-27, 44],
            [-32, 47],
            [-4, 30],
            [-16, 39],
            [-4, 49],
            [-10, 32],
            [4, 43],
            [-7, 25]
        ],
        [
            [7779, 5439],
            [5, 11],
            [23, -26],
            [2, -30],
            [18, 7],
            [9, 24]
        ],
        [
            [8045, 5176],
            [21, -20],
            [21, 11],
            [6, 50],
            [12, 11],
            [33, 13],
            [20, 47],
            [14, 37]
        ],
        [
            [8206, 5379],
            [22, 41],
            [14, 47],
            [11, 0],
            [14, -30],
            [1, -26],
            [19, -16],
            [23, -18],
            [-2, -23],
            [-19, -3],
            [5, -29],
            [-20, -20]
        ],
        [
            [5453, 3369],
            [-20, 45],
            [-11, 43],
            [-6, 58],
            [-7, 42],
            [-9, 91],
            [-1, 71],
            [-3, 32],
            [-11, 25],
            [-15, 48],
            [-14, 71],
            [-6, 37],
            [-23, 58],
            [-2, 45]
        ],
        [
            [5644, 4022],
            [23, 14],
            [18, -4],
            [11, -13],
            [0, -5]
        ],
        [
            [5552, 3594],
            [0, -218],
            [-25, -30],
            [-15, -4],
            [-17, 11],
            [-13, 4],
            [-4, 25],
            [-11, 17],
            [-14, -30]
        ],
        [
            [9604, 3812],
            [23, -36],
            [14, -28],
            [-10, -14],
            [-16, 16],
            [-19, 27],
            [-18, 31],
            [-19, 42],
            [-4, 20],
            [12, -1],
            [16, -20],
            [12, -20],
            [9, -17]
        ],
        [
            [5412, 6408],
            [7, -92],
            [10, -15],
            [1, -19],
            [11, -20],
            [-6, -25],
            [-11, -120],
            [-1, -77],
            [-35, -56],
            [-12, -78],
            [11, -22],
            [0, -38],
            [18, -1],
            [-3, -28]
        ],
        [
            [5393, 5795],
            [-5, -1],
            [-19, 64],
            [-6, 3],
            [-22, -33],
            [-21, 17],
            [-15, 3],
            [-8, -8],
            [-17, 2],
            [-16, -25],
            [-14, -2],
            [-34, 31],
            [-13, -15],
            [-14, 1],
            [-10, 23],
            [-28, 22],
            [-30, -7],
            [-7, -13],
            [-4, -34],
            [-8, -24],
            [-2, -53]
        ],
        [
            [5236, 5339],
            [-29, -21],
            [-11, 3],
            [-10, -13],
            [-23, 1],
            [-15, 37],
            [-9, 43],
            [-19, 39],
            [-21, -1],
            [-25, 0]
        ],
        [
            [2619, 5713],
            [-10, 18],
            [-13, 24],
            [-6, 20],
            [-12, 19],
            [-13, 26],
            [3, 9],
            [4, -9],
            [2, 5]
        ],
        [
            [2690, 5943],
            [-2, -5],
            [-2, -13],
            [3, -22],
            [-6, -20],
            [-3, -24],
            [-1, -26],
            [1, -15],
            [1, -27],
            [-4, -6],
            [-3, -25],
            [2, -15],
            [-6, -16],
            [2, -16],
            [4, -9]
        ],
        [
            [5092, 8091],
            [14, 16],
            [24, 87],
            [38, 25],
            [23, -2]
        ],
        [
            [5863, 9167],
            [-47, -24],
            [-22, -5]
        ],
        [
            [5573, 9140],
            [-17, -2],
            [-4, -39],
            [-53, 9],
            [-7, -33],
            [-27, 1],
            [-18, -42],
            [-28, -66],
            [-43, -83],
            [10, -20],
            [-10, -24],
            [-27, 1],
            [-18, -55],
            [2, -79],
            [17, -29],
            [-9, -70],
            [-23, -40],
            [-12, -34]
        ],
        [
            [5306, 8535],
            [-19, 36],
            [-55, -69],
            [-37, -13],
            [-38, 30],
            [-10, 63],
            [-9, 137],
            [26, 38],
            [73, 49],
            [55, 61],
            [51, 82],
            [66, 115],
            [47, 44],
            [76, 74],
            [61, 26],
            [46, -3],
            [42, 49],
            [51, -3],
            [50, 12],
            [87, -43],
            [-36, -16],
            [30, -37]
        ],
        [
            [5686, 9657],
            [-62, -24],
            [-49, 13],
            [19, 16],
            [-16, 19],
            [57, 11],
            [11, -22],
            [40, -13]
        ],
        [
            [5506, 9766],
            [92, -44],
            [-70, -23],
            [-15, -44],
            [-25, -11],
            [-13, -49],
            [-34, -2],
            [-59, 36],
            [25, 21],
            [-42, 17],
            [-54, 50],
            [-21, 46],
            [75, 21],
            [16, -20],
            [39, 0],
            [11, 21],
            [40, 2],
            [35, -21]
        ],
        [
            [5706, 9808],
            [55, -21],
            [-41, -32],
            [-81, -7],
            [-82, 10],
            [-5, 16],
            [-40, 1],
            [-30, 27],
            [86, 17],
            [40, -14],
            [28, 17],
            [70, -14]
        ],
        [
            [9805, 2640],
            [6, -24],
            [20, 24],
            [8, -25],
            [0, -25],
            [-10, -27],
            [-18, -44],
            [-14, -24],
            [10, -28],
            [-22, -1],
            [-23, -22],
            [-8, -39],
            [-16, -60],
            [-21, -26],
            [-14, -17],
            [-26, 1],
            [-18, 20],
            [-30, 4],
            [-5, 22],
            [15, 43],
            [35, 59],
            [18, 11],
            [20, 22],
            [24, 31],
            [16, 31],
            [13, 44],
            [10, 15],
            [5, 33],
            [19, 27],
            [6, -25]
        ],
        [
            [9849, 2922],
            [20, -63],
            [1, 41],
            [13, -16],
            [4, -45],
            [22, -19],
            [19, -5],
            [16, 22],
            [14, -6],
            [-7, -53],
            [-8, -34],
            [-22, 1],
            [-7, -18],
            [3, -25],
            [-4, -11],
            [-11, -32],
            [-14, -41],
            [-21, -23],
            [-5, 15],
            [-12, 9],
            [16, 48],
            [-9, 33],
            [-30, 23],
            [1, 22],
            [20, 20],
            [5, 46],
            [-1, 38],
            [-12, 40],
            [1, 10],
            [-13, 25],
            [-22, 52],
            [-12, 42],
            [11, 4],
            [15, -33],
            [21, -15],
            [8, -52]
        ],
        [
            [6475, 6041],
            [-9, 41],
            [-22, 98]
        ],
        [
            [6444, 6180],
            [83, 59],
            [19, 118],
            [-13, 42]
        ],
        [
            [6566, 6530],
            [12, -40],
            [16, -22],
            [20, -8],
            [17, -10],
            [12, -34],
            [8, -20],
            [10, -7],
            [0, -13],
            [-10, -36],
            [-5, -16],
            [-12, -19],
            [-10, -41],
            [-13, 3],
            [-5, -14],
            [-5, -30],
            [4, -39],
            [-3, -7],
            [-13, 0],
            [-17, -22],
            [-3, -29],
            [-6, -12],
            [-18, 0],
            [-10, -15],
            [0, -24],
            [-14, -16],
            [-15, 5],
            [-19, -19],
            [-12, -4]
        ],
        [
            [6557, 6597],
            [8, 20],
            [3, -5],
            [-2, -25],
            [-4, -10]
        ],
        [
            [6893, 6457],
            [-20, 15],
            [-9, 43],
            [-21, 45],
            [-51, -12],
            [-45, -1],
            [-39, -8]
        ],
        [
            [2836, 5484],
            [-9, 17],
            [-6, 32],
            [7, 16],
            [-7, 4],
            [-5, 20],
            [-14, 16],
            [-12, -4],
            [-6, -20],
            [-11, -15],
            [-6, -2],
            [-3, -13],
            [13, -32],
            [-7, -7],
            [-4, -9],
            [-13, -3],
            [-5, 35],
            [-4, -10],
            [-9, 4],
            [-5, 24],
            [-12, 3],
            [-7, 7],
            [-12, 0],
            [-1, -13],
            [-3, 9]
        ],
        [
            [2707, 5623],
            [10, -22],
            [-1, -12],
            [11, -3],
            [3, 5],
            [8, -14],
            [13, 4],
            [12, 15],
            [17, 12],
            [9, 17],
            [16, -3],
            [-1, -6],
            [15, -2],
            [12, -10],
            [10, -18],
            [10, -16]
        ],
        [
            [3045, 3974],
            [-28, 33],
            [-2, 25],
            [-55, 59],
            [-50, 65],
            [-22, 36],
            [-11, 49],
            [4, 17],
            [-23, 77],
            [-28, 109],
            [-26, 118],
            [-11, 27],
            [-9, 43],
            [-21, 39],
            [-20, 24],
            [9, 26],
            [-14, 57],
            [9, 41],
            [22, 37]
        ],
        [
            [8510, 5555],
            [2, -40],
            [2, -33],
            [-9, -54],
            [-11, 60],
            [-13, -30],
            [9, -43],
            [-8, -28],
            [-32, 35],
            [-8, 42],
            [8, 28],
            [-17, 28],
            [-9, -24],
            [-13, 2],
            [-21, -33],
            [-4, 17],
            [11, 50],
            [17, 17],
            [15, 22],
            [10, -27],
            [21, 17],
            [5, 26],
            [19, 1],
            [-1, 46],
            [22, -28],
            [3, -30],
            [2, -21]
        ],
        [
            [8443, 5665],
            [-10, -20],
            [-9, -37],
            [-8, -17],
            [-17, 40],
            [5, 16],
            [7, 17],
            [3, 36],
            [16, 4],
            [-5, -40],
            [21, 57],
            [-3, -56]
        ],
        [
            [8291, 5608],
            [-37, -56],
            [14, 41],
            [20, 37],
            [16, 41],
            [15, 58],
            [5, -48],
            [-18, -33],
            [-15, -40]
        ],
        [
            [8385, 5760],
            [16, -18],
            [18, 0],
            [0, -25],
            [-13, -25],
            [-18, -18],
            [-1, 28],
            [2, 30],
            [-4, 28]
        ],
        [
            [8485, 5776],
            [8, -66],
            [-21, 16],
            [0, -20],
            [7, -37],
            [-13, -13],
            [-1, 42],
            [-9, 3],
            [-4, 36],
            [16, -5],
            [0, 22],
            [-17, 45],
            [27, -1],
            [7, -22]
        ],
        [
            [8375, 5830],
            [-7, -51],
            [-12, 29],
            [-15, 45],
            [24, -2],
            [10, -21]
        ],
        [
            [8369, 6151],
            [17, -17],
            [9, 15],
            [2, -15],
            [-4, -24],
            [9, -43],
            [-7, -49],
            [-16, -19],
            [-5, -48],
            [7, -47],
            [14, -7],
            [13, 7],
            [34, -32],
            [-2, -32],
            [9, -15],
            [-3, -27],
            [-22, 29],
            [-10, 31],
            [-7, -22],
            [-18, 36],
            [-25, -9],
            [-14, 13],
            [1, 25],
            [9, 15],
            [-8, 13],
            [-4, -21],
            [-14, 34],
            [-4, 26],
            [-1, 56],
            [11, -19],
            [3, 92],
            [9, 54],
            [17, 0]
        ],
        [
            [9329, 4655],
            [-8, -6],
            [-12, 22],
            [-12, 38],
            [-6, 45],
            [4, 6],
            [3, -18],
            [8, -13],
            [14, -38],
            [13, -20],
            [-4, -16]
        ],
        [
            [9221, 4734],
            [-15, -5],
            [-4, -17],
            [-15, -14],
            [-15, -14],
            [-14, 0],
            [-23, 18],
            [-16, 16],
            [2, 18],
            [25, -8],
            [15, 4],
            [5, 29],
            [4, 1],
            [2, -31],
            [16, 4],
            [8, 20],
            [16, 21],
            [-4, 35],
            [17, 1],
            [6, -9],
            [-1, -33],
            [-9, -36]
        ],
        [
            [8916, 4904],
            [48, -41],
            [51, -34],
            [19, -30],
            [16, -30],
            [4, -34],
            [46, -37],
            [7, -31],
            [-25, -7],
            [6, -39],
            [25, -39],
            [18, -62],
            [15, 2],
            [-1, -27],
            [22, -10],
            [-9, -11],
            [30, -25],
            [-3, -17],
            [-18, -4],
            [-7, 16],
            [-24, 6],
            [-28, 9],
            [-22, 38],
            [-16, 32],
            [-14, 52],
            [-36, 26],
            [-24, -17],
            [-17, -20],
            [4, -43],
            [-22, -20],
            [-16, 9],
            [-28, 3]
        ],
        [
            [9253, 4792],
            [-9, -16],
            [-5, 35],
            [-6, 23],
            [-13, 19],
            [-16, 25],
            [-20, 18],
            [8, 14],
            [15, -17],
            [9, -13],
            [12, -14],
            [11, -25],
            [11, -19],
            [3, -30]
        ],
        [
            [5392, 8233],
            [19, 18],
            [43, 27],
            [35, 20],
            [28, -10],
            [2, -14],
            [27, -1]
        ],
        [
            [5546, 8273],
            [34, -7],
            [51, 1]
        ],
        [
            [5653, 8105],
            [14, -52],
            [-3, -17],
            [-14, -6],
            [-25, -50],
            [7, -26],
            [-6, 3]
        ],
        [
            [5626, 7957],
            [-26, 23],
            [-20, -8],
            [-13, 6],
            [-17, -13],
            [-14, 21],
            [-11, -8],
            [-2, 4]
        ],
        [
            [3159, 6151],
            [14, -5],
            [5, -12],
            [-7, -15],
            [-21, 1],
            [-17, -2],
            [-1, 25],
            [4, 9],
            [23, -1]
        ],
        [
            [8628, 7562],
            [4, -10]
        ],
        [
            [8632, 7552],
            [-11, 3],
            [-12, -20],
            [-8, -20],
            [1, -42],
            [-14, -13],
            [-5, -11],
            [-11, -17],
            [-18, -10],
            [-12, -16],
            [-1, -25],
            [-3, -7],
            [11, -9],
            [15, -26]
        ],
        [
            [8504, 7288],
            [-13, 11],
            [-4, -11],
            [-8, -5],
            [-1, 11],
            [-7, 5],
            [-8, 10],
            [8, 26],
            [7, 7],
            [-3, 11],
            [7, 31],
            [-2, 10],
            [-16, 7],
            [-13, 15]
        ],
        [
            [4792, 7249],
            [-11, -15],
            [-14, 8],
            [-15, -6],
            [5, 46],
            [-3, 36],
            [-12, 6],
            [-7, 22],
            [2, 39],
            [11, 21],
            [2, 24],
            [6, 36],
            [-1, 25],
            [-5, 21],
            [-1, 20]
        ],
        [
            [6411, 6520],
            [-2, 43],
            [7, 31],
            [8, 6],
            [8, -18],
            [1, -35],
            [-6, -35]
        ],
        [
            [6427, 6512],
            [-8, -4],
            [-8, 12]
        ],
        [
            [5630, 7886],
            [12, 13],
            [17, -7],
            [18, 0],
            [13, -14],
            [10, 9],
            [20, 5],
            [7, 14],
            [12, 0]
        ],
        [
            [5784, 7745],
            [12, -11],
            [13, 9],
            [13, -10]
        ],
        [
            [5822, 7733],
            [0, -15],
            [-13, -13],
            [-9, 6],
            [-7, -71]
        ],
        [
            [5629, 7671],
            [-5, 10],
            [6, 10],
            [-7, 7],
            [-8, -13],
            [-17, 17],
            [-2, 25],
            [-17, 14],
            [-3, 18],
            [-15, 24]
        ],
        [
            [8989, 8056],
            [28, -105],
            [-41, 19],
            [-17, -85],
            [27, -61],
            [-1, -41],
            [-21, 36],
            [-18, -46],
            [-5, 50],
            [3, 57],
            [-3, 64],
            [6, 45],
            [2, 79],
            [-17, 58],
            [3, 80],
            [25, 28],
            [-11, 27],
            [13, 8],
            [7, -39],
            [10, -57],
            [-1, -58],
            [11, -59]
        ],
        [
            [5546, 8273],
            [6, 26],
            [38, 19]
        ],
        [
            [0, 9132],
            [68, -45],
            [73, -59],
            [-3, -37],
            [19, -15],
            [-6, 43],
            [75, -8],
            [55, -56],
            [-28, -26],
            [-46, -6],
            [0, -57],
            [-11, -13],
            [-26, 2],
            [-22, 21],
            [-36, 17],
            [-7, 26],
            [-28, 9],
            [-31, -7],
            [-16, 20],
            [6, 22],
            [-33, -14],
            [13, -28],
            [-16, -25]
        ],
        [
            [0, 8896],
            [0, 236]
        ],
        [
            [0, 9282],
            [9999, -40],
            [-30, -3],
            [-5, 19],
            [-9964, 24]
        ],
        [
            [0, 9282],
            [4, 3],
            [23, 0],
            [40, -17],
            [-2, -8],
            [-29, -14],
            [-36, -4],
            [0, 40]
        ],
        [
            [8988, 9383],
            [-42, -1],
            [-57, 7],
            [-5, 3],
            [27, 23],
            [34, 6],
            [40, -23],
            [3, -15]
        ],
        [
            [9186, 9493],
            [-32, -23],
            [-44, 5],
            [-52, 23],
            [7, 20],
            [51, -9],
            [70, -16]
        ],
        [
            [9029, 9522],
            [-22, -44],
            [-102, 1],
            [-46, -14],
            [-55, 39],
            [15, 40],
            [37, 11],
            [73, -2],
            [100, -31]
        ],
        [
            [6598, 9235],
            [-17, -5],
            [-91, 8],
            [-7, 26],
            [-50, 16],
            [-4, 32],
            [28, 13],
            [-1, 32],
            [55, 50],
            [-25, 7],
            [66, 52],
            [-7, 27],
            [62, 31],
            [91, 38],
            [93, 11],
            [48, 22],
            [54, 8],
            [19, -23],
            [-19, -19],
            [-98, -29],
            [-85, -28],
            [-86, -57],
            [-42, -57],
            [-43, -57],
            [5, -49],
            [54, -49]
        ],
        [
            [0, 8896],
            [9963, -26],
            [-36, 4],
            [25, -31],
            [17, -49],
            [13, -16],
            [3, -24],
            [-7, -16],
            [-52, 13],
            [-78, -44],
            [-25, -7],
            [-42, -42],
            [-40, -36],
            [-11, -27],
            [-39, 41],
            [-73, -46],
            [-12, 22],
            [-27, -26],
            [-37, 8],
            [-9, -38],
            [-33, -58],
            [1, -24],
            [31, -13],
            [-4, -86],
            [-25, -2],
            [-12, -49],
            [11, -26],
            [-48, -30],
            [-10, -67],
            [-41, -15],
            [-9, -60],
            [-40, -55],
            [-10, 41],
            [-12, 86],
            [-15, 131],
            [13, 82],
            [23, 35],
            [2, 28],
            [43, 13],
            [50, 75],
            [47, 60],
            [50, 48],
            [23, 83],
            [-34, -5],
            [-17, -49],
            [-70, -65],
            [-23, 73],
            [-72, -20],
            [-69, -99],
            [23, -36],
            [-62, -16],
            [-43, -6],
            [2, 43],
            [-43, 9],
            [-35, -29],
            [-85, 10],
            [-91, -18],
            [-90, -115],
            [-106, -139],
            [43, -8],
            [14, -37],
            [27, -13],
            [18, 30],
            [30, -4],
            [40, -65],
            [1, -50],
            [-21, -59],
            [-3, -71],
            [-12, -94],
            [-42, -86],
            [-9, -41],
            [-38, -69],
            [-38, -68],
            [-18, -35],
            [-37, -34],
            [-17, -1],
            [-17, 29],
            [-38, -44],
            [-4, -19]
        ],
        [
            [6363, 7799],
            [-12, -35],
            [-27, -10],
            [-28, -61],
            [25, -56],
            [-2, -40],
            [30, -70]
        ],
        [
            [6109, 7624],
            [-35, 49],
            [-32, 23],
            [-24, 34],
            [20, 10],
            [23, 49],
            [-15, 24],
            [41, 24],
            [-1, 13],
            [-25, -10]
        ],
        [
            [6061, 7840],
            [1, 26],
            [14, 17],
            [27, 4],
            [5, 20],
            [-7, 33],
            [12, 30],
            [-1, 18],
            [-41, 19],
            [-16, -1],
            [-17, 28],
            [-21, -9],
            [-35, 20],
            [0, 12],
            [-10, 26],
            [-22, 3],
            [-2, 18],
            [7, 12],
            [-18, 33],
            [-29, -5],
            [-8, 3],
            [-7, -14],
            [-11, 3]
        ],
        [
            [5777, 8571],
            [31, 33],
            [-29, 28]
        ],
        [
            [5863, 9167],
            [29, 20],
            [46, -35],
            [76, -14],
            [105, -67],
            [21, -28],
            [2, -40],
            [-31, -31],
            [-45, -15],
            [-124, 44],
            [-21, -7],
            [45, -43],
            [2, -28],
            [2, -60],
            [36, -18],
            [22, -15],
            [3, 28],
            [-17, 26],
            [18, 22],
            [67, -37],
            [24, 15],
            [-19, 43],
            [65, 58],
            [25, -4],
            [26, -20],
            [16, 40],
            [-23, 35],
            [14, 36],
            [-21, 36],
            [78, -18],
            [16, -34],
            [-35, -7],
            [0, -33],
            [22, -20],
            [43, 13],
            [7, 38],
            [58, 28],
            [97, 50],
            [20, -3],
            [-27, -35],
            [35, -7],
            [19, 21],
            [52, 1],
            [42, 25],
            [31, -36],
            [32, 39],
            [-29, 35],
            [14, 19],
            [82, -18],
            [39, -18],
            [100, -68],
            [19, 31],
            [-28, 31],
            [-1, 13],
            [-34, 6],
            [10, 28],
            [-15, 46],
            [-1, 19],
            [51, 53],
            [18, 54],
            [21, 11],
            [74, -15],
            [5, -33],
            [-26, -48],
            [17, -19],
            [9, -41],
            [-6, -81],
            [31, -36],
            [-12, -40],
            [-55, -84],
            [32, -8],
            [11, 21],
            [31, 15],
            [7, 29],
            [24, 29],
            [-16, 33],
            [13, 39],
            [-31, 5],
            [-6, 33],
            [22, 59],
            [-36, 48],
            [50, 40],
            [-7, 42],
            [14, 2],
            [15, -33],
            [-11, -57],
            [29, -11],
            [-12, 43],
            [46, 23],
            [58, 3],
            [51, -34],
            [-25, 49],
            [-2, 63],
            [48, 12],
            [67, -2],
            [60, 7],
            [-23, 31],
            [33, 39],
            [31, 2],
            [54, 29],
            [74, 8],
            [9, 16],
            [73, 6],
            [23, -14],
            [62, 32],
            [51, -1],
            [8, 25],
            [26, 25],
            [66, 25],
            [48, -19],
            [-38, -15],
            [63, -9],
            [7, -29],
            [25, 14],
            [82, -1],
            [62, -29],
            [23, -22],
            [-7, -30],
            [-31, -18],
            [-73, -33],
            [-21, -17],
            [35, -8],
            [41, -15],
            [25, 11],
            [14, -38],
            [12, 15],
            [44, 10],
            [90, -10],
            [6, -28],
            [116, -9],
            [2, 46],
            [59, -11],
            [44, 1],
            [45, -32],
            [13, -37],
            [-17, -25],
            [35, -47],
            [44, -24],
            [27, 62],
            [44, -26],
            [48, 16],
            [53, -18],
            [21, 16],
            [45, -8],
            [-20, 55],
            [37, 25],
            [251, -38],
            [24, -35],
            [72, -45],
            [112, 11],
            [56, -10],
            [23, -24],
            [-4, -44],
            [35, -16],
            [37, 12],
            [49, 1],
            [52, -11],
            [53, 6],
            [49, -52],
            [34, 19],
            [-23, 37],
            [13, 27],
            [88, -17],
            [58, 4],
            [80, -29],
            [-9960, -25]
        ],
        [
            [7918, 9684],
            [-157, -23],
            [51, 77],
            [23, 7],
            [21, -4],
            [70, -33],
            [-8, -24]
        ],
        [
            [6420, 9816],
            [-37, -8],
            [-25, -4],
            [-4, -10],
            [-33, -10],
            [-30, 14],
            [16, 19],
            [-62, 2],
            [54, 10],
            [43, 1],
            [5, -16],
            [16, 14],
            [26, 10],
            [42, -13],
            [-11, -9]
        ],
        [
            [7775, 9718],
            [-60, -8],
            [-78, 17],
            [-46, 23],
            [-21, 42],
            [-38, 12],
            [72, 40],
            [60, 14],
            [54, -30],
            [64, -57],
            [-7, -53]
        ],
        [
            [5844, 4990],
            [11, -33],
            [-1, -35],
            [-8, -7]
        ],
        [
            [5821, 4978],
            [7, -6],
            [16, 18]
        ],
        [
            [4526, 6298],
            [1, 25]
        ],
        [
            [6188, 6023],
            [-4, 26],
            [-8, 17],
            [-2, 24],
            [-15, 21],
            [-15, 50],
            [-7, 48],
            [-20, 40],
            [-12, 10],
            [-18, 56],
            [-4, 41],
            [2, 35],
            [-16, 66],
            [-13, 23],
            [-15, 12],
            [-10, 34],
            [2, 13],
            [-8, 31],
            [-8, 13],
            [-11, 44],
            [-17, 48],
            [-14, 40],
            [-14, 0],
            [5, 33],
            [1, 20],
            [3, 24]
        ],
        [
            [6344, 6744],
            [11, -51],
            [14, -13],
            [5, -21],
            [18, -25],
            [2, -24],
            [-3, -20],
            [4, -20],
            [8, -16],
            [4, -20],
            [4, -14]
        ],
        [
            [6427, 6512],
            [5, -22]
        ],
        [
            [6444, 6180],
            [-80, -23],
            [-26, -26],
            [-20, -62],
            [-13, -10],
            [-7, 20],
            [-11, -3],
            [-27, 6],
            [-5, 5],
            [-32, -1],
            [-7, -5],
            [-12, 15],
            [-7, -29],
            [3, -25],
            [-12, -19]
        ],
        [
            [5943, 5617],
            [-4, 1],
            [0, 29],
            [-3, 20],
            [-14, 24],
            [-4, 42],
            [4, 44],
            [-13, 4],
            [-2, -13],
            [-17, -3],
            [7, -17],
            [2, -36],
            [-15, -32],
            [-14, -43],
            [-14, -6],
            [-23, 34],
            [-11, -12],
            [-3, -17],
            [-14, -11],
            [-1, -12],
            [-28, 0],
            [-3, 12],
            [-20, 2],
            [-10, -10],
            [-8, 5],
            [-14, 34],
            [-5, 17],
            [-20, -9],
            [-8, -27],
            [-7, -53],
            [-10, -11],
            [-8, -6]
        ],
        [
            [5663, 5567],
            [-2, 2]
        ],
        [
            [5635, 5716],
            [0, 14],
            [-10, 17],
            [-1, 35],
            [-5, 23],
            [-10, -4],
            [3, 22],
            [7, 25],
            [-3, 24],
            [9, 18],
            [-6, 14],
            [7, 36],
            [13, 44],
            [24, -4],
            [-1, 234]
        ],
        [
            [6023, 6357],
            [9, -58],
            [-6, -10],
            [4, -61],
            [11, -71],
            [10, -14],
            [15, -22]
        ],
        [
            [5943, 5624],
            [0, -7]
        ],
        [
            [5943, 5617],
            [0, -46]
        ],
        [
            [5944, 5309],
            [-17, -28],
            [-20, 1],
            [-22, -14],
            [-18, 13],
            [-11, -16]
        ],
        [
            [5682, 5544],
            [-19, 23]
        ],
        [
            [4535, 5861],
            [-11, 46],
            [-14, 21],
            [12, 11],
            [14, 41],
            [6, 31]
        ],
        [
            [4536, 5789],
            [-4, 45]
        ],
        [
            [9502, 4438],
            [8, -20],
            [-19, 0],
            [-11, 37],
            [17, -15],
            [5, -2]
        ],
        [
            [9467, 4474],
            [-11, -1],
            [-17, 6],
            [-5, 9],
            [1, 23],
            [19, -9],
            [9, -12],
            [4, -16]
        ],
        [
            [9490, 4490],
            [-4, -11],
            [-21, 52],
            [-5, 35],
            [9, 0],
            [10, -47],
            [11, -29]
        ],
        [
            [9440, 4565],
            [1, -12],
            [-22, 25],
            [-15, 21],
            [-10, 20],
            [4, 6],
            [13, -14],
            [23, -27],
            [6, -19]
        ],
        [
            [9375, 4623],
            [-5, -3],
            [-13, 14],
            [-11, 24],
            [1, 10],
            [17, -25],
            [11, -20]
        ],
        [
            [4682, 5458],
            [-8, 5],
            [-20, 24],
            [-14, 31],
            [-5, 22],
            [-3, 43]
        ],
        [
            [2561, 5848],
            [-3, -14],
            [-16, 1],
            [-10, 6],
            [-12, 12],
            [-15, 3],
            [-8, 13]
        ],
        [
            [6198, 5735],
            [9, -11],
            [5, -25],
            [13, -24],
            [14, -1],
            [26, 16],
            [30, 7],
            [25, 18],
            [13, 4],
            [10, 11],
            [16, 2]
        ],
        [
            [6359, 5732],
            [0, -1],
            [0, -25],
            [0, -59],
            [0, -31],
            [-13, -36],
            [-19, -50]
        ],
        [
            [6359, 5732],
            [9, 1],
            [13, 9],
            [14, 6],
            [14, 20],
            [10, 0],
            [1, -16],
            [-3, -35],
            [0, -31],
            [-6, -21],
            [-7, -64],
            [-14, -66],
            [-17, -75],
            [-24, -87],
            [-23, -66],
            [-33, -81],
            [-28, -48],
            [-42, -58],
            [-25, -45],
            [-31, -72],
            [-6, -31],
            [-6, -14]
        ],
        [
            [3412, 5410],
            [34, -11],
            [2, 10],
            [23, 4],
            [30, -15]
        ],
        [
            [3489, 5306],
            [10, -35],
            [-4, -25]
        ],
        [
            [5626, 7957],
            [-8, -15],
            [-5, -24]
        ],
        [
            [5380, 7746],
            [7, 5]
        ],
        [
            [5663, 8957],
            [-47, -17],
            [-27, -41],
            [4, -36],
            [-44, -48],
            [-54, -50],
            [-20, -84],
            [20, -41],
            [26, -33],
            [-25, -67],
            [-29, -14],
            [-11, -99],
            [-15, -55],
            [-34, 6],
            [-16, -47],
            [-32, -3],
            [-9, 56],
            [-23, 67],
            [-21, 84]
        ],
        [
            [5890, 3478],
            [-5, -26],
            [-17, -6],
            [-16, 32],
            [0, 20],
            [7, 22],
            [3, 17],
            [8, 5],
            [14, -11]
        ],
        [
            [5999, 7104],
            [-2, 45],
            [7, 25]
        ],
        [
            [6004, 7174],
            [7, 13],
            [7, 13],
            [2, 33],
            [9, -12],
            [31, 17],
            [14, -12],
            [23, 1],
            [32, 22],
            [15, -1],
            [32, 9]
        ],
        [
            [5051, 5420],
            [-22, -12]
        ],
        [
            [7849, 5777],
            [-25, 28],
            [-24, -2],
            [4, 47],
            [-24, 0],
            [-2, -65],
            [-15, -87],
            [-10, -52],
            [2, -43],
            [18, -2],
            [12, -53],
            [5, -52],
            [15, -33],
            [17, -7],
            [14, -31]
        ],
        [
            [7779, 5439],
            [-11, 23],
            [-4, 29],
            [-15, 34],
            [-14, 28],
            [-4, -35],
            [-5, 33],
            [3, 37],
            [8, 56]
        ],
        [
            [6883, 7252],
            [16, 60],
            [-6, 44],
            [-20, 14],
            [7, 26],
            [23, -3],
            [13, 33],
            [9, 38],
            [37, 13],
            [-6, -27],
            [4, -17],
            [12, 2]
        ],
        [
            [6497, 7255],
            [-5, 42],
            [4, 62],
            [-22, 20],
            [8, 40],
            [-19, 4],
            [6, 49],
            [26, -14],
            [25, 19],
            [-20, 35],
            [-8, 34],
            [-23, -15],
            [-3, -43],
            [-8, 38]
        ],
        [
            [6554, 7498],
            [31, 1],
            [-4, 29],
            [24, 21],
            [23, 34],
            [37, -31],
            [3, -47],
            [11, -12],
            [30, 2],
            [9, -10],
            [14, -61],
            [32, -41],
            [18, -28],
            [29, -29],
            [37, -25],
            [-1, -36]
        ],
        [
            [8471, 4532],
            [3, 14],
            [24, 13],
            [19, 2],
            [9, 8],
            [10, -8],
            [-10, -16],
            [-29, -25],
            [-23, -17]
        ],
        [
            [3286, 5693],
            [16, 8],
            [6, -2],
            [-1, -44],
            [-23, -7],
            [-5, 6],
            [8, 16],
            [-1, 23]
        ],
        [
            [5233, 7240],
            [31, 24],
            [19, -7],
            [-1, -30],
            [24, 22],
            [2, -12],
            [-14, -29],
            [0, -27],
            [9, -15],
            [-3, -51],
            [-19, -29],
            [6, -33],
            [14, -1],
            [7, -28],
            [11, -9]
        ],
        [
            [6004, 7174],
            [-11, 27],
            [11, 22],
            [-17, -5],
            [-23, 13],
            [-19, -34],
            [-43, -6],
            [-22, 31],
            [-30, 2],
            [-6, -24],
            [-20, -7],
            [-26, 31],
            [-31, -1],
            [-16, 59],
            [-21, 33],
            [14, 46],
            [-18, 28],
            [31, 56],
            [43, 3],
            [12, 45],
            [53, -8],
            [33, 38],
            [32, 17],
            [46, 1],
            [49, -42],
            [40, -22],
            [32, 9],
            [24, -6],
            [33, 31]
        ],
        [
            [5777, 7539],
            [3, -23],
            [25, -19],
            [-5, -14],
            [-33, -3],
            [-12, -19],
            [-23, -31],
            [-9, 27],
            [0, 12]
        ],
        [
            [8382, 6499],
            [-17, -95],
            [-12, -49],
            [-14, 50],
            [-4, 44],
            [17, 58],
            [22, 45],
            [13, -18],
            [-5, -35]
        ],
        [
            [6088, 4781],
            [-12, -73],
            [1, -33],
            [18, -22],
            [1, -15],
            [-8, -36],
            [2, -18],
            [-2, -28],
            [10, -37],
            [11, -58],
            [10, -13]
        ],
        [
            [5909, 4512],
            [-15, 18],
            [-18, 10],
            [-11, 10],
            [-12, 15]
        ],
        [
            [5844, 4990],
            [10, 8],
            [31, -1],
            [56, 4]
        ],
        [
            [6061, 7840],
            [-22, -5],
            [-18, -19],
            [-26, -3],
            [-24, -22],
            [1, -37],
            [14, -14],
            [28, 4],
            [-5, -21],
            [-31, -11],
            [-37, -34],
            [-16, 12],
            [6, 28],
            [-30, 17],
            [5, 12],
            [26, 19],
            [-8, 14],
            [-43, 15],
            [-2, 22],
            [-25, -8],
            [-11, -32],
            [-21, -44]
        ],
        [
            [3517, 3063],
            [-12, -38],
            [-31, -32],
            [-21, 11],
            [-15, -6],
            [-26, 25],
            [-18, -1],
            [-17, 32]
        ],
        [
            [679, 6185],
            [-4, -10],
            [-7, 8],
            [1, 17],
            [-4, 21],
            [1, 7],
            [5, 10],
            [-2, 11],
            [1, 6],
            [3, -1],
            [10, -10],
            [5, -5],
            [5, -8],
            [7, -21],
            [-1, -3],
            [-11, -13],
            [-9, -9]
        ],
        [
            [664, 6277],
            [-9, -4],
            [-5, 12],
            [-3, 5],
            [0, 4],
            [3, 5],
            [9, -6],
            [8, -9],
            [-3, -7]
        ],
        [
            [646, 6309],
            [-1, -7],
            [-15, 2],
            [2, 7],
            [14, -2]
        ],
        [
            [621, 6317],
            [-2, -3],
            [-2, 1],
            [-9, 2],
            [-4, 13],
            [-1, 2],
            [7, 8],
            [3, -3],
            [8, -20]
        ],
        [
            [574, 6356],
            [-4, -6],
            [-9, 11],
            [1, 4],
            [5, 6],
            [6, -1],
            [1, -14]
        ],
        [
            [3135, 7724],
            [5, -19],
            [-30, -29],
            [-29, -20],
            [-29, -18],
            [-15, -35],
            [-4, -13],
            [-1, -31],
            [10, -32],
            [11, -1],
            [-3, 21],
            [8, -13],
            [-2, -17],
            [-19, -9],
            [-13, 1],
            [-20, -10],
            [-12, -3],
            [-17, -3],
            [-23, -17],
            [41, 11],
            [8, -11],
            [-39, -18],
            [-17, 0],
            [0, 7],
            [-8, -16],
            [8, -3],
            [-6, -43],
            [-20, -45],
            [-2, 15],
            [-6, 3],
            [-9, 15],
            [5, -32],
            [7, -10],
            [1, -23],
            [-9, -23],
            [-16, -47],
            [-2, 3],
            [8, 40],
            [-14, 22],
            [-3, 49],
            [-5, -25],
            [5, -38],
            [-18, 10],
            [19, -19],
            [1, -57],
            [8, -4],
            [3, -20],
            [4, -59],
            [-17, -44],
            [-29, -18],
            [-18, -34],
            [-14, -4],
            [-14, -22],
            [-4, -20],
            [-31, -38],
            [-16, -28],
            [-13, -35],
            [-4, -42],
            [5, -41],
            [9, -51],
            [13, -41],
            [0, -26],
            [13, -69],
            [-1, -39],
            [-1, -23],
            [-7, -36],
            [-8, -8],
            [-14, 7],
            [-4, 26],
            [-11, 14],
            [-15, 51],
            [-13, 45],
            [-4, 23],
            [6, 39],
            [-8, 33],
            [-22, 49],
            [-10, 9],
            [-28, -27],
            [-5, 3],
            [-14, 28],
            [-17, 14],
            [-32, -7],
            [-24, 7],
            [-21, -5],
            [-12, -9],
            [5, -15],
            [0, -24],
            [5, -12],
            [-5, -8],
            [-10, 9],
            [-11, -11],
            [-20, 2],
            [-20, 31],
            [-25, -8],
            [-20, 14],
            [-17, -4],
            [-24, -14],
            [-25, -44],
            [-27, -25],
            [-16, -28],
            [-6, -27],
            [0, -41],
            [1, -28],
            [5, -20]
        ],
        [
            [1746, 6980],
            [-4, 30],
            [-18, 34],
            [-13, 7],
            [-3, 17],
            [-16, 3],
            [-10, 16],
            [-26, 6],
            [-7, 9],
            [-3, 32],
            [-27, 60],
            [-23, 82],
            [1, 14],
            [-13, 19],
            [-21, 50],
            [-4, 48],
            [-15, 32],
            [6, 49],
            [-1, 51],
            [-8, 45],
            [10, 56],
            [4, 53],
            [3, 54],
            [-5, 79],
            [-9, 51],
            [-8, 27],
            [4, 12],
            [40, -20],
            [15, -56],
            [7, 15],
            [-5, 49],
            [-9, 48]
        ],
        [
            [750, 8432],
            [-28, -23],
            [-14, 15],
            [-4, 28],
            [25, 21],
            [15, 9],
            [18, -4],
            [12, -18],
            [-24, -28]
        ],
        [
            [401, 8597],
            [-18, -9],
            [-18, 11],
            [-17, 16],
            [28, 10],
            [22, -6],
            [3, -22]
        ],
        [
            [230, 8826],
            [17, -12],
            [17, 6],
            [23, -15],
            [27, -8],
            [-2, -7],
            [-21, -12],
            [-21, 13],
            [-11, 11],
            [-24, -4],
            [-7, 5],
            [2, 23]
        ],
        [
            [1374, 8295],
            [-15, 22],
            [-25, 19],
            [-8, 52],
            [-36, 47],
            [-15, 56],
            [-26, 4],
            [-44, 2],
            [-33, 17],
            [-57, 61],
            [-27, 11],
            [-49, 21],
            [-38, -5],
            [-55, 27],
            [-33, 25],
            [-30, -12],
            [5, -41],
            [-15, -4],
            [-32, -12],
            [-25, -20],
            [-30, -13],
            [-4, 35],
            [12, 58],
            [30, 18],
            [-8, 15],
            [-35, -33],
            [-19, -39],
            [-40, -42],
            [20, -29],
            [-26, -42],
            [-30, -25],
            [-28, -18],
            [-7, -26],
            [-43, -31],
            [-9, -28],
            [-32, -25],
            [-20, 5],
            [-25, -17],
            [-29, -20],
            [-23, -20],
            [-47, -16],
            [-5, 9],
            [31, 28],
            [27, 18],
            [29, 33],
            [35, 6],
            [14, 25],
            [38, 35],
            [6, 12],
            [21, 21],
            [5, 44],
            [14, 35],
            [-32, -18],
            [-9, 11],
            [-15, -22],
            [-18, 30],
            [-8, -21],
            [-10, 29],
            [-28, -23],
            [-17, 0],
            [-3, 35],
            [5, 21],
            [-17, 22],
            [-37, -12],
            [-23, 28],
            [-19, 14],
            [0, 34],
            [-22, 25],
            [11, 34],
            [23, 33],
            [10, 30],
            [22, 4],
            [19, -9],
            [23, 28],
            [20, -5],
            [21, 19],
            [-5, 27],
            [-16, 10],
            [21, 23],
            [-17, -1],
            [-30, -13],
            [-8, -13],
            [-22, 13],
            [-39, -6],
            [-41, 14],
            [-12, 24],
            [-35, 34],
            [39, 25],
            [62, 29],
            [23, 0],
            [-4, -30],
            [59, 2],
            [-23, 37],
            [-34, 23],
            [-20, 29],
            [-26, 25],
            [-38, 19],
            [15, 31],
            [49, 2],
            [35, 27],
            [7, 29],
            [28, 28],
            [28, 6],
            [52, 27],
            [26, -4],
            [42, 31],
            [42, -12],
            [21, -27],
            [12, 11],
            [47, -3],
            [-2, -14],
            [43, -10],
            [28, 6],
            [59, -18],
            [53, -6],
            [21, -8],
            [37, 10],
            [42, -18],
            [31, -8]
        ],
        [
            [3018, 5753],
            [-1, -14],
            [-16, -7],
            [9, -26],
            [0, -31],
            [-12, -35],
            [10, -47],
            [12, 4],
            [6, 43],
            [-8, 21],
            [-2, 45],
            [35, 24],
            [-4, 27],
            [10, 19],
            [10, -41],
            [19, -1],
            [18, -33],
            [1, -20],
            [25, 0],
            [30, 6],
            [16, -27],
            [21, -7],
            [16, 18],
            [0, 15],
            [34, 4],
            [34, 1],
            [-24, -18],
            [10, -28],
            [22, -4],
            [21, -29],
            [4, -48],
            [15, 2],
            [11, -14]
        ],
        [
            [8001, 6331],
            [-37, -51],
            [-24, -56],
            [-6, -41],
            [22, -62],
            [25, -77],
            [26, -37],
            [17, -47],
            [12, -109],
            [-3, -104],
            [-24, -39],
            [-31, -38],
            [-23, -49],
            [-35, -55],
            [-10, 37],
            [8, 40],
            [-21, 34]
        ],
        [
            [9661, 4085],
            [-9, -8],
            [-9, 26],
            [1, 16],
            [17, -34]
        ],
        [
            [9641, 4175],
            [4, -47],
            [-7, 7],
            [-6, -3],
            [-4, 16],
            [0, 45],
            [13, -18]
        ],
        [
            [6475, 6041],
            [-21, -16],
            [-5, -26],
            [-1, -20],
            [-27, -25],
            [-45, -28],
            [-24, -41],
            [-13, -3],
            [-8, 3],
            [-16, -25],
            [-18, -11],
            [-23, -3],
            [-7, -3],
            [-6, -16],
            [-8, -4],
            [-4, -15],
            [-14, 1],
            [-9, -8],
            [-19, 3],
            [-7, 35],
            [1, 32],
            [-5, 17],
            [-5, 44],
            [-8, 24],
            [5, 3],
            [-2, 27],
            [3, 12],
            [-1, 25]
        ],
        [
            [5817, 3752],
            [11, 0],
            [14, -10],
            [9, 7],
            [15, -6]
        ],
        [
            [5911, 3478],
            [-7, -43],
            [-3, -49],
            [-7, -27],
            [-19, -30],
            [-5, -8],
            [-12, -30],
            [-8, -31],
            [-16, -42],
            [-31, -61],
            [-20, -36],
            [-21, -26],
            [-29, -23],
            [-14, -3],
            [-3, -17],
            [-17, 9],
            [-14, -11],
            [-30, 11],
            [-17, -7],
            [-12, 3],
            [-28, -23],
            [-24, -10],
            [-17, -22],
            [-13, -1],
            [-11, 21],
            [-10, 1],
            [-12, 26],
            [-1, -8],
            [-4, 16],
            [0, 34],
            [-9, 40],
            [9, 11],
            [0, 45],
            [-19, 55],
            [-14, 50],
            [0, 1],
            [-20, 76]
        ],
        [
            [5840, 4141],
            [-21, -8],
            [-15, -23],
            [-4, -21],
            [-10, -4],
            [-24, -49],
            [-15, -38],
            [-10, -2],
            [-9, 7],
            [-31, 7]
        ]
    ],
    "transform": {
        "scale": [0.036003600360036005, 0.016927109510951093],
        "translate": [-180, -85.609038]
    }
}
;
  Datamap.prototype.abwTopo = '__ABW__';
  Datamap.prototype.afgTopo = '__AFG__';
  Datamap.prototype.agoTopo = '__AGO__';
  Datamap.prototype.aiaTopo = '__AIA__';
  Datamap.prototype.albTopo = '__ALB__';
  Datamap.prototype.aldTopo = '__ALD__';
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = '__ARE__';
  Datamap.prototype.argTopo = '__ARG__';
  Datamap.prototype.armTopo = '__ARM__';
  Datamap.prototype.asmTopo = '__ASM__';
  Datamap.prototype.ataTopo = '__ATA__';
  Datamap.prototype.atcTopo = '__ATC__';
  Datamap.prototype.atfTopo = '__ATF__';
  Datamap.prototype.atgTopo = '__ATG__';
  Datamap.prototype.ausTopo = '__AUS__';
  Datamap.prototype.autTopo = '__AUT__';
  Datamap.prototype.azeTopo = '__AZE__';
  Datamap.prototype.bdiTopo = '__BDI__';
  Datamap.prototype.belTopo = '__BEL__';
  Datamap.prototype.benTopo = '__BEN__';
  Datamap.prototype.bfaTopo = '__BFA__';
  Datamap.prototype.bgdTopo = '__BGD__';
  Datamap.prototype.bgrTopo = '__BGR__';
  Datamap.prototype.bhrTopo = '__BHR__';
  Datamap.prototype.bhsTopo = '__BHS__';
  Datamap.prototype.bihTopo = '__BIH__';
  Datamap.prototype.bjnTopo = '__BJN__';
  Datamap.prototype.blmTopo = '__BLM__';
  Datamap.prototype.blrTopo = '__BLR__';
  Datamap.prototype.blzTopo = '__BLZ__';
  Datamap.prototype.bmuTopo = '__BMU__';
  Datamap.prototype.bolTopo = '__BOL__';
  Datamap.prototype.braTopo = '__BRA__';
  Datamap.prototype.brbTopo = '__BRB__';
  Datamap.prototype.brnTopo = '__BRN__';
  Datamap.prototype.btnTopo = '__BTN__';
  Datamap.prototype.norTopo = '__NOR__';
  Datamap.prototype.bwaTopo = '__BWA__';
  Datamap.prototype.cafTopo = '__CAF__';
  Datamap.prototype.canTopo = '__CAN__';
  Datamap.prototype.cheTopo = '__CHE__';
  Datamap.prototype.chlTopo = '__CHL__';
  Datamap.prototype.chnTopo = '__CHN__';
  Datamap.prototype.civTopo = '__CIV__';
  Datamap.prototype.clpTopo = '__CLP__';
  Datamap.prototype.cmrTopo = '__CMR__';
  Datamap.prototype.codTopo = '__COD__';
  Datamap.prototype.cogTopo = '__COG__';
  Datamap.prototype.cokTopo = '__COK__';
  Datamap.prototype.colTopo = '__COL__';
  Datamap.prototype.comTopo = '__COM__';
  Datamap.prototype.cpvTopo = '__CPV__';
  Datamap.prototype.criTopo = '__CRI__';
  Datamap.prototype.csiTopo = '__CSI__';
  Datamap.prototype.cubTopo = '__CUB__';
  Datamap.prototype.cuwTopo = '__CUW__';
  Datamap.prototype.cymTopo = '__CYM__';
  Datamap.prototype.cynTopo = '__CYN__';
  Datamap.prototype.cypTopo = '__CYP__';
  Datamap.prototype.czeTopo = '__CZE__';
  Datamap.prototype.deuTopo = '__DEU__';
  Datamap.prototype.djiTopo = '__DJI__';
  Datamap.prototype.dmaTopo = '__DMA__';
  Datamap.prototype.dnkTopo = '__DNK__';
  Datamap.prototype.domTopo = '__DOM__';
  Datamap.prototype.dzaTopo = '__DZA__';
  Datamap.prototype.ecuTopo = '__ECU__';
  Datamap.prototype.egyTopo = '__EGY__';
  Datamap.prototype.eriTopo = '__ERI__';
  Datamap.prototype.esbTopo = '__ESB__';
  Datamap.prototype.espTopo = '__ESP__';
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = '__GAB__';
  Datamap.prototype.psxTopo = '__PSX__';
  Datamap.prototype.gbrTopo = '__GBR__';
  Datamap.prototype.geoTopo = '__GEO__';
  Datamap.prototype.ggyTopo = '__GGY__';
  Datamap.prototype.ghaTopo = '__GHA__';
  Datamap.prototype.gibTopo = '__GIB__';
  Datamap.prototype.ginTopo = '__GIN__';
  Datamap.prototype.gmbTopo = '__GMB__';
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = '__IRQ__';
  Datamap.prototype.islTopo = '__ISL__';
  Datamap.prototype.isrTopo = '__ISR__';
  Datamap.prototype.itaTopo = '__ITA__';
  Datamap.prototype.jamTopo = '__JAM__';
  Datamap.prototype.jeyTopo = '__JEY__';
  Datamap.prototype.jorTopo = '__JOR__';
  Datamap.prototype.jpnTopo = '__JPN__';
  Datamap.prototype.kabTopo = '__KAB__';
  Datamap.prototype.kasTopo = '__KAS__';
  Datamap.prototype.kazTopo = '__KAZ__';
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = '__PRY__';
  Datamap.prototype.pyfTopo = '__PYF__';
  Datamap.prototype.qatTopo = '__QAT__';
  Datamap.prototype.rouTopo = '__ROU__';
  Datamap.prototype.rusTopo = '__RUS__';
  Datamap.prototype.rwaTopo = '__RWA__';
  Datamap.prototype.sahTopo = '__SAH__';
  Datamap.prototype.sauTopo = '__SAU__';
  Datamap.prototype.scrTopo = '__SCR__';
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = '__TCD__';
  Datamap.prototype.tgoTopo = '__TGO__';
  Datamap.prototype.thaTopo = '__THA__';
  Datamap.prototype.tjkTopo = '__TJK__';
  Datamap.prototype.tkmTopo = '__TKM__';
  Datamap.prototype.tlsTopo = '__TLS__';
  Datamap.prototype.tonTopo = '__TON__';
  Datamap.prototype.ttoTopo = '__TTO__';
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = {"type":"Topology","transform":{"scale":[0.03514630243024302,0.005240860686068607],"translate":[-178.123152,18.948267]},"objects":{"usa":{"type":"GeometryCollection","geometries":[{"type":"Polygon","id":"AL","arcs":[[0,1,2,3,4]],"properties":{"name":"Alabama"}},{"type":"MultiPolygon","id":"AK","arcs":[[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]]],"properties":{"name":"Alaska"}},{"type":"Polygon","id":"AZ","arcs":[[44,45,46,47,48]],"properties":{"name":"Arizona"}},{"type":"Polygon","id":"AR","arcs":[[49,50,51,52,53,54]],"properties":{"name":"Arkansas"}},{"type":"Polygon","id":"CA","arcs":[[55,-47,56,57]],"properties":{"name":"California"}},{"type":"Polygon","id":"CO","arcs":[[58,59,60,61,62,63]],"properties":{"name":"Colorado"}},{"type":"Polygon","id":"CT","arcs":[[64,65,66,67]],"properties":{"name":"Connecticut"}},{"type":"Polygon","id":"DE","arcs":[[68,69,70,71]],"properties":{"name":"Delaware"}},{"type":"Polygon","id":"DC","arcs":[[72,73]],"properties":{"name":"District of Columbia"}},{"type":"Polygon","id":"FL","arcs":[[74,75,-2]],"properties":{"name":"Florida"}},{"type":"Polygon","id":"GA","arcs":[[76,77,-75,-1,78,79]],"properties":{"name":"Georgia"}},{"type":"MultiPolygon","id":"HI","arcs":[[[80]],[[81]],[[82]],[[83]],[[84]]],"properties":{"name":"Hawaii"}},{"type":"Polygon","id":"ID","arcs":[[85,86,87,88,89,90,91]],"properties":{"name":"Idaho"}},{"type":"Polygon","id":"IL","arcs":[[92,93,94,95,96,97]],"properties":{"name":"Illinois"}},{"type":"Polygon","id":"IN","arcs":[[98,99,-95,100,101]],"properties":{"name":"Indiana"}},{"type":"Polygon","id":"IA","arcs":[[102,-98,103,104,105,106]],"properties":{"name":"Iowa"}},{"type":"Polygon","id":"KS","arcs":[[107,108,-60,109]],"properties":{"name":"Kansas"}},{"type":"Polygon","id":"KY","arcs":[[110,111,112,113,-96,-100,114]],"properties":{"name":"Kentucky"}},{"type":"Polygon","id":"LA","arcs":[[115,116,117,-52]],"properties":{"name":"Louisiana"}},{"type":"Polygon","id":"ME","arcs":[[118,119]],"properties":{"name":"Maine"}},{"type":"MultiPolygon","id":"MD","arcs":[[[120]],[[-71,121,122,123,124,-74,125,126,127]]],"properties":{"name":"Maryland"}},{"type":"Polygon","id":"MA","arcs":[[128,129,130,131,-68,132,133,134]],"properties":{"name":"Massachusetts"}},{"type":"MultiPolygon","id":"MI","arcs":[[[-102,135,136]],[[137]],[[138,139]],[[140]]],"properties":{"name":"Michigan"}},{"type":"Polygon","id":"MN","arcs":[[-107,141,142,143,144]],"properties":{"name":"Minnesota"}},{"type":"Polygon","id":"MS","arcs":[[-4,145,-116,-51,146]],"properties":{"name":"Mississippi"}},{"type":"Polygon","id":"MO","arcs":[[-97,-114,147,-55,148,-108,149,-104]],"properties":{"name":"Missouri"}},{"type":"Polygon","id":"MT","arcs":[[150,151,-92,152,153]],"properties":{"name":"Montana"}},{"type":"Polygon","id":"NE","arcs":[[-105,-150,-110,-59,154,155]],"properties":{"name":"Nebraska"}},{"type":"Polygon","id":"NV","arcs":[[156,-48,-56,157,-88]],"properties":{"name":"Nevada"}},{"type":"Polygon","id":"NH","arcs":[[-135,158,159,-120,160]],"properties":{"name":"New Hampshire"}},{"type":"Polygon","id":"NJ","arcs":[[161,-69,162,163]],"properties":{"name":"New Jersey"}},{"type":"Polygon","id":"NM","arcs":[[164,165,166,-45,-62]],"properties":{"name":"New Mexico"}},{"type":"Polygon","id":"NY","arcs":[[-133,-67,167,-164,168,169,170]],"properties":{"name":"New York"}},{"type":"Polygon","id":"NC","arcs":[[171,172,-80,173,174]],"properties":{"name":"North Carolina"}},{"type":"Polygon","id":"ND","arcs":[[175,-154,176,-143]],"properties":{"name":"North Dakota"}},{"type":"Polygon","id":"OH","arcs":[[177,-115,-99,-137,178,179]],"properties":{"name":"Ohio"}},{"type":"Polygon","id":"OK","arcs":[[-149,-54,180,-165,-61,-109]],"properties":{"name":"Oklahoma"}},{"type":"Polygon","id":"OR","arcs":[[-89,-158,-58,181,182]],"properties":{"name":"Oregon"}},{"type":"Polygon","id":"PA","arcs":[[-163,-72,-128,183,-180,184,-169]],"properties":{"name":"Pennsylvania"}},{"type":"MultiPolygon","id":"RI","arcs":[[[185,-130]],[[186,-65,-132]]],"properties":{"name":"Rhode Island"}},{"type":"Polygon","id":"SC","arcs":[[187,-77,-173]],"properties":{"name":"South Carolina"}},{"type":"Polygon","id":"SD","arcs":[[-142,-106,-156,188,-151,-176]],"properties":{"name":"South Dakota"}},{"type":"Polygon","id":"TN","arcs":[[189,-174,-79,-5,-147,-50,-148,-113]],"properties":{"name":"Tennessee"}},{"type":"Polygon","id":"TX","arcs":[[-53,-118,190,-166,-181]],"properties":{"name":"Texas"}},{"type":"Polygon","id":"UT","arcs":[[191,-63,-49,-157,-87]],"properties":{"name":"Utah"}},{"type":"Polygon","id":"VT","arcs":[[-134,-171,192,-159]],"properties":{"name":"Vermont"}},{"type":"MultiPolygon","id":"VA","arcs":[[[193,-123]],[[120]],[[-126,-73,-125,194,-175,-190,-112,195]]],"properties":{"name":"Virginia"}},{"type":"MultiPolygon","id":"WA","arcs":[[[-183,196,-90]],[[197]],[[198]]],"properties":{"name":"Washington"}},{"type":"Polygon","id":"WV","arcs":[[-184,-127,-196,-111,-178]],"properties":{"name":"West Virginia"}},{"type":"Polygon","id":"WI","arcs":[[199,-93,-103,-145,200,-140]],"properties":{"name":"Wisconsin"}},{"type":"Polygon","id":"WY","arcs":[[-189,-155,-64,-192,-86,-152]],"properties":{"name":"Wyoming"}}]}},"arcs":[[[2632,3060],[5,-164],[7,-242],[4,-53],[3,-30],[-2,-19],[4,-11],[-5,-25],[0,-24],[-2,-32],[2,-57],[-2,-51],[3,-52]],[[2649,2300],[-14,-1],[-59,0],[-1,-25],[6,-37],[-1,-31],[2,-16],[-4,-28]],[[2578,2162],[-4,-6],[-7,31],[-1,47],[-2,6],[-3,-36],[-1,-34],[-7,9]],[[2553,2179],[-2,291],[6,363],[4,209],[-3,20]],[[2558,3062],[24,1],[50,-3]],[[1324,6901],[1,32],[6,-19],[-1,-32],[-8,4],[2,15]],[[1317,6960],[5,-23],[-3,-33],[-2,11],[0,45]],[[1285,7153],[6,5],[3,-8],[-1,-28],[-6,-6],[-5,17],[3,20]],[[1267,7137],[12,-7],[3,-36],[13,-41],[4,-25],[0,-21],[3,-4],[1,-27],[5,-27],[0,-25],[3,8],[2,-19],[1,-74],[-3,-17],[-7,3],[-3,38],[-2,-3],[-6,28],[-2,-10],[-5,10],[1,-28],[5,7],[3,-10],[-2,-39],[-5,4],[-9,49],[-2,25],[1,26],[-7,-2],[0,20],[5,2],[5,18],[-2,31],[-6,7],[-1,50],[-2,25],[-4,-18],[-2,28],[4,14],[-3,32],[2,8]],[[1263,6985],[5,-12],[4,15],[4,-7],[-4,-28],[-6,8],[-3,24]],[[1258,7247],[-4,19],[5,13],[15,-18],[7,1],[5,-36],[9,-29],[-1,-22],[-5,-11],[-6,5],[-5,-14],[-6,9],[-7,-9],[-1,45],[0,30],[-5,1],[-1,16]],[[1252,7162],[-4,14],[-4,32],[0,24],[3,11],[4,-11],[0,20],[12,-35],[1,-33],[-4,-5],[-3,-37],[3,-11],[-3,-43],[-5,9],[0,-27],[-3,13],[-2,54],[5,25]],[[1207,7331],[8,38],[3,-16],[7,-13],[6,-2],[0,-30],[6,-99],[0,-85],[-1,-22],[-4,13],[-10,84],[-7,25],[3,20],[-3,48],[-8,39]],[[1235,7494],[10,-15],[5,2],[0,-14],[8,-52],[-5,8],[-2,-18],[6,-27],[2,-48],[-6,-13],[-2,-16],[-10,-35],[-3,1],[-1,37],[2,22],[-1,32],[-3,40],[0,21],[-2,51],[-4,22],[-1,38],[7,-36]],[[1203,7324],[4,0],[4,-35],[-2,-24],[-6,-5],[0,38],[0,26]],[[1207,7331],[-5,7],[-3,26],[-6,18],[-5,37],[-6,17],[1,30],[4,10],[1,26],[3,-11],[8,-1],[6,17],[8,-23],[-5,-26],[2,-9],[4,28],[10,-9],[5,-21],[-3,-38],[3,-3],[3,-50],[-7,-7],[-14,41],[0,-42],[-4,-17]],[[883,7871],[-12,-48],[-1,-19],[-9,-12],[2,29],[10,30],[7,34],[3,-14]],[[870,7943],[-2,-39],[-4,-41],[-6,14],[5,47],[7,19]],[[863,9788],[3,-8],[15,-9],[8,5],[10,0],[12,-7],[7,4],[7,-15],[12,-18],[16,-4],[5,10],[11,6],[4,14],[12,2],[0,-9],[7,5],[15,-15],[9,-24],[10,-11],[2,-11],[8,-2],[8,-18],[1,-11],[5,9],[6,-7],[0,-1783],[13,-16],[2,17],[14,-24],[8,30],[18,4],[-3,-52],[4,-17],[10,-17],[2,-27],[29,-101],[4,-63],[6,17],[12,31],[7,1],[3,23],[0,34],[5,0],[1,31],[9,7],[13,26],[13,-45],[-1,-27],[3,-27],[7,-7],[10,-40],[-1,-12],[4,-22],[12,-25],[19,-110],[3,-29],[6,-29],[8,-65],[9,-55],[-3,-23],[9,-9],[-2,-33],[7,-14],[1,-38],[7,2],[14,-40],[9,-7],[5,-19],[4,-5],[1,-19],[9,-5],[3,-23],[-4,-43],[1,-36],[4,-58],[-4,-15],[-6,-53],[-10,-39],[-3,20],[-4,-6],[-3,39],[1,17],[-3,20],[7,21],[-2,7],[-7,-26],[-3,17],[-4,-10],[-12,42],[4,46],[-8,-15],[0,-23],[-6,17],[-1,22],[4,24],[-1,24],[-6,-19],[-6,42],[-3,-8],[-2,36],[5,23],[6,0],[-2,28],[3,36],[-5,-1],[-9,32],[-6,37],[-15,27],[0,77],[-4,9],[1,31],[-5,9],[-8,42],[-2,22],[-12,7],[-14,56],[-6,132],[-3,-30],[1,-27],[6,-53],[-1,-8],[3,-43],[0,-28],[-6,6],[-4,31],[-6,6],[-8,-9],[0,45],[-5,38],[-5,-12],[-17,40],[-2,-11],[10,-13],[7,-31],[3,-1],[1,-25],[4,-30],[-10,-16],[-5,10],[0,-26],[-8,20],[-2,14],[-5,0],[-13,38],[-10,33],[-1,20],[-5,30],[-14,21],[-9,21],[-14,26],[-9,24],[1,26],[2,-9],[3,17],[-3,38],[4,21],[-2,9],[-7,-40],[-14,-26],[-18,10],[-14,24],[-1,18],[-7,-4],[-7,14],[-17,12],[-9,1],[-21,-10],[-8,-7],[-10,27],[-12,12],[-3,17],[-2,28],[-8,-2],[-3,-25],[-15,34],[-2,14],[-15,-27],[-7,-32],[-3,30],[3,17],[4,-5],[14,22],[-2,17],[-6,-8],[-3,22],[-6,3],[-6,55],[-3,-13],[-8,-8],[-3,8],[-3,-18],[-11,6],[-1,-20],[-7,-5],[-3,7],[2,36],[-3,-1],[-5,-38],[7,-12],[1,-27],[4,-30],[-3,-31],[-5,10],[-2,-15],[6,-7],[3,-41],[-8,-9],[-4,9],[-7,-12],[-3,10],[-9,-2],[0,16],[-4,-10],[-3,-20],[-3,18],[-5,-25],[2,-12],[-6,-15],[-6,-2],[-3,-20],[-6,-17],[-4,6],[-5,-21],[-4,1],[-8,-43],[-9,-3],[-3,14],[-5,-23],[-11,17],[2,33],[8,11],[4,-2],[2,13],[8,25],[0,21],[-11,-28],[-9,16],[-1,12],[5,48],[8,34],[1,29],[2,5],[1,30],[-4,34],[10,12],[19,48],[4,-19],[6,-5],[9,20],[-10,26],[-4,20],[-7,-2],[-5,9],[-2,-8],[-9,-14],[-4,-26],[-9,-6],[-9,-30],[-1,-20],[-7,-11],[-2,-22],[-5,-13],[-2,-39],[-10,-25],[5,-20],[-4,-29],[-9,-5],[-1,-38],[-8,-13],[-3,15],[-4,-29],[-5,-1],[1,-21],[-11,-13],[-2,-57],[12,-3],[10,-16],[3,-19],[-4,-30],[-7,-19],[-6,-1],[0,-17],[-4,-6],[1,-21],[-4,-31],[-9,-29],[-5,0],[-5,-11],[-5,2],[-4,-11],[2,-16],[-7,-8],[-2,-23],[-5,14],[-5,-45],[-9,4],[1,-24],[-6,6],[-3,-11],[0,-32],[-6,-50],[-10,-6],[-7,-23],[-2,-13],[-5,18],[-8,-48],[-2,13],[-5,-4],[-1,-27],[-5,-10],[-6,4],[-4,-27],[8,-9],[-9,-60],[-25,-20],[-6,-54],[-2,12],[1,33],[-5,6],[-6,-13],[-1,-14],[-10,-22],[-4,-25],[-1,18],[-2,-21],[-6,14],[-10,-33],[-8,2],[1,25],[-4,24],[-3,-20],[1,-21],[-11,-64],[-3,16],[-1,-24],[-8,4],[-1,38],[-4,8],[-2,-14],[4,-16],[-2,-27],[-5,-13],[-5,29],[-5,2],[-1,-11],[5,-17],[-9,-27],[6,-7],[0,-13],[-5,9],[-7,-25],[-15,1],[-7,-16],[0,-13],[-8,-15],[-6,6],[-2,35],[6,12],[4,43],[6,1],[13,28],[10,1],[4,-27],[3,20],[-1,23],[6,10],[7,0],[8,50],[10,45],[12,40],[15,18],[6,-9],[6,12],[1,-17],[-3,-19],[4,-14],[1,23],[7,2],[2,-15],[5,-5],[0,18],[-8,15],[0,11],[5,49],[6,28],[9,27],[15,24],[10,35],[5,-13],[4,5],[-1,22],[1,21],[8,44],[11,28],[8,38],[0,21],[7,148],[11,40],[-1,31],[-27,-45],[-8,6],[-2,18],[-5,9],[-1,21],[-4,-10],[-3,-32],[5,-41],[-6,-18],[-5,7],[-9,64],[-6,33],[-4,0],[-2,-24],[-3,-4],[-4,19],[-5,4],[-2,32],[-16,-37],[-13,-26],[-1,-14],[-11,-22],[-6,20],[5,23],[-1,54],[-4,57],[7,24],[-6,49],[-5,27],[-4,39],[-6,17],[-2,-34],[-7,-8],[-12,-22],[-14,-9],[-7,2],[-7,12],[-1,30],[-5,9],[-9,42],[-8,8],[-8,46],[6,21],[1,39],[-5,-8],[0,24],[2,19],[-6,18],[0,-19],[-7,8],[-1,32],[-6,4],[-3,22],[0,27],[-5,-12],[-1,26],[7,6],[-6,30],[10,2],[0,35],[2,24],[18,77],[4,23],[3,-5],[-2,33],[7,55],[6,22],[11,9],[8,-9],[12,-33],[8,4],[11,32],[11,49],[6,6],[1,-13],[13,0],[12,10],[11,52],[0,12],[-5,48],[-1,28],[-8,31],[-3,26],[8,-7],[8,22],[0,20],[-10,39],[-8,-30],[-7,5],[-6,-17],[-8,-4],[-2,-11],[-9,-17],[-2,-28],[-5,-12],[-2,34],[-5,7],[-4,-26],[-2,12],[-10,19],[-20,-1],[-14,-21],[-6,-3],[-11,13],[-22,14],[-6,12],[-3,19],[2,26],[-8,22],[2,24],[5,12],[-2,31],[-8,0],[-6,8],[-13,6],[-7,16],[-10,16],[-1,19],[16,27],[20,43],[15,27],[8,-15],[8,-3],[2,21],[-5,3],[-1,18],[20,29],[22,22],[12,2],[7,-7],[-4,-32],[2,-22],[-3,-15],[4,-26],[8,5],[10,-5],[11,6],[4,-10],[7,-2],[7,10],[8,-11],[9,42],[5,2],[5,-8],[2,24],[-12,11],[-11,-9],[1,31],[-8,34],[-10,10],[-2,30],[7,8],[9,-31],[-1,-24],[4,-18],[10,-22],[2,23],[-11,30],[5,54],[-4,10],[-11,-12],[-11,3],[-2,10],[-6,-10],[-24,23],[0,24],[-7,54],[-6,19],[-9,17],[-19,46],[-9,18],[-8,4],[-13,31],[-12,18],[-1,6],[9,10],[4,29],[1,59],[25,-4],[31,13],[8,11],[12,29],[12,45],[3,45],[5,38],[10,33],[5,24],[13,38],[2,-10],[11,-3],[16,20],[10,21],[24,64],[9,4],[1,-10],[9,7],[9,-2],[18,9],[17,28],[17,58],[7,13],[2,-10],[26,-24],[2,-17],[-9,-22],[-4,-1],[0,-29],[14,9],[0,16],[6,14],[2,-8],[5,33],[13,-30],[-2,-23],[8,-6],[5,-14],[7,22],[13,1],[7,7],[18,-7],[10,-8],[-5,-45],[17,-12],[2,-11],[16,-20],[1,9],[12,13],[11,-1],[0,-11],[7,-1],[7,15],[11,2],[9,-6],[11,-16],[5,3],[7,-22],[4,9],[7,-7],[5,-13]],[[717,7456],[-1,-8],[-9,13],[7,49],[6,4],[4,45],[5,-40],[4,14],[8,-22],[0,-31],[-11,-4],[-5,-13],[-8,-7]],[[688,7363],[8,25],[-8,6],[0,22],[6,14],[5,-10],[0,-22],[3,15],[0,32],[5,-15],[1,21],[5,-12],[5,0],[5,11],[7,-20],[0,-55],[9,4],[-6,-37],[-11,15],[4,-24],[-3,-20],[-6,10],[0,-38],[-8,-10],[-3,-16],[-5,15],[-6,-40],[-4,-4],[-5,-18],[-2,43],[-6,-23],[-1,13],[-6,14],[0,39],[-6,15],[4,45],[11,28],[7,-2],[1,-21]],[[671,7185],[-6,-39],[-2,6],[8,33]],[[640,7055],[4,-2],[-1,-40],[-8,6],[-1,13],[6,23]],[[519,6933],[-2,-41],[-9,-33],[5,51],[2,-5],[4,28]],[[501,6947],[5,0],[0,-20],[-5,-23],[-5,15],[-3,-14],[-2,35],[2,12],[8,-5]],[[451,6875],[1,-16],[-3,-11],[-3,18],[5,9]],[[447,8527],[-4,-19],[-2,16],[6,3]],[[436,6781],[6,-7],[-1,-16],[-5,1],[0,22]],[[358,6745],[2,-22],[-5,-10],[-1,23],[4,9]],[[352,6718],[-8,-21],[-2,14],[3,19],[7,-12]],[[335,7902],[6,7],[2,-14],[5,3],[6,-12],[1,-54],[-3,-18],[-7,-11],[-2,-18],[-11,20],[-5,-1],[-10,28],[-4,0],[-6,15],[-3,25],[4,7],[10,-7],[5,20],[5,2],[3,14],[4,-6]],[[334,6690],[5,-14],[-10,-36],[1,-6],[12,26],[0,-15],[-5,-17],[-8,-12],[-1,-18],[-8,-18],[-7,-1],[-5,-18],[-9,-16],[-5,17],[9,20],[3,-3],[8,16],[-2,19],[4,20],[6,-9],[1,12],[-7,4],[-4,14],[4,23],[11,13],[2,-26],[5,25]],[[266,6527],[10,37],[1,16],[4,17],[7,9],[3,-10],[1,-25],[-12,-27],[-6,-40],[-6,-13],[-2,36]],[[238,6477],[2,-19],[-8,-1],[-1,13],[7,7]],[[227,7303],[-4,-18],[-1,18],[5,0]],[[212,6440],[2,-18],[-5,-13],[-1,19],[4,12]],[[182,8542],[22,-28],[13,24],[6,-2],[5,-14],[2,-23],[11,-12],[4,-12],[15,-5],[8,-8],[-4,-28],[-7,6],[-8,-5],[-4,-13],[-4,-28],[-5,26],[-6,18],[-6,2],[-3,20],[-15,25],[-6,1],[-11,-22],[-7,11],[-4,23],[4,44]],[[162,6381],[0,-22],[-5,-4],[1,19],[4,7]],[[128,6335],[4,-8],[10,1],[1,-7],[-13,-9],[-2,23]],[[108,6360],[0,19],[4,7],[6,-19],[-2,-17],[-4,1],[1,-20],[-5,-2],[-12,-21],[-6,6],[2,15],[7,-2],[9,33]],[[47,6279],[5,3],[0,-24],[-6,3],[-8,-28],[-4,37],[4,1],[0,29],[5,1],[0,-21],[4,-1]],[[28,6296],[3,-9],[-2,-32],[-5,-10],[0,20],[4,31]],[[0,6291],[5,-1],[4,-23],[-4,-27],[-5,51]],[[9993,6496],[6,-13],[0,-19],[-11,-12],[-8,31],[0,15],[13,-2]],[[1966,3444],[-1,-1081]],[[1965,2363],[-57,0],[-34,71],[-73,150],[3,43]],[[1804,2627],[6,8],[1,16],[-1,36],[-4,1],[-2,71],[6,27],[0,28],[-1,45],[4,34],[4,12],[4,25],[-6,27],[-4,51],[-5,31],[0,24]],[[1806,3063],[2,26],[0,36],[-3,36],[-2,112],[11,7],[3,-23],[3,1],[3,33],[0,153]],[[1823,3444],[101,2],[42,-2]],[[2515,3253],[-1,-35],[-4,-11],[-1,-29],[-5,-31],[0,-46],[-3,-34],[-3,-5]],[[2498,3062],[2,-17],[-4,-14],[-2,-33],[-3,-8],[0,-38],[-5,-10],[0,-13],[-6,-31],[2,-21],[-5,-30],[-5,-59],[5,-25],[-2,-16],[1,-39],[-2,-26]],[[2474,2682],[-69,3],[-13,0]],[[2392,2685],[0,101],[-4,8],[-5,-9],[-3,18]],[[2380,2803],[1,335],[-5,211]],[[2376,3349],[4,0],[123,-1],[2,-36],[-4,-23],[-4,-36],[18,0]],[[1654,4398],[0,-331],[0,-241],[36,-171],[35,-169],[27,-137],[20,-101],[34,-185]],[[1804,2627],[-38,-18],[-30,-16],[-4,25],[0,40],[-2,47],[-4,33],[-9,46],[-12,43],[-2,-12],[-4,8],[1,18],[-5,39],[-7,-8],[-12,28],[-2,23],[-8,28],[-9,-1],[-7,13],[-10,-6],[-5,26],[1,53],[-1,8],[1,38],[-8,28],[0,39],[-3,2],[-4,33],[-4,8],[-1,20],[-11,79],[-5,23],[-1,61],[2,-5],[2,37],[-4,33],[-5,-4],[-7,30],[-2,24],[0,23],[-3,31],[0,50],[5,0],[-2,70],[-2,-7],[-1,-35],[-5,-7],[-7,26],[-1,45],[-4,35],[-6,22],[-3,25],[-9,50],[2,14],[-4,64],[2,35],[-3,54],[-7,52],[-7,29],[-2,35],[7,83],[2,29],[-2,22],[3,57],[-2,52],[-3,13],[1,42]],[[1534,4399],[28,1],[24,1],[38,-3],[30,0]],[[2107,4208],[57,0],[0,-191]],[[2164,4017],[1,-574]],[[2165,3443],[-28,1]],[[2137,3444],[-38,-1],[-72,0],[-15,1],[-46,0]],[[1966,3444],[0,223],[-1,21],[0,162],[0,357]],[[1965,4207],[32,1],[63,-1],[47,1]],[[3025,4400],[0,-113],[-2,-18]],[[3023,4269],[-2,3],[-12,-14],[-15,4],[-7,-26],[-7,-9],[-8,-22]],[[2972,4205],[-2,22],[7,21],[-2,16],[2,144]],[[2977,4408],[12,-2],[36,-3],[0,-3]],[[2922,3980],[-2,-23]],[[2920,3957],[-3,-13],[0,-30],[5,-29],[1,-47],[6,-49],[3,-2],[1,-66]],[[2933,3721],[-19,2],[-2,241]],[[2912,3964],[5,21],[5,-5]],[[2876,3786],[-2,27]],[[2874,3813],[2,12],[4,-19],[-4,-20]],[[2649,2300],[4,-55],[39,-13],[37,-14],[1,-41],[4,1],[1,39],[-1,35],[2,15],[7,-16],[8,-7]],[[2751,2244],[1,-83],[4,-93],[8,-122],[13,-131],[-2,-9],[1,-61],[5,-68],[8,-137],[2,-42],[0,-44],[-3,-158],[-3,-3],[-3,-49],[1,-16],[-5,-36],[-2,9],[-6,-15],[-9,-8],[-2,20],[1,29],[-7,85],[-5,15],[-4,-11],[-3,47],[-1,38],[-6,43],[-2,28],[1,41],[-3,8],[1,-24],[-3,-7],[-9,104],[-4,26],[9,76],[-6,-4],[-4,-24],[-3,38],[5,104],[1,87],[-4,21],[-1,28],[-5,6],[-7,46],[-5,19],[0,28],[-4,11],[-3,31],[-11,42],[-9,-10],[0,-29],[-3,5],[-12,-35],[-12,-9],[0,21],[-3,25],[-15,57],[-10,24],[-10,6],[-8,-4],[-17,-18]],[[2703,3063],[-6,-41],[0,-20],[9,-40],[3,3],[5,-42],[1,-22],[4,-40],[7,-24],[3,-35],[8,-33],[0,-22],[5,-35],[7,-29],[2,-32],[1,-40],[3,-14],[5,-51],[0,-33],[7,-16]],[[2767,2497],[-7,-65],[-2,-34],[-3,-29],[0,-30],[-3,-14],[-1,-81]],[[2632,3060],[37,1]],[[2669,3061],[20,-1],[14,3]],[[640,0],[-7,17],[-1,16],[1,43],[-5,73],[4,24],[2,34],[-2,22],[1,23],[8,-27],[9,-20],[5,-29],[0,-26],[8,-40],[-5,-34],[-8,-15],[-7,-25],[-3,-36]],[[613,397],[3,-26],[4,11],[9,-30],[-1,-27],[-9,-14],[-2,6],[-1,33],[-5,7],[-1,19],[3,21]],[[602,432],[-3,-20],[-7,0],[2,22],[8,-2]],[[574,525],[3,-45],[-2,-26],[-6,-5],[-4,54],[4,1],[5,21]],[[531,626],[3,-2],[2,-20],[-1,-28],[-4,-18],[-9,22],[1,31],[8,15]],[[1908,4871],[0,-472]],[[1908,4399],[-31,-1],[-54,0]],[[1823,4398],[-85,1]],[[1738,4399],[0,349],[4,62],[-2,16],[-6,3],[-2,26],[6,68],[3,6],[3,29],[-1,17],[4,23],[1,34],[6,56],[-2,26],[-7,14],[-4,32]],[[1741,5160],[0,34],[-3,33],[0,16],[0,255],[0,236]],[[1738,5734],[28,0]],[[1766,5734],[0,-195],[9,-54],[1,-52],[5,-23],[6,-8],[0,-14],[11,-51],[1,-21],[8,-20],[0,-12],[8,1],[-4,-71],[-1,-45],[3,-29],[-5,-21],[2,-20],[-1,-21],[6,-20],[7,26],[3,21],[5,-19],[-1,-15],[3,-37],[5,-39],[3,-13],[0,-37],[3,-16],[6,-2],[4,-61],[3,-11],[3,18],[9,-1],[7,17],[3,-10],[7,9],[2,-11],[5,8],[7,39],[4,-33],[5,-20]],[[2489,4496],[53,-3],[28,0]],[[2570,4493],[-1,-37],[4,-43],[5,-70]],[[2578,4343],[0,-450],[-3,-35],[3,-40],[1,-34],[-4,-27],[-1,-25],[-5,-41],[-3,-3],[0,-24],[-2,-9],[-1,-45],[0,-13]],[[2563,3597],[-3,-27],[2,-34],[-11,-17],[-1,-20],[2,-25],[-3,-16],[-11,29],[-3,-2],[-4,-33],[1,-11]],[[2532,3441],[-5,2],[-6,55],[2,12],[-2,37],[0,29],[-9,41],[-3,-4],[-3,25],[-9,38],[0,31],[5,49],[-1,18],[3,23],[-4,13],[-6,9],[-3,-18],[-3,11],[-1,63],[-10,41],[-9,49],[-3,58],[-1,39],[3,27]],[[2467,4089],[0,35],[8,21],[1,29],[4,19],[0,33],[-4,27],[2,34],[11,9],[9,24],[0,29],[4,13],[1,37],[0,24],[-7,18],[-1,20],[-6,35]],[[2655,4340],[0,-228],[0,-266]],[[2655,3846],[-2,-9],[2,-52],[-5,-1],[-5,-18],[-8,9],[1,-38],[-5,-16],[-2,-24],[-5,-9],[-3,-48],[-3,-13],[-6,18],[-1,22],[-7,-24],[1,-21],[-7,-7],[-1,19],[-8,-19],[-2,-20],[-7,28],[-4,-6],[-2,13],[-3,-13],[-7,-2],[-3,-18]],[[2578,4343],[3,-12],[8,0],[9,22]],[[2598,4353],[23,0],[34,0],[0,-13]],[[2473,4685],[0,-28],[4,-19],[-3,-23],[1,-43],[2,-30],[10,-22],[2,-24]],[[2467,4089],[-3,7],[-6,38],[-3,-1],[-40,-5],[-39,-2],[-33,3]],[[2343,4129],[-3,25],[2,49],[-3,43],[0,48],[-5,17],[-1,26],[2,23],[-2,33],[-4,13],[-5,86]],[[2324,4492],[-5,41],[2,29],[1,37],[2,14],[-3,19],[1,33],[-2,16],[4,4]],[[2324,4685],[144,0],[5,0]],[[2356,4017],[3,-18],[9,-14],[-6,-56],[4,-18],[4,-45],[6,-10],[0,-412]],[[2376,3444],[-156,0],[-55,-1]],[[2164,4017],[5,0],[187,0]],[[2718,3716],[-1,-57],[4,-37],[4,-28],[2,-22],[5,-22],[4,-3]],[[2736,3547],[-11,-51],[-11,-29],[0,-14],[-4,-13],[0,-16],[-6,-8],[-1,-21],[-16,-27]],[[2687,3368],[0,-3],[-24,2],[-22,6],[-5,-2],[-32,8],[-36,-5],[-6,9],[1,-35],[-36,2],[-3,-2]],[[2524,3348],[1,24],[5,-8],[2,77]],[[2655,3846],[11,0],[5,-40],[1,-17],[9,-7],[6,-26],[5,13],[10,-14],[4,19],[4,6],[1,-32],[3,-6],[4,-26]],[[2474,2682],[3,-22],[-2,-9],[-1,-38],[5,-24],[0,-57],[-3,-44],[-7,-27],[-2,-43],[-2,4],[-1,-70],[-3,-2],[2,-37],[-2,-14],[54,0],[-3,-63],[4,-41],[1,-32],[4,-20]],[[2521,2143],[-9,-26],[0,-19],[7,-12],[3,30],[6,-30],[-1,-24],[-3,-11],[-7,10],[1,-18],[-2,-27],[5,-24],[9,-7],[3,-29],[3,-4],[-5,-32],[-5,6],[-4,33],[-10,18],[0,33],[-6,-11],[1,-27],[-3,-25],[-3,-4],[-3,28],[-7,1],[-2,-29],[-4,-9],[-5,18],[-4,2],[-3,47],[-7,21],[-2,-3],[-3,40],[-7,-5],[0,24],[-8,-23],[1,-18],[-5,-17],[-9,8],[-10,27],[-7,11],[-16,-9],[-2,-8]],[[2398,2049],[-2,19],[6,68],[-2,37],[2,20],[-1,26],[3,19],[3,50],[0,40],[-8,78],[0,41],[-7,42],[0,196]],[[3046,5029],[12,26],[-2,13],[5,30],[4,13],[-1,12],[5,18],[-1,33],[2,50],[5,17],[1,53],[22,147],[6,-7],[0,-35],[4,-13],[9,21],[6,0],[4,14],[8,-31],[4,-25],[1,-214],[-1,-51],[10,-14],[-2,-22],[3,-21],[-2,-18],[4,-30],[5,7],[5,-68],[-6,-31],[-3,12],[-3,-21],[-4,5],[0,-18],[-6,2],[-8,-40],[-2,28],[-3,2],[1,-30],[-6,-15],[-2,24],[-3,-12],[-7,0],[0,28],[-5,-6],[1,-20],[-4,-42],[1,-12],[-6,-23],[-5,9],[-3,-24],[-4,-3],[-4,-20],[-4,4],[-1,21],[-7,-34],[2,-21],[-5,-7],[0,-18],[-5,-22],[-5,-50]],[[3056,4600],[-3,14],[0,19],[-4,22],[-2,250],[-1,124]],[[2904,3626],[2,0],[-1,0],[-1,0]],[[2933,3721],[-6,-80]],[[2927,3641],[-4,-3],[-8,-12]],[[2915,3626],[-6,-8],[0,31],[-2,13],[3,13],[-4,32],[-2,-14],[-6,3],[-2,35],[2,0],[0,45],[2,18],[-2,60],[3,36],[5,6],[0,37],[-3,-5],[0,-18],[-8,-25],[-2,-21],[0,-56],[-3,-26],[1,-44],[4,-30],[-1,-23],[3,-23],[-2,-16],[-6,30],[-10,15],[-2,29],[-6,-16],[-2,23],[5,29]],[[2874,3756],[2,30]],[[2874,3813],[-4,18],[-6,10],[0,28],[-3,15],[-4,4]],[[2857,3888],[-4,53],[-4,0],[-5,18],[-3,-15],[-5,1],[-1,-21],[-8,14],[-6,-28],[-3,6],[-6,-33],[-6,-17],[1,98]],[[2807,3964],[105,0]],[[3053,4565],[1,-34],[-1,-27],[-5,-25],[0,-29],[6,-4],[4,-31],[0,-24],[3,-6],[0,-22],[8,-19],[9,18],[-2,-26],[-13,-23],[-5,-1],[-3,18],[-5,-6],[0,-13],[-5,-9]],[[3045,4302],[-3,35]],[[3042,4337],[0,6]],[[3042,4343],[-3,14],[-2,45],[-4,0],[-8,-2]],[[2977,4408],[0,7],[6,126]],[[2983,4541],[23,-3]],[[3006,4538],[34,-7],[3,18],[7,19],[3,-3]],[[2598,4353],[5,25],[4,43],[4,26],[3,36],[1,52],[0,57],[-9,111],[3,42],[-2,50],[6,51],[2,43],[-1,23],[5,9],[0,31],[8,9],[5,34],[0,-69],[3,-3],[3,35],[1,58],[2,15],[8,9],[-3,41],[5,35],[7,2],[7,-22],[7,-3],[3,-28],[6,-2],[9,-25],[3,1],[4,-41],[-3,-21],[3,-29],[2,-32],[-2,-71],[-6,-18],[-1,-37],[-7,-12],[-4,-44],[2,-17],[6,-15],[6,24],[6,49],[10,19],[5,-15],[3,-27],[3,-80],[0,-39],[3,-48],[-3,-69],[-4,-11],[-1,25],[-3,-7],[-3,-58],[-6,-21],[-2,-44],[-7,-37],[0,-16]],[[2694,4347],[-39,-7]],[[2635,5110],[1,-23],[-4,-4],[1,33],[2,-6]],[[2496,5270],[11,20],[5,23],[12,9],[8,29],[4,1],[3,20],[9,28],[4,24],[7,15],[6,-13],[-11,-59],[-2,-19],[0,-36],[5,27],[10,-4],[8,-19],[7,-52],[3,-10],[7,9],[2,-12],[7,-6],[16,44],[8,4],[10,-2],[7,15],[6,1],[1,-54],[5,-7],[6,8],[2,-12],[4,16],[8,5],[1,-67],[3,-28],[6,-8],[1,19],[5,0],[3,-20],[-3,-14],[-15,12],[-8,-8],[-8,23],[-2,-21],[1,-18],[-4,4],[-5,27],[-9,15],[-5,1],[-4,-25],[-8,-6],[-8,5],[-3,-10],[-1,-21],[-9,-18],[1,25],[-4,5],[-2,-26],[-6,-1],[-3,-11],[-5,-45],[-8,-58],[1,-5]],[[2576,4989],[-4,20],[2,27],[-7,4],[3,26],[0,34],[-5,23],[-4,24],[-12,19],[-4,-7],[-12,29],[-29,38],[-3,33],[-5,11]],[[2541,5539],[-7,-24],[-4,-3],[1,19],[18,45],[-4,-31],[-4,-6]],[[2324,4685],[0,343],[-7,22],[-5,36],[8,41],[1,22]],[[2321,5149],[-1,76],[-4,20],[-2,42],[0,51],[-1,8],[-1,123],[-5,65],[-3,36],[0,77],[1,27],[-3,60]],[[2302,5734],[59,0],[0,73],[5,-2],[4,-14],[4,-100],[3,-11],[9,-3],[1,-10],[11,-4],[1,-21],[10,5],[0,9],[7,10],[6,-4],[8,-16],[2,-19],[4,2],[4,-43],[2,18],[7,8],[1,-18],[9,-12],[0,-17],[4,-14],[8,8],[5,18],[8,12],[2,-28],[5,6],[6,-6],[6,4],[8,-24],[7,4],[0,-10],[-10,-24],[-13,-19],[-9,-20],[-12,-49],[-5,-31],[-8,-34],[-13,-46],[2,-16]],[[2450,5296],[-2,9],[-6,-16],[0,-113],[-2,-11],[-8,-16],[-6,-41],[-1,-27],[3,-2],[4,-24],[-3,-29],[0,-33],[-2,-70],[8,-34],[6,-3],[3,-21],[8,-21],[2,-25],[8,-33],[5,-7],[5,-42],[-1,-30],[2,-22]],[[2553,2179],[-3,-8],[-7,4],[-3,12],[-7,-8],[-9,-22],[-3,-14]],[[2498,3062],[53,0],[7,0]],[[2524,3348],[-2,0],[-2,0],[1,-47],[-6,-48]],[[2376,3349],[0,95]],[[2356,4017],[-7,50],[-6,62]],[[2108,5151],[0,-181],[-1,0]],[[2107,4970],[-53,1],[-90,0],[-56,0],[0,-100]],[[1766,5734],[130,-1],[58,1],[154,0]],[[2108,5734],[0,-217],[0,-366]],[[2107,4208],[0,382]],[[2107,4590],[21,0],[49,-1],[88,0],[1,-10],[15,-34],[4,19],[4,-4],[13,0],[15,-36],[2,-27],[5,-5]],[[1823,4398],[0,-954]],[[1654,4398],[37,-1],[47,2]],[[3006,4538],[-2,14],[0,28],[3,11],[-1,27],[3,81],[5,37],[2,43],[3,16],[-1,47],[10,17],[5,33],[-3,31],[4,32],[0,18]],[[3034,4973],[4,49],[6,-5],[2,12]],[[3056,4600],[-3,-35]],[[2962,4152],[-5,-13],[-2,-29],[8,-14],[0,-22],[-3,-103],[-9,-76],[-6,-22],[-5,-48],[-3,31],[-8,16],[-10,42],[-1,28],[0,4],[2,11]],[[2922,3980],[8,15],[0,15],[9,31],[2,17],[-9,39],[0,24],[-3,6],[-1,22],[5,33],[-3,20],[7,40],[2,21],[4,13]],[[2943,4276],[13,-41],[9,-28],[-3,-55]],[[2137,3444],[0,-95]],[[2137,3349],[-1,0],[0,-474],[0,-193],[0,-192],[-101,0],[-1,-18],[3,-22]],[[2037,2450],[-48,0],[0,-87],[-24,0]],[[2972,4205],[13,-15],[2,11],[10,0],[6,6],[8,31],[1,-22],[5,-10],[-11,-28],[-22,-42],[-9,-8],[-6,2],[-5,-9],[-2,31]],[[2943,4276],[-2,14],[-4,1],[-5,32],[1,29],[-4,22],[-2,-2],[-3,27],[-125,0],[0,48],[0,3]],[[2799,4450],[17,54],[3,26],[5,18],[-2,32],[-2,7],[-2,52],[17,22],[15,-1],[6,-5],[6,-21],[4,8],[12,-1],[8,14],[8,34],[5,1],[0,52],[3,31],[-7,21],[2,24],[11,32],[4,28],[14,64],[13,32],[19,-5],[23,4]],[[2981,4973],[1,-39],[-2,-36],[3,-34],[-1,-37],[-3,-39],[2,-52],[-1,-16],[4,-31],[-1,-132],[0,-16]],[[2909,3359],[4,-77],[-8,8],[-1,-10],[-10,-11],[-1,-11],[-7,-3],[0,-13],[8,9],[1,-8],[9,9],[3,-18],[5,8],[2,-46],[-2,-22],[-3,-2],[-8,-47],[-9,-2],[-2,-33],[4,-32],[4,-6],[-6,-54],[-6,7],[-9,-6],[-6,-11],[-10,-37],[-7,-48],[-4,-60],[-6,13],[-11,-12]],[[2833,2844],[-32,181],[-32,4],[1,21],[-5,33],[-3,-12],[0,20],[-35,10],[-8,-8],[-6,-17],[-10,-13]],[[2669,3061],[1,45],[5,4],[3,31],[7,29],[7,1],[7,29],[8,10],[6,43],[4,13],[1,-19],[11,37],[5,-8],[4,36],[5,9],[1,45]],[[2744,3366],[20,-5],[19,-3],[23,-1],[103,2]],[[2321,5149],[-213,2]],[[2108,5734],[194,0]],[[2777,4138],[-4,-10],[2,-21],[0,-29],[-4,-46],[-3,-70],[-11,-62],[-3,-8],[-4,12],[-3,-27],[-3,1],[-4,-36],[1,-22],[-3,-18],[-4,29],[-5,-46],[1,-29],[-3,-11],[-1,-25],[-8,-4]],[[2694,4347],[11,-26],[3,-15],[3,14],[6,-30],[4,-9],[14,25],[7,-6],[9,36],[12,34],[14,24]],[[2777,4394],[0,-256]],[[2380,2803],[-11,21],[-3,22],[-7,18],[-2,-16],[-8,1],[-1,10],[-7,-19],[-3,11],[-6,-10],[-5,-29],[-2,17],[-6,14],[-7,0],[-2,21],[-7,-42],[-2,24],[-3,-8],[-3,16],[-7,15],[-5,-25],[-2,26],[-4,3],[-2,21],[-6,8],[-3,-18],[-3,16],[-5,-2],[-6,17],[-6,-2],[-2,36],[-9,2],[-4,-6],[-6,37],[-2,-3],[0,370],[-52,0],[-34,0]],[[1534,4399],[-4,22],[-2,61],[0,43],[-4,33],[3,32],[2,51],[4,54],[2,48],[3,162],[0,22],[3,71],[1,99],[-2,54],[1,32],[12,29]],[[1553,5212],[5,-22],[4,5],[3,2],[6,-20],[3,-23],[1,-57],[15,-21],[12,30],[8,3],[9,-10],[1,-13],[16,27],[3,-9],[9,5],[7,19],[12,17],[12,4],[4,12],[58,-1]],[[2807,3964],[-30,0],[0,174]],[[2777,4394],[5,11],[17,45]],[[3045,4302],[-6,-4],[3,39]],[[3042,4343],[-4,3],[-3,-28],[-1,-40],[-11,-9]],[[2833,2844],[-5,-10],[-6,-31],[-6,-49],[-1,-40],[-5,-31],[-6,0],[-2,-23],[-6,-25],[-4,-28],[-6,-11],[-6,-29],[-1,-14],[-6,-16],[-6,-40]],[[2107,4590],[0,380]],[[2687,3368],[57,-2]],[[2398,2049],[-5,-1],[-14,-26],[-6,15],[-1,31],[-3,-22],[-3,5],[-1,-27],[3,-11],[0,-36],[-5,-37],[-9,-47],[-17,-51],[-2,9],[-5,-13],[0,12],[-7,-9],[-3,24],[-2,-5],[7,-49],[-5,-16],[-5,10],[-1,-35],[-7,-35],[-6,-66],[-4,-69],[-3,5],[-1,-25],[3,6],[-2,-50],[-2,-2],[0,-28],[3,-16],[1,-57],[3,-20],[0,-37],[3,-32],[-9,-20],[-3,25],[-7,10],[-9,-3],[-8,32],[-5,3],[-5,25],[-6,8],[-4,24],[-2,58],[-5,34],[0,30],[-2,31],[1,27],[-4,30],[-3,4],[-5,27],[-1,34],[-5,32],[-6,26],[-3,57],[-2,16],[-4,46],[-1,38],[-4,27],[-6,24],[-1,16],[-6,15],[-4,42],[-13,9],[-7,-2],[-7,15],[-1,-20],[-7,-6],[-5,-40],[-3,-64],[-2,-1],[-4,-37],[-5,-1],[-7,29],[-17,47],[-4,25],[-6,24],[-5,54],[-1,49],[-4,40],[-2,35],[-3,22],[-11,32],[-6,44],[-4,15],[-6,38],[-7,20],[-5,50],[-4,11]],[[1908,4399],[0,-192],[57,0]],[[2981,4973],[30,-2],[23,2]],[[2927,3641],[-4,-32],[-3,-12],[-3,-44],[-6,-71],[-5,-15],[-1,27],[2,58],[8,74]],[[2874,3756],[-4,-8],[-2,-28],[1,-19],[8,6],[1,-31],[10,-12],[3,-24],[8,-26],[-4,-54],[4,-41],[-4,-20],[-1,-24],[4,-15],[-4,-23],[-6,30],[-1,-10],[5,-22],[14,-5],[3,-71]],[[2736,3547],[-1,-16],[4,-32],[5,-16],[4,1],[5,25],[4,-20],[7,11],[13,36],[1,-11],[5,17],[0,34],[4,30],[5,29],[2,34],[6,36],[2,44],[5,-27],[4,-8],[3,16],[6,68],[4,-17],[13,77],[2,57],[15,-64],[3,37]],[[1553,5212],[-5,7],[-4,-12],[-6,17],[1,26],[4,14],[-6,40],[-4,103],[-2,14],[-3,73],[-6,28],[-2,56],[3,38],[6,-18],[11,-24],[8,1],[8,-9],[8,9],[3,-16],[7,1],[5,-42],[3,3],[1,-56],[2,-52],[3,6],[-3,43],[1,43],[4,44],[-3,18],[-1,31],[-3,35],[2,25],[-2,29],[-5,4],[-4,22],[1,21],[163,0]],[[1576,5602],[4,9],[0,-39],[-5,15],[1,15]],[[1568,5655],[3,25],[4,-30],[-1,-27],[-7,8],[1,24]],[[2576,4989],[-1,-23],[-6,-4],[-4,-44],[-2,-30],[3,-6],[5,20],[4,38],[6,15],[5,48],[6,10],[-1,-25],[-4,-23],[-8,-79],[-2,-44],[0,-32],[-3,-10],[-2,-43],[1,-37],[-3,-24],[-3,-59],[0,-47],[4,-42],[-1,-55]],[[2450,5296],[6,-2],[20,33],[8,17],[2,-13],[-4,-25],[9,-33],[5,-3]]]};
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = '__UZB__';
  Datamap.prototype.vatTopo = '__VAT__';
  Datamap.prototype.vctTopo = '__VCT__';
  Datamap.prototype.venTopo = '__VEN__';
  Datamap.prototype.vgbTopo = '__VGB__';
  Datamap.prototype.virTopo = '__VIR__';
  Datamap.prototype.vnmTopo = '__VNM__';
  Datamap.prototype.vutTopo = '__VUT__';
  Datamap.prototype.wlfTopo = '__WLF__';
  Datamap.prototype.wsbTopo = '__WSB__';
  Datamap.prototype.wsmTopo = '__WSM__';
  Datamap.prototype.yemTopo = '__YEM__';
  Datamap.prototype.zafTopo = '__ZAF__';
  Datamap.prototype.zmbTopo = '__ZMB__';
  Datamap.prototype.zweTopo = '__ZWE__';

  /**************************************
                Utilities
  ***************************************/

  // Convert lat/lng coords to X / Y coords
  Datamap.prototype.latLngToXY = function(lat, lng) {
     return this.projection([lng, lat]);
  };

  // Add <g> layer to root SVG
  Datamap.prototype.addLayer = function( className, id, first ) {
    var layer;
    if ( first ) {
      layer = this.svg.insert('g', ':first-child')
    }
    else {
      layer = this.svg.append('g')
    }
    return layer.attr('id', id || '')
      .attr('class', className || '');
  };

  Datamap.prototype.updateChoropleth = function(data, options) {
    var svg = this.svg;
    var that = this;

    // When options.reset = true, reset all the fill colors to the defaultFill and kill all data-info
    if ( options && options.reset === true ) {
      svg.selectAll('.datamaps-subunit')
        .attr('data-info', function() {
           return "{}"
        })
        .transition().style('fill', this.options.fills.defaultFill)
    }

    for ( var subunit in data ) {
      if ( data.hasOwnProperty(subunit) ) {
        var color;
        var subunitData = data[subunit]
        if ( ! subunit ) {
          continue;
        }
        else if ( typeof subunitData === "string" ) {
          color = subunitData;
        }
        else if ( typeof subunitData.color === "string" ) {
          color = subunitData.color;
        }
        else if ( typeof subunitData.fillColor === "string" ) {
          color = subunitData.fillColor;
        }
        else {
          color = this.options.fills[ subunitData.fillKey ];
        }
        // If it's an object, overriding the previous data
        if ( subunitData === Object(subunitData) ) {
          this.options.data[subunit] = defaults(subunitData, this.options.data[subunit] || {});
          var geo = this.svg.select('.' + subunit).attr('data-info', JSON.stringify(this.options.data[subunit]));
        }
        svg
          .selectAll('.' + subunit)
          .transition()
            .style('fill', color);
      }
    }
  };

  Datamap.prototype.updatePopup = function (element, d, options) {
    var self = this;
    element.on('mousemove', null);
    element.on('mousemove', function() {
      var position = d3.mouse(self.options.element);
      d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover')
        .style('top', ( (position[1] + 30)) + "px")
        .html(function() {
          var data = JSON.parse(element.attr('data-info'));
          try {
            return options.popupTemplate(d, data);
          } catch (e) {
            return "";
          }
        })
        .style('left', ( position[0]) + "px");
    });

    d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover').style('display', 'block');
  };

  Datamap.prototype.addPlugin = function( name, pluginFn ) {
    var self = this;
    if ( typeof Datamap.prototype[name] === "undefined" ) {
      Datamap.prototype[name] = function(data, options, callback, createNewLayer) {
        var layer;
        if ( typeof createNewLayer === "undefined" ) {
          createNewLayer = false;
        }

        if ( typeof options === 'function' ) {
          callback = options;
          options = undefined;
        }

        options = defaults(options || {}, self.options[name + 'Config']);

        // Add a single layer, reuse the old layer
        if ( !createNewLayer && this.options[name + 'Layer'] ) {
          layer = this.options[name + 'Layer'];
          options = options || this.options[name + 'Options'];
        }
        else {
          layer = this.addLayer(name);
          this.options[name + 'Layer'] = layer;
          this.options[name + 'Options'] = options;
        }
        pluginFn.apply(this, [layer, data, options]);
        if ( callback ) {
          callback(layer);
        }
      };
    }
  };

  // Expose library
  if (typeof exports === 'object') {
    d3 = require('d3');
    topojson = require('topojson');
    module.exports = Datamap;
  }
  else if ( typeof define === "function" && define.amd ) {
    define( "datamaps", ["require", "d3", "topojson"], function(require) {
      d3 = require('d3');
      topojson = require('topojson');

      return Datamap;
    });
  }
  else {
    window.Datamap = window.Datamaps = Datamap;
  }

  if ( window.jQuery ) {
    window.jQuery.fn.datamaps = function(options, callback) {
      options = options || {};
      options.element = this[0];
      var datamap = new Datamap(options);
      if ( typeof callback === "function" ) {
        callback(datamap, options);
      }
      return this;
    };
  }
})();
