(function() {
  var svg;

  //save off default references
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
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></div>';
        },
        popupOnHover: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2
    },
    projectionConfig: {
      rotation: [97, 0]
    },
    bubblesConfig: {
        borderWidth: 2,
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
        highlightFillOpacity: 0.85,
        exitDelay: 100,
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600
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
      .html('.datamap path.datamaps-graticule { fill: none; stroke: #777; stroke-width: 0.5px; stroke-opacity: .5; pointer-events: none; } .datamap .labels {pointer-events: none;} .datamap path {stroke: #FFFFFF; stroke-width: 1px;} .datamaps-legend dt, .datamaps-legend dd { float: left; margin: 0 3px 0 0;} .datamaps-legend dd {width: 20px; margin-right: 6px; border-radius: 3px;} .datamaps-legend {padding-bottom: 20px; z-index: 1001; position: absolute; left: 4px; font-size: 12px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;} .datamaps-hoverover {display: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; } .hoverinfo {padding: 4px; border-radius: 1px; background-color: #FFF; box-shadow: 1px 1px 5px #CCC; font-size: 12px; border: 1px solid #CCC; } .hoverinfo hr {border:1px dotted #CCC; }');
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
        //if fillKey - use that
        //otherwise check 'fill'
        //otherwise check 'defaultFill'
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
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));

            //as per discussion on https://github.com/markmarkoh/datamaps/issues/19
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
            //reapply previous attributes
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

  //plugin to add a simple map legend
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
            var originXY = self.latLngToXY(val(datum.origin.latitude, datum), val(datum.origin.longitude, datum))
            var destXY = self.latLngToXY(val(datum.destination.latitude, datum), val(datum.destination.longitude, datum));
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
          .text( d.id );
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
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[0];
        })
        .attr('cy', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[1];
        })
        .attr('r', function(datum) {
          // if animation enabled start with radius 0, otherwise use full size.
          return options.animate ? 0 : val(datum.radius, options.radius, datum);
        })
        .attr('data-info', function(d) {
          return JSON.stringify(d);
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
            //save all previous attributes for mouseout
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
            //reapply previous attributes
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

  //stolen from underscore.js
  function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
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
    //set options for global use
    this.options = defaults(options, defaultOptions);
    this.options.geographyConfig = defaults(options.geographyConfig, defaultOptions.geographyConfig);
    this.options.projectionConfig = defaults(options.projectionConfig, defaultOptions.projectionConfig);
    this.options.bubblesConfig = defaults(options.bubblesConfig, defaultOptions.bubblesConfig);
    this.options.arcConfig = defaults(options.arcConfig, defaultOptions.arcConfig);

    //add the SVG container
    if ( d3.select( this.options.element ).select('svg').length > 0 ) {
      addContainer.call(this, this.options.element, this.options.height, this.options.width );
    }

    /* Add core plugins to this instance */
    this.addPlugin('bubbles', handleBubbles);
    this.addPlugin('legend', addLegend);
    this.addPlugin('arc', handleArcs);
    this.addPlugin('labels', handleLabels);
    this.addPlugin('graticule', addGraticule);

    //append style block with basic hoverover styles
    if ( ! this.options.disableDefaultStyles ) {
      addStyleBlock();
    }

    return this.draw();
  }

  // resize map
  Datamap.prototype.resize = function () {

    var self = this;
    var options = self.options;

    if (options.responsive) {
      var newsize = options.element.clientWidth,
          oldsize = d3.select( options.element).select('svg').attr('data-width');

      d3.select(options.element).select('svg').selectAll('g').attr('transform', 'scale(' + (newsize / oldsize) + ')');
    }
  }

  // actually draw the features(states & countries)
  Datamap.prototype.draw = function() {
    //save off in a closure
    var self = this;
    var options = self.options;

    //set projections and paths based on scope
    var pathAndProjection = options.setProjection.apply(self, [options.element, options] );

    this.path = pathAndProjection.path;
    this.projection = pathAndProjection.projection;

    //if custom URL for topojson data, retrieve it and render
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
        // if fetching remote data, draw the map first then call `updateChoropleth`
        if ( self.options.dataUrl ) {
          //allow for csv or json data types
          d3[self.options.dataType](self.options.dataUrl, function(data) {
            //in the case of csv, transform data to object
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

        //fire off finished callback
        self.options.done(self);
      }
  };
  /**************************************
                TopoJSON
  ***************************************/
  Datamap.prototype.worldTopo = '__WORLD__';
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
  Datamap.prototype.usaTopo = '__USA__';
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
  Datamap.prototype.zmbTopo = {"type":"Topology","objects":{"zmb":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Luapula"},"id":"ZM.LP","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Northern"},"id":"ZM.NO","arcs":[[3,-3,4]]},{"type":"Polygon","properties":{"name":"Central"},"id":"ZM.CE","arcs":[[5,6,7,8,9,10,11,12]]},{"type":"Polygon","properties":{"name":"Copperbelt"},"id":"ZM.CO","arcs":[[-11,13,14]]},{"type":"Polygon","properties":{"name":"Eastern"},"id":"ZM.EA","arcs":[[15,-6,16,17]]},{"type":"Polygon","properties":{"name":"Lusaka"},"id":"ZM.LS","arcs":[[-16,18,19,-7]]},{"type":"Polygon","properties":{"name":"North-Western"},"id":"ZM.NW","arcs":[[-14,-10,20,21]]},{"type":"Polygon","properties":{"name":"Southern"},"id":"ZM.SO","arcs":[[-20,22,23,-8]]},{"type":"Polygon","properties":{"name":"Western"},"id":"ZM.WE","arcs":[[-9,-24,24,-21]]},{"type":"Polygon","properties":{"name":"Muchinga"},"id":"ZM.MU","arcs":[[-17,-13,25,-1,-4,26]]}]}},"arcs":[[[7247,6650],[-3,-6],[-1,-3],[0,-4],[0,-11],[-1,-6],[-7,-22],[-1,-12],[0,-6],[2,-5],[3,-4],[1,-4],[0,-6],[-147,-219],[-12,-13],[-14,-7],[-362,-69],[-5,-2],[-23,-3],[-9,-12],[-4,-14],[1,-19],[6,-33],[-3,-45],[3,-18],[7,-14],[17,-21],[6,-13],[-1,-12],[-2,-14],[-2,-13],[5,-10],[-3,-6],[-3,-6],[-3,-5],[-3,-3],[-3,-2]],[[6686,5988],[0,1],[-37,-3],[-18,-8],[-29,-24],[-45,-24],[-14,-3],[-10,6],[-15,17],[-11,5],[-11,0],[-8,-4],[-13,-13],[-16,-12],[-38,-15],[-13,-11],[-5,-13],[-11,-40],[-3,-23],[-3,-10],[-2,-8],[4,-8],[25,-38],[14,-6],[13,-1],[10,-5],[4,-18],[-3,-19],[-9,-15],[-12,-9],[-17,-2],[-6,2],[-4,4],[-3,5],[-4,3],[-6,0],[-12,-1],[-6,1],[-22,9],[-36,23],[-7,2],[-34,1],[-10,1],[-8,4],[-11,11],[-15,20],[-9,5],[-69,-2],[-21,-6],[-18,-9],[-15,-11],[-9,20],[-13,-3],[-15,-8],[-12,1],[-9,5],[-7,0],[-4,2],[-1,14],[-2,10],[-70,149],[-22,32],[-51,33],[-7,12],[-4,19],[-10,19],[-11,17],[-11,11],[-30,19],[-12,11],[-5,15],[-2,28],[-8,8],[-30,-5],[-18,6],[-42,26],[-11,10],[-15,38],[-12,10],[-20,-13],[-3,9],[-10,20],[-4,5],[-7,8],[-8,6],[-9,0],[-11,-7],[-10,16],[-7,49],[-10,11],[-14,5],[-7,12],[-8,70],[-3,11],[-12,13],[-6,10],[3,4],[1,10],[-15,60],[-5,9],[-12,15],[-7,11],[-10,30],[-5,8],[-4,15],[-1,54],[3,18],[44,76],[3,4],[19,17],[4,3],[-6,38],[3,22],[8,15],[9,11],[15,38],[-1,35],[1,10],[3,6],[7,13],[2,10],[0,12],[-9,54],[0,10],[12,20],[11,24],[4,11],[0,10],[-1,22],[1,10],[5,9],[15,18],[3,11],[2,11],[8,20],[2,11],[0,45],[4,24],[8,23],[11,22],[15,18],[6,10],[6,22],[13,25],[4,5],[5,3],[11,-1],[5,1],[12,11],[13,16],[11,19],[5,20],[-5,7],[-20,18],[-5,10],[2,12],[5,21],[-1,12],[-21,27],[-11,18],[0,14],[4,10],[-8,15],[4,10],[5,9],[3,12],[2,13],[-1,12],[-6,19],[-8,16],[-7,18],[-2,26],[2,21],[5,16],[2,16],[-4,20],[-2,0],[-7,5],[-2,2],[-3,6],[-1,10],[-2,5],[-29,29],[8,19],[21,29],[13,31],[8,39],[2,81],[-6,73],[3,22],[27,65],[8,44],[8,18],[16,8],[2,4],[-23,27],[-2,15],[-5,6],[-8,3],[-8,7],[-12,19],[-5,21],[-1,47],[-2,11],[-8,21],[-1,10],[-4,13],[-16,22],[-4,9],[5,6],[19,7],[6,8],[-27,-1],[-11,5],[-4,13],[0,18],[-2,13],[-3,11],[-7,11],[-20,17],[-10,12],[-5,16],[2,14],[1,19],[-1,19],[-18,25],[-30,19],[-42,10],[-37,17],[-13,37],[17,37],[36,28],[78,44],[80,68],[142,165],[109,170],[32,87],[4,90],[-36,90],[-3,19],[22,11],[102,18],[148,27],[135,24],[180,32]],[[6495,9818],[-1,-1],[-6,-21],[-25,-58],[-10,-17],[-3,-4],[-12,-13],[-8,-8],[-3,-1],[-26,-8],[-33,-14],[-7,-5],[-4,-3],[-8,-11],[-10,-16],[-25,-59],[-9,-17],[-3,-4],[-6,-6],[-3,-4],[-2,-5],[-27,-78],[-19,-97],[-28,-85],[-5,-9],[-11,-15],[-3,-3],[-8,-5],[-26,-9],[-8,-4],[-3,-3],[-5,-8],[-20,-81],[-2,-5],[-4,-1],[-11,0],[-4,-1],[-3,-4],[-2,-5],[-2,-12],[-2,-6],[-2,-21],[5,-11],[4,-5],[12,-9],[15,-9],[9,-4],[8,-5],[6,-6],[6,-7],[7,-6],[7,-4],[9,-1],[7,2],[5,3],[4,0],[6,-3],[5,-3],[3,-3],[11,-15],[2,-5],[4,-9],[3,-4],[3,-4],[3,-2],[10,-2],[5,-2],[3,-3],[5,-8],[3,-3],[4,-1],[4,1],[7,4],[4,0],[3,-3],[2,-7],[1,-11],[3,-8],[2,-7],[2,-7],[-4,-25],[-1,-6],[1,-10],[15,-61],[-2,-9],[-2,-7],[-2,-6],[-2,-4],[-4,-3],[-4,-2],[-5,-1],[-3,-3],[-2,-5],[-1,-6],[-3,-24],[1,-8],[1,-10],[3,-8],[7,-16],[18,-57],[4,-8],[5,-6],[3,-3],[7,-6],[3,-2],[5,0],[4,1],[8,5],[5,1],[5,0],[11,-1],[4,-2],[4,-2],[13,-13],[3,-4],[13,-32],[6,-7],[5,-4],[4,-2],[3,-3],[3,-4],[2,-3],[2,-2],[3,-1],[10,-2],[5,-3],[3,-7],[5,-11],[5,-5],[5,-3],[10,-2],[4,-2],[8,-5],[4,-2],[4,0],[14,3],[5,-1],[18,-7],[15,-3],[4,-2],[4,-2],[15,-10],[27,-10],[16,-2],[5,-2],[3,-2],[6,-7],[4,-2],[5,0],[10,1],[5,0],[10,-1],[5,0],[10,1],[4,0],[4,-2],[4,-2],[3,-4],[2,-4],[9,-18],[9,-17],[12,-14],[10,-9],[3,-6],[3,-8],[4,-17],[3,-8],[4,-5],[8,-4],[10,-2],[8,-4],[4,-2],[4,-4],[3,-3],[2,-4],[2,-5],[10,-35],[1,-9],[-4,-23],[-22,-66],[-1,-6],[-1,-7],[2,-11],[2,-6],[14,-39],[8,-17],[2,-4],[0,-5],[-3,-5],[-14,-13],[-6,-7],[-5,-8],[-5,-10],[-3,-10],[-14,-76],[-3,-10],[-3,-4],[-2,-3],[-2,-2],[-12,-11],[-8,-5],[-4,-1],[-10,-2],[-5,1],[-11,2],[-5,2],[-13,7],[-9,4],[-5,1],[-39,2],[-20,-3],[-4,-1],[-17,-9],[-7,-5],[-13,-13],[-26,-31],[-7,-6],[-4,-3],[-20,-9],[-31,-18],[-27,-8],[-8,-4],[-3,-2],[-5,-4],[-3,-3],[-4,-7],[-11,-14],[-5,-4],[-25,-17],[-3,-3],[-3,-4],[-2,-8],[-2,-32],[-3,-10],[-3,-6],[-4,-2],[-3,-4],[-5,-8],[-14,-27],[-1,-7],[1,-7],[5,-13],[3,-6],[7,-9],[1,-5],[-2,-7],[-3,-6],[-34,-53],[-4,-10],[-2,-5],[-4,-24],[-4,-6],[-5,-2],[-5,-1],[-18,2],[-5,0],[-6,-3],[-5,-11],[-9,-9],[-104,-77],[-4,-6],[-2,-7],[1,-118],[-2,-7],[-2,-5],[-38,-41],[-17,-22],[-7,-14],[-1,-4],[1,-5],[7,-4],[65,-27],[8,-6],[77,-90],[3,-2],[5,-2],[5,-2],[10,1],[9,2],[5,0],[5,0],[4,-2],[40,-25],[5,-2],[5,0],[4,3],[2,5],[1,6],[2,26],[4,25],[1,6],[-1,7],[-8,13],[-6,8],[-10,16],[-3,7],[-3,11],[-1,10],[1,8],[1,6],[1,6],[-2,7],[-16,28],[-5,16],[10,13],[14,12],[236,146],[6,2],[5,-1],[4,-2],[14,-13],[28,-18],[33,-13],[9,-5],[16,-11],[4,-4],[4,-8],[23,-52],[6,-8],[3,-3],[19,-15],[5,-4],[5,-7],[23,-46],[2,-5],[1,-5],[1,-11],[4,-55],[-50,-380],[6,6],[8,17],[25,11],[4,7],[1,10],[3,11],[5,12],[6,8],[29,24],[10,14],[4,22],[6,8],[6,4],[12,3],[106,-3],[15,-3],[13,-9],[267,-224],[3,-4],[2,-5],[1,-5],[0,-7],[0,-3],[-1,-2]],[[8765,9048],[34,-121],[43,-110],[7,-102],[-93,9],[-86,25],[-86,9],[-100,-17],[-72,-43],[-57,-42],[-65,-9],[-64,26],[-22,-68],[-57,31],[-65,-6],[-57,43],[-43,-34],[-50,-51],[-43,-26],[-22,-59],[-57,-85],[64,-76],[65,-128],[36,-110],[28,-119],[65,-51],[86,-42],[29,-34],[2,-253],[-55,-13],[-4,4],[-4,8],[-6,7],[-9,2],[-8,-5],[-7,-19],[-6,-4],[-11,-3],[-29,-18],[-16,-7],[-22,-3],[-9,-4],[-4,-10],[6,-8],[1,-7],[-4,-3],[-13,0],[-6,-3],[-2,-7],[3,-40],[-3,-12],[-6,-7],[-17,-12],[-6,-8],[-9,9],[-17,7],[-18,4],[-14,0],[-16,-3],[-12,-6],[-38,-33],[2,-7],[11,-13],[5,-8],[2,-7],[3,-4],[10,-1],[7,2],[6,4],[7,1],[6,-7],[4,-21],[-14,-7],[-31,0],[-7,-10],[-1,-9],[4,-10],[17,-22],[4,-6],[-2,-4],[-3,-8],[-4,-7],[-6,-5],[-5,-7],[-1,-7],[-1,-6],[-38,-39],[-14,-6],[-18,0],[8,10],[3,10],[-1,11],[-5,11],[-9,9],[-4,-10],[-1,-24],[-13,-4],[-16,5],[-7,11],[9,13],[-18,0],[-11,-25],[-7,-33],[-8,-22],[-7,-6],[-24,-10],[-9,-1],[-6,-3],[-9,-5],[-11,-5],[-12,-1],[17,-21],[-4,-9],[-12,2],[-11,14],[-8,-4],[-8,-9],[-4,-11],[-2,-11],[-15,-35],[-70,-102],[-18,-44],[-7,-25],[-6,-9],[-19,-21],[-5,-3],[-9,-14],[-4,-3],[-20,4],[-10,1],[-8,-5],[-7,-9],[-5,-10],[-5,-20],[-4,-9],[-5,-8],[-7,-4],[-11,-2],[-15,-8],[-8,-18],[-6,-23],[-9,-21],[-20,-18],[-12,-12],[-25,-11]],[[6495,9818],[14,3],[227,41],[227,40],[172,31],[220,40],[146,26],[22,-96],[43,-100],[54,-93],[58,-72],[28,-26],[35,-24],[38,-16],[36,-1],[18,11],[17,14],[19,12],[20,0],[10,-9],[16,-25],[10,-8],[11,-2],[7,3],[6,5],[45,18],[10,3],[6,3],[2,4],[3,1],[7,-5],[3,-7],[3,-18],[3,-7],[11,-9],[11,-1],[12,1],[13,-1],[13,-8],[19,-25],[13,-10],[33,-11],[17,-17],[6,-26],[0,-37],[7,-44],[19,-31],[83,-74],[14,-7],[17,0],[18,8],[29,18],[20,2],[127,-41],[-16,-41],[0,-50],[18,-40],[36,-10],[18,9],[12,11],[14,6],[21,-3],[25,-17],[9,-3],[8,1],[16,4],[8,0],[10,-6],[8,-5],[31,-38],[17,-14],[17,-7]],[[8079,4692],[-19,-16],[-40,-10],[-19,-13],[-35,-31],[-8,-10],[-3,-3],[-6,5],[-8,1],[-7,-2],[-3,-8],[-4,-14],[-16,-22],[-8,-26],[-11,-2],[-23,6],[-8,-3],[-10,-15],[-23,-11],[-11,-20],[-15,-74],[-5,-14],[-21,-25],[-2,-2],[-14,-17],[5,-16],[-9,-8],[-25,-3],[-10,-6],[-22,-19],[-12,-4],[-6,-7],[0,-17],[-3,-16],[-19,-8],[-1,-4],[-14,-24],[-13,-14],[-6,-8],[-5,-13],[-8,-5],[-8,-3],[-663,-2],[0,-3],[3,-3],[4,-2],[10,-3],[17,-3],[5,-1],[5,-4],[4,-10],[23,-81],[3,-7],[5,-3],[22,-11],[40,-13],[9,-5],[4,-3],[10,-10],[4,-3],[4,-2],[4,-3],[2,-4],[4,-9],[5,-9],[1,-4],[1,-6],[1,-11],[0,-8],[-1,-8],[-4,-13],[-5,-10],[-8,-17],[-6,-9],[-10,-9],[-22,-13],[-7,-7],[-12,-14],[-8,-5],[-4,-4],[-3,-6],[-4,-11],[-4,-8],[-6,-7],[-25,-25],[-33,-51],[-6,-8],[-5,-3],[-5,-1],[-5,0],[-10,2],[-5,-1],[-4,-2],[-3,-6],[-4,-10],[-2,-13],[-3,-9],[-5,-6],[-4,-4],[-5,-2],[-7,-5],[-9,-11],[-3,-7],[-3,-11],[-2,-21],[-5,-19],[-3,-2],[-3,-7],[-4,-11],[-6,-37],[-5,-51],[5,-11],[18,-18],[21,-29],[4,-7]],[[6901,3441],[-43,3],[-8,5],[-9,10],[-3,3],[-5,1],[-6,0],[-5,-1],[-6,-2],[-8,-6],[-9,-1],[-7,-4],[-6,3],[-3,4],[-3,3],[-4,-1],[-5,-8],[-6,-19],[-2,-5],[-3,-5],[-2,-3],[-6,-4],[-7,-2],[-13,-2],[-8,0],[-7,1],[-14,4],[-6,0],[-6,-4],[-17,-16],[-4,-3],[-5,-2],[-18,2],[-5,0],[-68,-31],[-4,-4],[-6,-6],[-7,-7],[-50,-33],[-7,-7],[-5,-3],[-28,-1],[-5,2],[-6,-3],[-7,-5],[-12,-20],[-5,-13],[-3,-23],[-10,-43],[-23,-50],[-57,-12],[-70,-2],[-72,21],[-150,-53],[-44,-10],[-46,-23],[-106,-109],[-68,-27],[-75,-11],[-74,-2],[-141,43],[-24,-17],[-28,-63],[-22,-71],[-23,-47],[-26,-11],[-50,12],[-144,54],[-146,27],[-11,0],[-11,-2],[-8,-4],[-43,-33],[-7,-12],[-2,-10],[6,-14],[11,-9],[20,-6],[46,-8],[13,-5],[11,-12],[22,-50],[12,-46],[2,-17],[1,-10],[-1,-5],[-1,-6],[-8,-12],[-15,-14],[-91,-29],[-37,-89]],[[4939,2451],[-3,-3],[-5,-9],[-3,-3],[-6,2],[-9,5],[-6,1],[-9,-1],[-6,-3],[-8,-10],[-6,8],[-3,9],[-5,7],[-4,5],[-5,4],[-10,11],[-2,4],[-1,5],[2,4],[3,3],[3,3],[3,3],[2,4],[0,4],[-3,3],[-1,5],[-1,6],[1,19],[0,6],[-3,4],[-14,6],[-3,4],[-1,5],[-1,6],[-1,6],[-1,4],[-5,4],[-44,17],[-4,2],[-1,1],[-1,4],[2,9],[-2,5],[-5,3],[-13,-1],[-7,-3],[-4,-5],[-1,-5],[-1,-8],[-2,-4],[-11,-7],[-2,-4],[-2,-6],[0,-6],[-2,-5],[-2,-5],[-2,-4],[-3,-2],[-5,-4],[-6,-6],[-3,-4],[-3,-3],[-5,-2],[-4,-1],[-4,-3],[-2,-4],[-2,-5],[-2,-5],[-4,-2],[-4,0],[-14,8],[-16,6],[-4,0],[-3,-6],[-3,-7],[-71,-148],[-2,-8],[-14,-10],[-9,15],[-10,3],[0,12],[-44,220],[-22,15],[-200,12],[-8,3],[4,7],[20,20],[0,6],[-9,9],[-113,76],[-34,8],[-50,7],[-1215,38]],[[2860,2805],[1,70],[-4,37],[1,9],[1,6],[3,4],[26,26],[6,8],[3,3],[4,3],[5,0],[5,0],[5,-1],[5,-1],[6,1],[6,5],[3,6],[1,6],[-2,29],[1,10],[3,5],[13,15],[12,21],[5,11],[3,10],[1,44],[0,6],[-2,5],[-25,52],[-2,8],[0,10],[0,20],[2,10],[2,7],[7,10],[5,10],[2,9],[1,12],[2,7],[2,6],[3,4],[3,3],[4,3],[9,3],[5,4],[2,5],[0,6],[0,12],[2,32],[-5,20],[-1,16],[1,9],[2,7],[4,9],[3,5],[2,4],[8,24],[6,13],[15,27],[5,8],[3,3],[4,3],[3,2],[6,2]],[[3051,3528],[21,15],[11,11],[15,3],[15,1],[473,-67],[5,-6],[3,-4],[6,-14],[7,-9],[9,-6],[13,-4],[22,-4],[38,-21],[6,-8],[5,-9],[6,-8],[9,-3],[9,2],[30,15],[5,52],[10,21],[35,48],[54,49],[36,62],[7,10],[11,10],[14,6],[14,2],[9,-3],[16,-9],[10,-2],[5,2],[3,5],[4,5],[9,2],[71,-6],[16,5],[30,24],[12,5],[106,5],[14,15],[4,5],[6,17],[-2,112],[-1,5],[0,5],[0,5],[5,9],[15,25],[2,5],[2,6],[1,6],[0,6],[-1,12],[-2,11],[-7,19],[-7,13],[-42,62],[-10,10],[-32,21],[-4,4],[-1,4],[4,8],[9,4],[17,7],[8,4],[4,6],[1,4],[1,5],[-2,39],[1,25],[3,27],[7,22],[18,30],[9,20],[1,6],[1,6],[1,6],[-2,5],[-3,3],[-26,15],[-7,5],[-4,4],[-5,7],[-3,4],[-2,5],[-3,15],[-3,10],[-5,8],[-5,8],[-6,8],[-7,5],[-7,4]],[[4166,4407],[349,-13],[74,-11],[1,-5],[-1,-6],[-1,-6],[-1,-6],[0,-5],[7,-25],[2,-5],[2,-4],[12,-13],[3,-4],[2,-5],[1,-5],[2,-17],[3,-9],[1,-6],[2,-17],[5,-21],[3,-6],[5,-6],[3,-2],[9,-8],[15,7],[23,20],[19,25],[8,25],[-6,22],[-1,15],[4,12],[8,6],[11,3],[10,-3],[6,-17],[4,-6],[5,-6],[6,-1],[5,5],[1,8],[-1,7],[1,7],[27,41],[8,15],[0,7],[-2,6],[-1,6],[3,9],[5,4],[8,1],[7,0],[4,2],[2,13],[-4,13],[0,13],[13,16],[14,-2],[6,-1],[4,-3],[15,-11],[9,-5],[10,-4],[72,-6],[16,-6],[13,-14],[57,-164],[9,-19],[11,-18],[17,-17],[9,-5],[8,-2],[4,2],[4,2],[11,8],[6,3],[7,1],[23,1],[7,2],[4,2],[7,2],[10,2],[48,1],[29,4],[5,2],[4,2],[7,5],[3,4],[3,3],[4,4],[6,4],[11,2],[7,0],[7,-1],[53,-17],[11,-1],[7,0],[17,6],[16,3],[27,1],[9,-1],[40,-13],[15,-2],[56,5],[6,1],[4,2],[8,4],[11,8],[4,2],[34,6],[69,3],[9,4],[4,6],[-6,111],[1,5],[2,4],[3,4],[123,109],[6,7],[15,26],[18,21],[7,7],[29,20],[34,15],[4,2],[3,3],[55,80],[33,39],[3,4],[2,3],[2,7]],[[6058,4739],[7,0],[21,4],[21,1],[19,-11],[8,-12],[5,-16],[8,-11],[13,-3],[9,5],[16,23],[12,8],[19,9],[50,39],[121,54],[17,12],[50,55],[20,10],[20,-1],[15,-11],[15,-14],[16,-12],[11,-1],[7,3],[7,-1],[7,-11],[3,-10],[-2,-11],[-3,-10],[-4,-8],[-7,-5],[-15,-4],[-6,-8],[-1,-8],[2,-21],[-2,-9],[-5,-3],[-8,-2],[-7,-5],[0,-14],[3,-12],[5,-11],[5,-11],[8,-8],[13,-9],[18,-9],[34,-11],[55,0],[13,2],[13,32],[1,112],[0,151],[0,144],[0,151],[0,177],[1,152],[0,168],[0,118],[0,108]],[[6686,5984],[16,4],[4,2],[3,3],[3,4],[8,13],[4,9],[2,6],[1,6],[4,51],[1,6],[2,5],[3,4],[3,3],[3,3],[70,34],[18,5],[20,3],[4,0],[6,-4],[7,-9],[15,-21],[16,-34],[1,-5],[1,-5],[2,-18],[1,-5],[1,-5],[3,-7],[13,-20],[4,-8],[5,-8],[6,-6],[13,-9],[7,-4],[7,-3],[11,-3],[5,-2],[5,-6],[8,-17],[4,-5],[19,-9],[11,-2],[4,-2],[4,-2],[4,-3],[4,-3],[14,-5],[12,-8],[9,-5],[21,-4],[5,-2],[12,-8],[4,-2],[5,-1],[15,0],[7,-3],[8,-4],[12,-8],[8,-3],[6,0],[15,3],[10,0],[5,-1],[5,-4],[4,-5],[5,-11],[4,-6],[5,-6],[8,-4],[6,-1],[5,1],[9,3],[9,1],[10,-2],[5,-3],[4,-5],[5,-11],[2,-8],[0,-8],[-1,-45],[-3,-12],[-8,-20],[-1,-5],[-1,-6],[0,-12],[1,-11],[1,-5],[1,-5],[4,-5],[6,-6],[10,-8],[22,-12],[9,-5],[4,-5],[5,-8],[3,-13],[0,-8],[-1,-7],[-7,-21],[-1,-6],[0,-6],[1,-5],[6,-9],[10,-11],[24,-22],[12,-7],[8,-3],[12,7],[7,6],[7,6],[10,16],[4,2],[4,0],[5,-2],[4,-5],[11,-31],[6,-10],[6,-7],[10,-7],[17,-9],[4,-4],[3,-5],[2,-10],[1,-7],[-1,-7],[-2,-5],[-2,-5],[-5,-8],[-12,-16],[-2,-4],[-9,-26],[-1,-5],[1,-5],[13,-52],[1,-11],[0,-6],[-4,-25],[3,-7],[6,-7],[52,-42],[17,-10],[8,-6],[8,-5],[5,-1],[10,0],[28,7],[6,0],[5,-1],[30,-10],[11,-1],[6,-1],[23,-10],[7,-1],[5,1],[10,0],[11,-10],[64,-72],[11,-9],[5,-1],[11,0],[5,1],[5,1],[4,2],[3,3],[3,4],[3,4],[2,4],[8,22],[1,2],[1,9],[1,19],[2,5],[2,4],[3,3],[8,4],[17,7],[5,1],[38,0],[11,-2],[5,-2],[30,-16],[7,-6],[4,-4],[3,-4],[5,-14],[3,-16],[14,-221],[5,-19],[16,-37],[20,-25],[11,-16],[1,-10],[2,-18],[-1,-34],[0,-50]],[[4166,4407],[-29,22],[-13,13],[-3,6],[-4,9],[-4,13],[-1,11],[4,66],[3,16],[6,18],[4,9],[3,4],[17,15],[3,4],[2,5],[3,7],[9,49],[3,8],[3,6],[3,3],[8,4],[17,7],[8,5],[4,4],[4,6],[10,27],[2,3],[4,4],[19,11],[5,5],[5,9],[9,18],[3,10],[3,9],[0,6],[-2,18],[-2,10],[-10,23],[-1,7],[-2,8],[0,17],[2,10],[2,7],[2,5],[2,4],[3,4],[7,7],[47,34],[7,6],[8,11],[6,11],[3,8],[2,7],[23,116],[0,1],[-4,2],[-4,2],[-5,1],[-6,0],[-19,-4],[-5,2],[-5,4],[-3,8],[-3,5],[-3,3],[-4,1],[-3,4],[-3,9],[-2,4],[-3,4],[-4,2],[-4,2],[-2,0],[-15,1],[-5,2],[-4,3],[-7,6],[-4,2],[-23,11],[-4,3],[-3,3],[-6,8],[-3,3],[-8,6],[-9,5],[-4,3],[-4,4],[-2,6],[-1,5],[1,6],[8,13],[8,22],[3,6],[3,9],[1,6],[-2,6],[-2,4],[-16,20],[-4,2],[-4,4],[-4,5],[-2,9],[-3,6],[-3,5],[-4,3],[-3,4],[-4,5],[-2,9],[0,7],[6,11],[3,8],[8,44],[2,7],[3,6],[7,13],[6,7],[8,5],[4,1],[5,1],[15,2],[4,1],[9,4],[7,6],[6,6],[8,12],[9,19],[30,44],[7,5],[8,4],[34,7],[5,2],[4,4],[0,4],[-2,3],[-6,8],[0,1],[-8,23],[-2,7],[-1,8],[0,14],[1,8],[3,7],[2,6],[4,10],[0,31],[-1,6],[-10,35],[-1,6],[-1,7],[4,2],[4,-1],[19,-5],[24,-1],[8,1],[16,3],[10,2],[108,-13],[5,3],[6,4],[10,15],[5,5],[11,7],[4,3],[13,7],[11,17],[5,4],[4,3],[9,3],[4,2],[6,6],[13,13],[7,6],[4,1],[12,4],[8,-7],[13,-9],[12,-10],[0,-6],[-2,-7],[3,-6],[24,-5],[10,-5],[3,-2],[12,19],[13,5],[3,2],[37,29],[3,3]],[[4797,5899],[4,-4],[37,-47],[24,-9],[38,-4],[39,2],[27,8],[17,15],[9,14],[11,8],[22,-2],[17,-8],[49,-34],[12,-18],[4,-25],[5,-22],[19,-7],[16,3],[12,1],[63,-7],[8,-5],[3,-9],[2,-10],[4,-9],[21,-19],[12,6],[13,15],[21,6],[17,-9],[13,-14],[14,-12],[23,0],[17,3],[17,-1],[16,-6],[15,-10],[71,-71],[12,-22],[16,-50],[11,-23],[29,-35],[8,-19],[0,-27],[-10,-16],[-14,-12],[-8,-14],[6,-26],[17,-27],[19,-22],[14,-24],[3,-52],[9,-10],[12,0],[14,7],[8,12],[12,29],[12,8],[39,-10],[35,-41],[58,-87],[15,-16],[6,-11],[7,-36],[4,-5],[12,-4],[3,-5],[-1,-5],[-4,-11],[0,-4],[1,-5],[-2,-11],[1,-5],[4,-5],[5,-1],[4,-1],[3,-3],[8,-35],[8,-6],[17,-1],[8,-3],[10,-15],[26,-150],[14,-42],[26,-29],[11,-16],[14,-4],[16,4],[15,7],[16,0]],[[7041,3126],[-2,2],[0,121],[-5,30],[-4,3],[-9,11],[-7,12],[-8,12],[-7,6],[-13,7],[-5,4],[-4,5],[-34,52],[-4,4],[-4,3],[-19,9],[-6,6],[-3,8],[-3,13],[-3,7]],[[8079,4692],[9,7],[19,7],[14,-3],[17,-5],[18,-3],[14,7],[67,60],[21,31],[10,38],[7,40],[15,59],[4,9],[18,5],[7,5],[4,7],[2,10],[6,20],[13,14],[12,15],[3,24],[5,0],[2,-4],[2,-5],[2,-5],[14,10],[19,12],[11,10],[9,13],[5,3],[18,2],[6,5],[4,6],[2,9],[11,-5],[7,2],[7,5],[10,5],[-5,19],[-1,21],[2,20],[4,16],[1,5],[-1,11],[0,4],[5,5],[5,1],[5,-1],[3,2],[11,13],[4,6],[3,9],[9,1],[18,6],[18,8],[7,10],[3,18],[13,46],[8,16],[8,7],[7,2],[5,4],[4,21],[8,20],[2,11],[1,13],[5,33],[0,34],[3,10],[4,7],[3,8],[4,25],[9,12],[18,99],[0,44],[2,8],[8,14],[2,6],[1,15],[4,6],[5,6],[8,10],[6,12],[11,30],[11,13],[42,39],[3,10],[15,21],[7,21],[4,22],[2,21],[70,-18],[51,0],[43,51],[14,59],[36,43],[50,0],[108,8],[194,68],[115,43],[36,93],[57,111],[0,48],[17,28],[34,17],[41,13]],[[9683,6506],[8,-130],[-3,-37],[-11,-38],[0,-16],[10,-23],[3,-14],[-3,-16],[-5,-16],[-8,-52],[-34,-92],[-3,-34],[2,-34],[6,-16],[24,-27],[10,-14],[11,-33],[15,-71],[16,-30],[30,-12],[63,22],[34,-13],[14,0],[10,-4],[1,-21],[-7,-16],[-4,-3],[-22,-15],[-7,-17],[-13,-3],[-3,-7],[-1,-25],[-8,-12],[-26,-12],[-9,-11],[-14,-23],[-17,-21],[-20,-14],[-19,-5],[-7,3],[-7,5],[-8,5],[-11,1],[-22,-5],[-7,-3],[-10,-13],[-14,-35],[-12,-10],[-9,-3],[-5,-3],[-4,-4],[-4,-4],[-5,-5],[-3,-7],[-4,-5],[-9,-1],[-4,5],[-10,23],[-6,7],[-8,2],[-6,-1],[-14,-4],[-7,-4],[-8,-8],[-7,-4],[-6,7],[-4,8],[-4,5],[-6,2],[-7,-4],[-12,-12],[-9,-14],[-26,-61],[-31,-53],[-12,-27],[-3,-18],[5,-74],[6,-11],[23,-17],[21,-23],[7,-24],[-4,-29],[-23,-61],[-14,-112],[1,-18],[4,-17],[7,-17],[13,-23],[3,-12],[-5,-14],[-25,-9],[-22,-31],[-15,-40],[-12,-57],[-12,-54],[-15,-39],[-24,-15],[-16,-3],[-7,-11],[-2,-16],[1,-18],[-4,-23],[-11,-9],[-32,-5],[-11,-9],[-23,-23],[-11,-2],[-16,7],[-12,1],[-9,-8],[-3,-21],[10,-32],[27,-7],[31,-1],[23,-11],[32,-53],[5,-12],[-7,-11],[-32,-17],[-9,-12],[5,-27],[25,-13],[31,-7],[26,-11],[13,-13],[42,-61],[4,-15],[2,-15],[5,-16],[7,-7],[15,1],[7,-4],[5,-9],[1,-5],[-2,-6],[-3,-51],[4,-15],[20,-30],[16,4],[27,51],[11,15],[12,7],[30,10],[8,9],[8,26],[8,5],[13,-11],[26,-58],[15,-21],[-62,-24],[-75,-30],[-107,-42],[-148,-58],[-143,-57],[-130,-51],[-90,-36],[-79,-31],[-69,-15],[-32,-11],[-65,-34],[-86,-33],[-112,-43],[-123,-47],[-58,-35],[-80,-49],[-73,-31],[-89,-25],[-110,-31],[-89,-25],[-15,-1],[-121,-32],[-85,-23],[-119,-50],[-73,-30],[-90,-39],[-80,-45],[-63,-37],[-75,-10],[-14,-4],[0,-1]],[[7041,3126],[-1,-7],[6,-30],[0,-45],[5,-44],[31,-126],[22,-49],[27,-20],[13,-6],[11,-13],[8,-18],[6,-19],[4,-21],[2,-66],[3,-11],[13,-20],[2,-10],[-2,-10],[-16,-35],[-5,-23],[2,-14],[24,-29],[5,-8],[9,-30],[-2,-3],[-12,-5],[-34,-16],[-24,-1],[-27,14],[-14,7],[-22,3],[-7,-3],[-13,-13],[-7,-5],[-13,-4],[-10,4],[-22,18],[-34,8],[-35,-6],[-34,-10],[-33,-7],[-37,5],[-74,23],[-38,4],[-19,-5],[-35,-18],[-37,-7],[-49,-19],[-21,-3],[-18,3],[-16,5],[-18,3],[-21,-7],[-32,-31],[-15,-11],[-74,-7],[-13,-3],[-188,-100],[-30,-37],[-8,-5],[-18,-5],[-16,-12],[-14,-14],[-8,-11],[-19,-39],[-10,-12],[-21,-5],[-39,-1],[-18,-3],[-4,-3]],[[5957,2138],[0,1],[-13,12],[-18,14],[-20,5],[-14,-17],[-10,6],[-9,0],[-7,-4],[-3,-10],[-10,7],[-6,-3],[-4,-6],[-4,-4],[-8,1],[-13,4],[-6,1],[-15,-2],[-5,1],[-8,4],[-58,53],[-11,6],[-17,1],[-34,-6],[-18,4],[-14,11],[-37,44],[-14,13],[-14,5],[-32,5],[-10,5],[-17,14],[-9,6],[-17,5],[-85,-7],[-14,-6],[-25,-20],[-9,-2],[-8,6],[-27,26],[-14,9],[-84,38],[-18,3],[-16,6],[-9,14],[-8,18],[-11,17],[-32,17],[-35,2],[-34,-9],[-28,-17],[-8,5],[-5,6],[-2,8],[2,8],[-16,12],[-20,4],[-37,-1]],[[3051,3528],[-22,1],[-10,-4],[-4,-3],[-20,-11],[-15,-2],[-12,0],[-8,1],[-5,2],[-4,3],[-4,3],[-3,3],[-9,5],[-16,4],[-56,6],[-11,0],[-5,-2],[-15,-9],[-9,-4],[-37,-9],[-13,-5],[-8,-4],[-3,-3],[-17,-7],[-33,-9],[-8,-1],[-41,3],[-8,0],[-8,-2],[-16,-6],[-8,-1],[-6,-1],[-6,2],[-7,2],[-7,4],[-6,5],[-7,6],[-18,24],[-10,16],[-2,4],[-3,10],[-1,5],[-1,6],[4,33],[0,5],[-2,23],[0,10],[1,3],[2,5],[1,2],[1,2],[3,2],[5,3],[19,8],[22,12],[3,3],[7,6],[9,11],[2,5],[1,6],[2,44],[4,23],[1,2],[1,4],[1,5],[3,4],[5,8],[7,14],[3,11],[3,12],[1,7],[0,36],[-2,8],[-4,8],[-9,13],[-6,5],[-6,2],[-33,-7],[-9,2],[-15,6],[-96,56],[-6,2],[-20,4],[-19,6],[-17,3],[-44,17],[-7,4],[-5,5],[-4,9],[-2,5],[-4,9],[-1,5],[-1,5],[-1,6],[1,26],[0,5],[-7,19],[-2,11],[-2,4],[-2,5],[-5,6],[-10,11],[-20,27],[-4,5],[-3,1],[-3,0],[-7,-5],[-4,-3],[-4,-1],[-4,-2],[-3,-4],[-2,-5],[-1,-6],[0,-11],[-2,-3],[-1,-1],[-5,-1],[-2,1],[-1,1],[-1,3],[0,5],[2,19],[-1,6],[-3,1],[-4,0],[-8,3],[-4,1],[-2,-3],[-1,-4],[2,-10],[0,-5],[-2,-4],[-3,-2],[-4,1],[-9,4],[-5,1],[-10,0],[-3,4],[-2,5],[-7,10],[-10,7],[-7,5],[-4,5],[-4,6],[-19,23],[-3,-1],[-3,-3],[-2,-5],[-4,-3],[-8,-2],[-1,-3],[2,-4],[2,-3],[3,-4],[1,-4],[-2,-3],[-4,-1],[-5,-1],[-12,1],[-6,2],[-5,-1],[-3,-3],[-3,-4],[-3,-3],[-6,-1],[-3,3],[-3,5],[-2,5],[-2,5],[-3,-1],[-2,-3],[-3,-4],[-3,-3],[-4,-1],[-5,0],[-32,11],[-7,5],[-5,5],[-1,12],[0,6],[-2,7],[-3,7],[-9,10],[-6,3],[-3,0],[-1,-4],[-1,-5],[-2,-4],[-3,-4],[-2,-3],[0,-5],[2,-4],[5,-5],[2,-4],[1,-5],[-2,-3],[-5,-2],[-7,1],[-10,2],[-6,4],[-17,13],[-13,14],[-4,1],[-5,0],[-11,-8],[-9,-3],[-4,-2],[-5,-8],[-4,-2],[-5,-1],[-8,1],[-5,0],[-5,-2],[-3,-3],[-4,-10],[-3,-4],[-3,-3],[-8,-4],[-4,-2],[-6,-1],[-7,1],[-6,3],[-6,6],[-5,2],[-4,-1],[-3,-4],[-2,-4],[-2,-6],[-2,-6],[-2,-6],[-3,-5],[-5,-2],[-4,2],[-7,9],[-4,1],[-3,-1],[-8,-12],[-9,-10],[-7,-6],[-4,-2],[-8,-3],[-8,-1],[-11,1],[-8,4],[-12,7],[-7,2],[-6,0],[-7,-6],[-4,-2],[-5,-1],[-3,-1],[-4,-3],[-3,0],[-6,1],[-7,1],[-18,8],[-16,0],[-13,4],[-6,11],[0,20],[-9,-6],[-20,-22],[-10,-4],[-9,-2],[-10,-3],[-28,-20],[-15,5],[-14,11],[-13,6],[-14,-4],[-30,-19],[-34,-10],[-31,-27],[-14,-10],[-88,-26],[-24,-15],[-27,-27],[-8,-7],[-11,-4],[-9,0],[-8,3],[-10,1],[-15,-5],[-22,-22],[-14,-8],[-35,0],[4,9],[0,7],[-1,5],[-3,7],[-35,-14],[4,20],[19,34],[11,15],[3,5],[1,5],[-3,3],[-5,1],[-66,8],[-8,3],[-5,3],[-7,6],[-5,8],[-2,4],[-2,5],[-3,11],[0,12],[0,12],[0,3],[-2,6],[-5,5],[-10,7],[-8,3],[-7,0],[-5,0],[-4,-2],[-22,-11],[-15,-4],[-5,0],[-4,2],[-2,1],[-2,4],[-2,4],[-3,11],[-5,15],[-5,8],[-12,15],[-75,56],[-21,10],[-7,1],[-5,-1],[-3,-3],[-22,-24],[-3,-3],[-5,-2],[-40,-2],[-4,-2],[-3,-3],[-2,-5],[-10,-59],[-2,-6],[-6,-11],[-9,-2],[-11,3],[-8,5],[-8,6],[-9,7],[-21,4],[-10,5],[-5,8],[-1,8],[-4,8],[-5,7],[-4,3],[-15,4],[-7,8],[-16,2],[-9,0],[-7,2],[-5,2],[-21,16],[-3,4],[-8,19],[-2,3],[-2,2],[-58,41],[-125,121],[-9,7],[-20,13],[-9,3],[-7,2],[-5,-1],[-4,-1],[-4,-3],[-3,-3],[-9,-18],[-2,-4],[-4,-3],[-11,-8],[-4,-3],[-2,-5],[-4,-9],[-3,-4],[-3,-3],[-25,-13],[-6,-2],[-8,-1],[-14,-1],[-8,2],[-7,2],[-3,2],[-14,12],[-21,25],[-10,8],[-26,14],[-16,3]],[[0,4429],[0,92],[0,153],[0,152],[0,153],[0,152],[106,0],[107,0],[106,0],[106,0],[106,0],[107,0],[106,0],[106,0],[106,0],[107,0],[106,0],[106,0],[106,0],[107,0],[106,0],[106,0],[28,0],[-10,37],[-15,32],[-19,29],[-46,56],[-18,28],[-8,33],[6,40],[17,45],[16,75],[15,71],[11,29],[38,66],[29,49],[7,17],[3,17],[-9,46],[-3,62],[-9,25],[-22,27],[-18,31],[-5,46],[6,142],[5,130],[18,49],[2,11],[-4,24],[-4,76],[-7,25],[-9,19],[-7,19],[0,26],[5,20],[15,40],[24,43],[4,12],[0,16],[-3,25],[1,13],[2,11],[9,15],[27,24],[8,14],[0,12],[-38,98],[-5,26],[3,144],[-16,3],[-5,14],[4,39],[-1,56],[3,18],[5,20],[-3,15],[-16,29],[-6,18],[-6,49],[30,-1],[40,-9],[36,-16],[20,-21],[0,-9],[-5,-18],[0,-9],[2,-12],[6,-20],[1,-12],[-1,-33],[6,-13],[17,3],[17,7],[14,-1],[32,-11],[17,-3],[32,0],[16,-2],[19,-10],[25,-18],[21,-23],[10,-20],[-3,-12],[-7,-9],[-7,-9],[0,-15],[4,-12],[15,-15],[6,-8],[4,-18],[1,-21],[-1,-22],[-3,-20],[-7,-16],[-27,-50],[-11,-14],[-36,-12],[-11,-11],[8,-18],[13,-8],[36,0],[16,-3],[19,-14],[29,-31],[17,-9],[20,-2],[18,4],[36,15],[8,1],[10,-1],[9,2],[6,8],[2,11],[4,10],[5,8],[8,8],[7,4],[19,5],[9,5],[9,10],[15,25],[10,10],[33,16],[64,0],[33,8],[64,37],[35,13],[33,-3],[123,13],[51,12],[81,47],[27,6],[10,-11],[2,-23],[-1,-26],[2,-20],[-1,-10],[-7,-7],[-17,-8],[-10,-9],[4,-9],[10,-9],[4,-8],[-7,-19],[-10,-9],[-7,-12],[1,-24],[6,-21],[20,-39],[6,-18],[-1,-10],[-12,-16],[-3,-9],[0,-10],[2,-18],[23,-82],[8,-18],[7,-8],[6,-4],[7,-1],[11,0],[12,-3],[5,-7],[4,-8],[8,-9],[49,-27],[15,-15],[1,-6],[1,-5],[-1,-5],[-7,-26],[5,-14],[13,-6],[17,0],[8,5],[5,7],[6,6],[11,2],[9,3],[3,10],[3,10],[7,6],[39,-1],[29,-22],[27,-29],[33,-22],[15,-3],[50,0],[9,1],[17,9],[6,2],[10,-2],[4,-3],[3,-5],[47,-44],[18,-8],[12,-11],[12,-31],[15,-8],[11,-2],[148,2],[19,-8],[17,-13],[18,-10],[30,2],[18,-9],[10,-1],[10,5],[16,13],[9,4],[32,7],[33,1],[20,-8],[15,-13],[13,-15],[16,-14],[30,-12],[69,-5],[33,-8],[16,-11],[15,-13],[14,-8],[18,4],[13,15],[10,17],[13,13],[22,0],[39,-5],[37,9],[33,23],[30,33],[16,40],[4,83],[8,39],[13,23],[13,14],[9,15],[1,27],[-10,43],[-1,19],[12,15],[7,1],[19,-3],[8,0],[33,13],[36,3],[25,11],[5,1],[15,-24],[9,-46],[4,-50],[-2,-34],[21,-88],[159,-115],[40,-80],[4,-41],[41,-139],[14,-21],[46,-44]],[[5957,2138],[-12,-6],[-29,-32],[-19,-27],[-2,-7],[-12,-21],[-3,-11],[2,-9],[4,-7],[4,-6],[2,-5],[-5,-35],[-11,-42],[-4,-40],[14,-29],[-20,-54],[-3,-22],[3,-17],[14,-43],[0,-23],[-20,-39],[-4,-8],[-5,-36],[-12,-16],[-34,-29],[-7,-18],[-17,-18],[-7,-8],[-12,-2],[-24,0],[-41,-9],[-310,-139],[-58,-43],[-84,-80],[-78,-38],[-132,-65],[-44,-30],[-34,-43],[-116,-199],[-14,-36],[-18,-80],[-23,-51],[-45,-53],[-88,-91],[-226,-267],[-9,-15],[-1,-10],[1,-26],[2,-23],[-29,-41],[-32,-35],[-25,-27],[-23,-15],[-13,-4],[-41,-2],[-9,-4],[-31,-24],[-20,8],[-81,-42],[-21,-3],[-13,-4],[-11,-8],[-25,-26],[-10,-3],[-12,3],[-49,17],[-14,8],[-12,12],[-13,17],[-11,10],[-14,7],[-23,4],[-36,13],[-65,41],[-40,8],[-31,-5],[-7,2],[-5,6],[-7,5],[-8,5],[-39,5],[-8,3],[-5,6],[-5,10],[-6,8],[-7,4],[-8,-5],[-30,-26],[-8,-5],[-20,-4],[-14,-10],[-15,-4],[-5,-2],[-1,-4],[2,-13],[-1,-4],[-12,-4],[-16,0],[-14,-4],[-5,-12],[-6,7],[-47,-28],[-10,-1],[-36,1],[-52,28],[-9,12],[-6,16],[1,15],[14,5],[-12,18],[-39,18],[-8,16],[-8,11],[-17,12],[-19,11],[-32,9],[-10,11],[-11,8],[-21,-3],[-45,-22],[-58,-13],[-5,-2],[-7,-9],[-5,-2],[-6,1],[-8,5],[-4,1],[-64,0],[-10,2],[-28,12],[-26,-1],[-9,1],[-17,9],[-26,23],[-16,9],[-6,7],[-5,12],[-9,12],[-12,8],[-12,3],[-14,1],[-7,3],[-11,17],[-4,3],[-10,6],[-4,4],[-1,6],[1,13],[-3,6],[-12,15],[-6,0],[-8,-12],[-2,7],[-4,7],[-6,5],[-8,2],[-2,5],[-7,30],[-3,2],[-15,15],[-3,4],[-10,0],[-6,2],[-4,4],[-6,8],[0,7],[6,17],[-3,3],[-9,-1],[-16,-6],[-8,0],[-14,12],[-9,16],[-1,1]],[[2557,516],[8,69],[5,22],[3,4],[5,6],[3,5],[2,2],[9,9],[4,6],[6,11],[2,7],[1,7],[-1,6],[-3,11],[-1,8],[0,55],[2,11],[2,7],[6,8],[14,12],[3,3],[14,28],[9,12],[16,33],[1,7],[0,6],[-4,8],[-2,4],[-3,3],[-3,8],[-1,11],[4,26],[2,12],[4,8],[7,6],[23,14],[5,5],[6,8],[10,18],[5,13],[2,9],[0,6],[-1,5],[-2,5],[-2,6],[-1,8],[2,15],[7,6],[8,5],[9,2],[44,25],[6,7],[8,12],[14,28],[5,14],[2,10],[-25,97],[-4,9],[-2,5],[-1,6],[1,16],[7,49],[1,12],[-1,9],[-3,3],[-7,6],[-8,6],[-5,2],[-10,3],[-90,13],[-5,2],[-5,5],[-11,26],[-2,11],[-3,16],[-1,4],[-3,4],[-4,4],[-30,23],[-23,24],[-3,3],[-1,1],[-1,2],[-2,12],[0,5],[1,3],[1,1],[3,1],[14,3],[4,1],[4,2],[7,6],[4,4],[86,133],[6,7],[16,9],[3,3],[14,13],[3,3],[5,1],[5,1],[4,2],[5,2],[11,8],[12,15],[2,4],[3,3],[4,3],[4,3],[4,2],[13,4],[12,6],[5,7],[6,13],[21,56],[3,4],[8,16],[10,27],[4,7],[6,7],[5,8],[5,10],[2,4],[3,4],[4,3],[4,2],[4,2],[3,3],[4,2],[3,3],[3,3],[3,5],[7,9],[5,7],[0,5],[-1,4],[-4,3],[-5,2],[-5,2],[-11,1],[-6,1],[-4,2],[-4,3],[-3,3],[-6,8],[-18,16],[-3,3],[-2,4],[-5,9],[-1,5],[-2,14],[0,11],[2,7],[3,5],[8,6],[4,4],[4,7],[-1,5],[-2,3],[-3,6],[-2,7],[-1,14],[2,8],[3,5],[4,3],[5,6],[6,11],[9,27],[13,108],[0,13],[-1,5],[-2,5],[-2,4],[-6,8],[-7,6],[-4,3],[-5,2],[-4,0],[-4,-1],[-4,-3],[-5,-8],[-8,-13],[-6,-7],[-4,-3],[-4,-2],[-5,-1],[-5,0],[-5,0],[-5,1],[-5,2],[-4,3],[-7,7],[-6,7],[-11,21],[-2,5],[-2,7],[-1,11],[1,6],[2,5],[12,9],[3,4],[4,6],[1,7],[1,6],[-1,6],[-1,5],[-2,4],[-3,4],[-3,3],[-4,3],[-8,4],[-19,14],[-3,5],[-3,5],[-2,9],[1,6],[3,5],[24,22],[4,5],[3,6],[4,13],[1,7],[-1,6],[-5,8],[-13,16],[-1,2],[-1,3],[-1,6],[1,6],[2,4],[3,3],[17,8],[4,1],[5,-2],[3,-2],[4,0],[3,1],[3,4],[12,26],[3,8],[3,14],[0,11],[-1,14],[0,8],[2,6],[2,5],[7,6],[7,10],[5,9],[2,7],[0,6],[-2,5],[-2,4],[-9,18],[-5,14]],[[2557,516],[-11,8],[-17,-9],[-11,18],[-23,12],[-58,13],[-28,-1],[-9,2],[-6,5],[-4,5],[-5,2],[-73,13],[-38,0],[-8,-3],[-6,-7],[-5,-7],[-9,-6],[-13,-13],[-9,-5],[-8,0],[-8,1],[-13,6],[-8,6],[-5,7],[-7,5],[-22,5],[-16,9],[-26,5],[-36,15],[-15,3],[-15,-2],[-36,-12],[-7,-3],[-9,6],[-46,2],[-16,2],[-15,-1],[-25,-6],[-37,-8],[-37,-9],[-36,-8],[-37,-9],[-36,-9],[-37,-8],[-37,-9],[-36,-8],[-37,-9],[-37,-8],[-36,-9],[-37,-8],[-36,-9],[-37,-8],[-37,-9],[-36,-9],[-26,-6],[-16,0],[-30,-7],[-34,-8],[-5,14],[-1,13],[6,14],[-19,18],[-17,23],[-17,14],[-13,7],[-12,5],[-28,2],[-14,-2],[-15,-4],[-15,-2],[-15,4],[-10,13],[0,14],[1,16],[-2,16],[-9,11],[-38,17],[-20,19],[-21,27],[-16,31],[-7,27],[-5,11],[-36,44],[-12,8],[-41,13],[-52,25],[-23,18],[-34,35],[-26,16],[-12,11],[-8,15],[-9,47],[-12,27],[-17,27],[-39,47],[-12,10],[-51,24],[-10,0],[-5,4],[-4,9],[0,17],[-2,9],[-11,12],[-27,10],[-12,9],[-7,12],[-10,29],[-62,112],[-6,9],[-8,5],[-14,3],[-5,3],[-4,6],[-6,12],[-13,21],[-6,13],[-9,10],[-22,5],[-4,2],[-6,8],[-4,3],[-3,-2],[-3,-3],[-8,-3],[-13,-5],[-7,-1],[-12,4],[-73,69],[-6,14],[-2,17],[-4,15],[-9,6],[-16,2],[-4,8],[2,11],[1,13],[-5,15],[-14,28],[-4,13],[0,17],[5,19],[7,17],[8,13],[1,13],[-14,8],[-28,7],[-1,6],[-1,22],[-1,10],[-3,5],[-10,10],[-4,6],[-4,15],[-2,13],[-3,13],[-9,14],[7,-1],[22,1],[-30,55],[-23,32],[-2,22],[0,16],[0,62],[0,64],[0,3],[0,46],[0,103],[0,103],[0,104],[0,103],[0,45],[0,30],[0,22],[0,40],[0,153],[0,152],[0,153],[0,152],[0,153],[0,152],[0,153],[0,153],[0,152],[0,153],[-1,152],[0,61]],[[6686,5984],[0,4]],[[8765,9048],[19,-3],[111,2],[35,-10],[31,-24],[9,-14],[17,-46],[12,-22],[11,-9],[33,-4],[73,-18],[61,-6],[11,-7],[12,-15],[3,-8],[3,-15],[5,-8],[6,-2],[15,2],[6,-2],[40,-31],[64,-28],[13,-10],[2,-59],[4,-14],[8,-8],[5,2],[6,5],[10,1],[6,-4],[12,-14],[8,-4],[0,-28],[-15,-73],[10,-27],[12,-5],[9,5],[10,8],[11,3],[10,-5],[3,-11],[2,-12],[4,-9],[19,-9],[8,19],[3,30],[5,26],[19,-11],[47,-3],[17,-14],[12,-25],[4,-14],[1,-15],[-2,-11],[-5,-8],[-3,-10],[3,-15],[8,-14],[21,-16],[10,-11],[12,-28],[7,-12],[11,-11],[10,-6],[32,-14],[5,-8],[14,-40],[5,-28],[-6,-21],[-25,-47],[-16,-47],[-5,-26],[0,-26],[11,-19],[70,-36],[18,-18],[14,-18],[15,-15],[22,-9],[16,-24],[17,-14],[13,-17],[2,-32],[-6,-56],[3,-24],[23,-63],[7,-12],[24,-25],[6,-8],[17,-46],[13,-18],[23,-3],[1,-27],[6,-18],[0,-10],[1,-4],[0,-4],[-14,-24],[-13,-15],[-34,-28],[-11,-6],[-11,-8],[-42,-55],[-14,-41],[-9,-17],[-18,-13],[-13,-3],[-15,-18],[-11,-6],[-13,1],[-29,7],[-12,-3],[-11,-5],[-22,-5],[-12,-5],[-10,-11],[-16,-28],[-13,-9],[-10,0],[-9,3],[-8,-3],[-8,-18],[0,-14],[6,-6],[11,0],[12,2],[12,-12],[7,-32],[2,-31],[3,-30],[8,-30],[13,-28],[15,-26],[19,-22],[28,-56],[-8,-30],[-11,-29],[-60,-107],[-2,-7],[3,-11],[-1,-7],[-5,-4],[-13,-7],[-4,-5],[-1,-15],[2,-13],[-1,-13],[-7,-13],[-22,20],[-8,-14],[4,-86],[-1,-13],[-5,-18],[-13,-32],[3,-8],[14,-6],[15,0],[15,2],[14,-3],[11,-15],[5,-16],[2,-35]]],"transform":{"scale":[0.0011695494501450135,0.0009876095438543884],"translate":[21.97987756300006,-18.069231871999932]}};
  Datamap.prototype.zweTopo = '__ZWE__';

  /**************************************
                Utilities
  ***************************************/

  //convert lat/lng coords to X / Y coords
  Datamap.prototype.latLngToXY = function(lat, lng) {
     return this.projection([lng, lat]);
  };

  //add <g> layer to root SVG
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

  Datamap.prototype.updateChoropleth = function(data) {
    var svg = this.svg;
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
        else {
          color = this.options.fills[ subunitData.fillKey ];
        }
        //if it's an object, overriding the previous data
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

        //add a single layer, reuse the old layer
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

  // expose library
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
