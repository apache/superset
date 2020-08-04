<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Examples for bootstrap-slider plugin">
    <meta name="author" content="">

    <title>Slider for Bootstrap Examples Page</title>

    <!-- core CSS -->
    <link href="<%= css.bootstrap %>" rel="stylesheet">
    <link href="<%= css.slider %>" rel="stylesheet">
    <!-- Hightlight.js Theme Styles -->
    <link href="<%= css.highlightjs %>" rel="stylesheet">
    <!-- Custom styles for this template -->
    <style type='text/css'>

    	/* Space out content a bit */
			body {
			  padding-top: 20px;
			  padding-bottom: 20px;
			}

			h1 small {
				font-size: 51%;
			}

			/* Everything but the jumbotron gets side spacing for mobile first views */
			.header,
			.marketing,
			.footer {
			  padding-left: 15px;
			  padding-right: 15px;
			}

			/* Custom page header */
			.header {
			  border-bottom: 1px solid #e5e5e5;
			}
			/* Make the masthead heading the same height as the navigation */
			.header h3 {
			  margin-top: 0;
			  margin-bottom: 0;
			  line-height: 40px;
			  padding-bottom: 19px;
			}

			/* Custom page footer */
			.footer {
			  padding-top: 19px;
			  color: #777;
			  border-top: 1px solid #e5e5e5;
			}

			/* Customize container */
			.container {
				min-width: 640px;
			}
			@media (min-width: 768px) {
			  .container {
			    max-width: 1000px;
			  }
			}
			.container-narrow > hr {
			  margin: 30px 0;
			}

			/* Main marketing message and sign up button */
			.title {
			  text-align: center;
			  border-bottom: 1px solid #e5e5e5;
			}

			/* Responsive: Portrait tablets and up */
			@media screen and (min-width: 768px) {
			  /* Remove the padding we set earlier */
			  .header,
			  .footer {
			    padding-left: 0;
			    padding-right: 0;
			  }
			  /* Space out the masthead */
			  .header {
			    margin-bottom: 30px;
			  }
			  /* Remove the bottom border on the jumbotron for visual effect */
			  .title {
			    border-bottom: 0;
			  }
			}

			.well {
				background-color: #E0E0E0;
			}

			.slider-example {
				padding-top: 10px;
				padding-bottom: 55px;
				margin: 35px 0;
			}

			#destroyEx5Slider, #ex6CurrentSliderValLabel, #ex7-enabled {
				margin-left: 45px;
			}

			#ex6SliderVal {
				color: green;
			}

			#slider12a .slider-track-high, #slider12c .slider-track-high {
				background: green;
			}

			#slider12b .slider-track-low, #slider12c .slider-track-low {
				background: red;
			}

			#slider12c .slider-selection {
				background: yellow;
			}

			#slider22 .slider-selection {
				background: #2196f3;
			}

			#slider22 .slider-rangeHighlight {
				background: #f70616;
			}
        
			#slider22 .slider-rangeHighlight.category1 {
				background: #FF9900;
			}
        
			#slider22 .slider-rangeHighlight.category2 {
				background: #99CC00;
			}

    </style>

    <style type='text/css'>
			/* Example 1 custom styles */
			#ex1Slider .slider-selection {
   			background: #BABABA;
  		}

    	/* Example 3 custom styles */
			#RGB {
    		height: 20px;
    		background: rgb(128, 128, 128);
  		}
			#RC .slider-selection {
			    background: #FF8282;
			}
			#RC .slider-handle {
				background: red;
			}
			#GC .slider-selection {
				background: #428041;
			}
			#GC .slider-handle {
				background: green;
			}
			#BC .slider-selection {
				background: #8283FF;
			}
			#BC .slider-handle {
				border-bottom-color: blue;
			}
			#R, #G, #B {
				width: 300px;
			}
    </style>
	<script type='text/javascript' src="<%= js.modernizr %>"></script>
    <!-- HTML5 shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!--[if lt IE 9]>
      <script src="../../assets/js/html5shiv.js"></script>
      <script src="../../assets/js/respond.min.js"></script>
    <![endif]-->
    <!-- Highlight.js Styles -->
  </head>

  <body>

    <div class="container">

      <div class="jumbotron">
        <h1>Slider for Bootstrap <small>bootstrap-slider.js</small></h1>
        <p class="lead">Examples for the <a target="_blank" href="https://github.com/seiyria/bootstrap-slider">bootstrap-slider</a> component.<p>
      </div>

      <div class="examples">
      	<div id="example-1" class='slider-example'>
      		<h3>Example 1:</h3>
      		<p>Basic example with custom formatter and colored selected region via CSS.</p>
      		<div class="well">
				<input id="ex1" data-slider-id='ex1Slider' type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="14"/>
			</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex1" data-slider-id='ex1Slider' type="text" data-slider-min="0" data-slider-max="20" data-slider-step="1" data-slider-value="14"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$('#ex1').slider({
	formatter: function(value) {
		return 'Current value: ' + value;
	}
});

// Without JQuery
var slider = new Slider('#ex1', {
	formatter: function(value) {
		return 'Current value: ' + value;
	}
});
</code></pre>

<h5>CSS</h5>
<pre><code class="css">
#ex1Slider .slider-selection {
	background: #BABABA;
}
</code></pre>
      	</div>

      	<div id="example-2" class='slider-example'>
      		<h3>Example 2:</h3>
      		<p>Range selector, options specified via data attribute.</p>
      		<div class="well">
      			Filter by price interval: <b>€ 10</b> <input id="ex2" type="text" class="span2" value="" data-slider-min="10" data-slider-max="1000" data-slider-step="5" data-slider-value="[250,450]"/> <b>€ 1000</b>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
Filter by price interval: &ltb&gt€ 10&lt/b&gt &ltinput id="ex2" type="text" class="span2" value="" data-slider-min="10" data-slider-max="1000" data-slider-step="5" data-slider-value="[250,450]"/&gt &ltb&gt€ 1000&lt/b&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex2").slider({});

// Without JQuery
var slider = new Slider('#ex2', {});
</code></pre>
      	</div>

      	<div id="example-3" class='slider-example'>
      		<h3>Example 3:</h3>
      		<p>Using events to work with the values and style the selection and handles via CSS. The tooltip is disabled and diferent shapes for the handles.</p>
      		<div class="well">
      			<p>
	        	<b>R</b> <input type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="RC" id="R" data-slider-tooltip="hide" data-slider-handle="square" />
	            </p>
	            <p>
	            <b>G</b> <input type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="GC" id="G" data-slider-tooltip="hide" data-slider-handle="round" />
	            </p>
	            <p>
	            <b>B</b> <input type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="BC" id="B" data-slider-tooltip="hide" data-slider-handle="triangle" />
	            </p>
	            <div id="RGB"></div>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltp&gt
&ltb&gtR&lt/b&gt &ltinput type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="RC" id="R" data-slider-tooltip="hide" data-slider-handle="square" /&gt
&lt/p&gt
&ltp&gt
&ltb&gtG&lt/b&gt &ltinput type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="GC" id="G" data-slider-tooltip="hide" data-slider-handle="round" /&gt
&lt/p&gt
&ltp&gt
&ltb&gtB&lt/b&gt &ltinput type="text" class="span2" value="" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="BC" id="B" data-slider-tooltip="hide" data-slider-handle="triangle" /&gt
&lt/p&gt
&ltdiv id="RGB"&gt&lt/div&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
var RGBChange = function() {
	$('#RGB').css('background', 'rgb('+r.getValue()+','+g.getValue()+','+b.getValue()+')')
};

var r = $('#R').slider()
		.on('slide', RGBChange)
		.data('slider');
var g = $('#G').slider()
		.on('slide', RGBChange)
		.data('slider');
var b = $('#B').slider()
		.on('slide', RGBChange)
		.data('slider');
</code></pre>

<h5>CSS</h5>
<pre><code class="css">
#RGB {
	height: 20px;
	background: rgb(128, 128, 128);
}
#RC .slider-selection {
	background: #FF8282;
}
#RC .slider-handle {
	background: red;
}
#GC .slider-selection {
	background: #428041;
}
#GC .slider-handle {
	background: green;
}
#BC .slider-selection {
	background: #8283FF;
}
#BC .slider-handle {
	border-bottom-color: blue;
}
#R, #G, #B {
	width: 300px;
}
</code></pre>
      	</div>

      	<div id="example-4" class='slider-example'>
      		<h3>Example 4:</h3>
      		<p>Vertical Slider with reversed values (largest to smallest).</p>
      		<div class="well">
      			<input id="ex4" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="-3" data-slider-orientation="vertical"/>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex4" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="-3" data-slider-orientation="vertical"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex4").slider({
	reversed : true
});

// Without JQuery
var slider = new Slider("#ex4", {
	reversed : true
});
</code></pre>
      	</div>

      	<div id="example-5" class='slider-example'>
      		<h3>Example 5:</h3>
      		<p>Destroy instance of slider by calling destroy() method on slider instance via JavaScript.
      		<div class="well">
      			<input id="ex5" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="0"/>
      			<button id="destroyEx5Slider" class='btn btn-danger'>Click to Destroy</button>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex5" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="0"/&gt
&ltbutton id="destroyEx5Slider" class='btn btn-danger'>Click to Destroy&lt/button&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex5").slider();

// Without JQuery
var slider = new Slider('#ex5');

$("#destroyEx5Slider").click(function() {

	// With JQuery
	$("#ex5").slider('destroy');

	// Without JQuery
	slider.destroy();
});
</code></pre>
      	</div>

      	<div id="example-6" class='slider-example'>
      		<h3>Example 6:</h3>
      		<p>Able to bind to 'slide' JQuery event on slider, which is triggered whenever the slider is used.</p>
      		<div class="well">
      			<input id="ex6" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="3"/>
      			<span id="ex6CurrentSliderValLabel">Current Slider Value: <span id="ex6SliderVal">3</span></span>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex6" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="3"/&gt
&ltspan id="ex6CurrentSliderValLabel">Current Slider Value: &ltspan id="ex6SliderVal"&gt3&lt/span&gt&lt/span&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex6").slider();
$("#ex6").on("slide", function(slideEvt) {
	$("#ex6SliderVal").text(slideEvt.value);
});

// Without JQuery
var slider = new Slider("#ex6");
slider.on("slide", function(sliderValue) {
	document.getElementById("ex6SliderVal").textContent = sliderValue;
});
</code></pre>


            </code></pre>
      	</div>

      	<div id="example-7" class='slider-example'>
      		<h3>Example 7:</h3>
      		<p>Sliders can be enabled and disabled.</p>
      		<div class="well">
      			<input id="ex7" type="text" data-slider-min="0" data-slider-max="20" data-slider-step="1" data-slider-value="5" data-slider-enabled="false"/>
      			<input id="ex7-enabled" type="checkbox"/> Enabled
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex7" type="text" data-slider-min="0" data-slider-max="20" data-slider-step="1" data-slider-value="5" data-slider-enabled="false"/&gt
&ltinput id="ex7-enabled" type="checkbox"/&gt Enabled
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex7").slider();

// Without JQuery
var slider = new Slider("#ex7");

$("#ex7-enabled").click(function() {
	if(this.checked) {
		// With JQuery
		$("#ex7").slider("enable");

		// Without JQuery
		slider.enable();
	}
	else {
		// With JQuery
		$("#ex7").slider("disable");

		// Without JQuery
		slider.disable();
	}
});
</code></pre>
      	</div>

      <div id="example-8" class='slider-example'>
      		<h3>Example 8:</h3>
      		<p>Tooltip can always be displayed.</p>
      		<div class="well">
  				<input id="ex8" data-slider-id='ex1Slider' type="text" data-slider-min="0" data-slider-max="20" data-slider-step="1" data-slider-value="14"/>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex8" data-slider-id='ex1Slider' type="text" data-slider-min="0" data-slider-max="20" data-slider-step="1" data-slider-value="14"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex8").slider({
	tooltip: 'always'
});

// Without JQuery
var slider = new Slider("#ex8", {
	tooltip: 'always'
});
</code></pre>
      	</div>

      <div id="example-9" class='slider-example'>
      		<h3>Example 9:</h3>
      		<p>Precision (number of places after the decimal) can be specified.</p>
      		<div class="well">
  				<input id="ex9" type="text"/>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex9" type="text"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex9").slider({
	precision: 2,
	value: 8.115 // Slider will instantiate showing 8.12 due to specified precision
});

// Without JQuery
var slider = new Slider("#ex9", {
	precision: 2,
	value: 8.115 // Slider will instantiate showing 8.12 due to specified precision
});
</code></pre>
      	</div>
<div id="example-10" class='slider-example'>
    <h3>Example 10:</h3>
    <p>Setting custom handlers.</p>
    <div class="well">
    <input id="ex10" type="text" data-slider-handle="custom"/>
    </div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex10" type="text" data-slider-handle="custom"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex10").slider({});

// Without JQuery
var slider = new Slider("#ex10", {});
</code></pre>

<h5>CSS</h5>
<pre><code class="css">
.slider-handle.custom {
	background: transparent none;
	/* You can customize the handle and set a background image */
}

/* Or display content like unicode characters or fontawesome icons */
.slider-handle.custom::before {
	line-height: 20px;
	font-size: 20px;
	content: '\2605'; /*unicode star character*/
	color: #726204;
}
</code></pre>
  </div>

  <div id="example-11" class='slider-example'>
      <h3>Example 11:</h3>
      <p>Using a custom step interval.</p>
      <div class="well">
      <input id="ex11" type="text" data-slider-handle="custom"/>
      </div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex11" type="text" data-slider-handle="custom"/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex11").slider({step: 20000, min: 0, max: 200000});

// Without JQuery
var slider = new Slider("#ex11", {
	step: 20000,
	min: 0,
	max: 200000
});
</code></pre>
  </div>

  <div id="example-12" class='slider-example'>
    <h3>Example 12:</h3>
    <p>Coloring the low and high track segments.</p>
	<div class="well">
      Single-value slider, high track:<br/>
      <input id="ex12a" type="text"/><br/>
      Note that there is no low track on the single-value slider.  The
      area lesser than the value of the handle is the selection.
      <br/><br/>
      Range slider, low track:<br/>
      <input id="ex12b" type="text"/>
      <br/><br/>
      Range slider, low and high tracks, and selection:<br/>
      <input id="ex12c" type="text"/>
    </div>
<h5>HTML</h5>
<pre><code class="html">
&lt;!-- Single-value slider, high track: --&gt;
&ltinput id="ex12a" type="text"/&gt&ltbr/&gt
Note that there is no low track on the single-value slider. The area to lesser than the value of the handle is the selection.

&lt;!-- Range slider, low track: --&gt;
&ltinput id="ex12b" type="text"/&gt&ltbr/&gt

&lt;!-- Range slider, low and high tracks, and selection: --&gt;
&ltinput id="ex12c" type="text"/&gt&ltbr/&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex12a").slider({ id: "slider12a", min: 0, max: 10, value: 5 });
$("#ex12b").slider({ id: "slider12b", min: 0, max: 10, range: true, value: [3, 7] });
$("#ex12c").slider({ id: "slider12c", min: 0, max: 10, range: true, value: [3, 7] });

// Without JQuery
var sliderA = new Slider("#ex12a", { id: "slider12a", min: 0, max: 10, value: 5 });
var sliderB = new Slider("#ex12b", { id: "slider12b", min: 0, max: 10, range: true, value: [3, 7] });
var sliderC = new Slider("#ex12c", { id: "slider12c", min: 0, max: 10, range: true, value: [3, 7] });
</code></pre>

<h5>CSS</h5>
<pre><code class="css">
#slider12a .slider-track-high, #slider12c .slider-track-high {
	background: green;
}

#slider12b .slider-track-low, #slider12c .slider-track-low {
	background: red;
}

#slider12c .slider-selection {
	background: yellow;
}
</code></pre>
  </div>

  <div id="example-13" class='slider-example'>
      <h3>Example 13:</h3>
      <p>Using tick marks and labels.</p>
      <div class="well">
      <input id="ex13" type="text"/>
      </div>
<h5>HTML</h5>
<pre><code class="html">
&lt;input id="ex13" type="text" data-slider-ticks="[0, 100, 200, 300, 400]" data-slider-ticks-snap-bounds="30" data-slider-ticks-labels='["$0", "$100", "$200", "$300", "$400"]'/&gt;
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex13").slider({
    ticks: [0, 100, 200, 300, 400],
    ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
    ticks_snap_bounds: 30
});

// Without JQuery
var slider = new Slider("#ex13", {
    ticks: [0, 100, 200, 300, 400],
    ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
    ticks_snap_bounds: 30
});

</code></pre>
  </div>

	<div id="example-14" class='slider-example'>
      <h3>Example 14:</h3>
      <p>Using tick marks at specific positions..</p>
      <div class="well">
      <input id="ex14" type="text"/>
      </div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex14" type="text" data-slider-ticks="[0, 100, 200, 300, 400]" data-slider-ticks-snap-bounds="30" data-slider-ticks-labels='["$0", "$100", "$200", "$300", "$400"]' ticks_positions="[0, 30, 60, 70, 90, 100]" /&gt
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex14").slider({
    ticks: [0, 100, 200, 300, 400],
    ticks_positions: [0, 30, 60, 70, 90, 100],
    ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
    ticks_snap_bounds: 30
});

// Without JQuery
var slider = new Slider("#ex14", {
    ticks: [0, 100, 200, 300, 400],
    ticks_positions: [0, 30, 60, 70, 90, 100],
    ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
    ticks_snap_bounds: 30
});
</code></pre>
	</div>

      	<div id="example-15" class='slider-example'>
      		<h3>Example 15:</h3>
      		<p>With a logarithmic scale.</p>
      		<div class="well">
						<input id="ex15" type="text" data-slider-min="1000" data-slider-max="10000000" data-slider-step="5" />
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&lt;input id="ex15" type="text" data-slider-min="1000" data-slider-max="10000000" data-slider-step="5" /&gt;
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex15").slider({
	min: 1000,
	max: 10000000,
	scale: 'logarithmic',
	step: 10
});

// Without JQuery
var slider = new Slider('#ex15', {
	min: 1000,
	max: 10000000,
	scale: 'logarithmic',
	step: 10
});
</code></pre>

      </div>

      <div id="example-16" class="slider-example">
        <h3>Example 16:</h3>
        <p>Focus the slider handle after a value change.</p>
        <div class="well">
          Single-value slider:<br/>
          <input id="ex16a" type="text"/><br/>
          <br/><br/>
          Range slider:<br/>
          <input id="ex16b" type="text"/>
        </div>
<h5>HTML</h5>
<pre><code class="html">
&lt;!-- Single-value slider: --&gt;
&ltinput id="ex16a" type="text"/&gt&ltbr/&gt

&lt;!-- Range slider: --&gt;
&ltinput id="ex16b" type="text"/&gt&ltbr/&gt
Note that the slider handle that caused the value change is focused.
</code></pre>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex16a").slider({ min: 0, max: 10, value: 0, focus: true });
$("#ex16b").slider({ min: 0, max: 10, value: [0, 10], focus: true });

// Without JQuery
var sliderA = new Slider("#ex16a", { min: 0, max: 10, value: 0, focus: true });
var sliderB = new Slider("#ex16b", { min: 0, max: 10, value: [0, 10], focus: true });
</code></pre>
      </div>

      <div id="example-17" class="slider-example">
      		<h3>Example 17:</h3>
      		<p>Unusual tooltip positions</p>

      		<div class="well">
      			Horizontal slider with tooltip on the bottom<br/><br/>
      			<input id="ex17a" type="text"/><br/><br/><br/>

      			Vertical slider with tooltip on the left<br/><br/>
      			<input id="ex17b" type="text"/>
      		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex17a" type="text"/&gt
&ltinput id="ex17b" type="text"/&gt
</code></pre>

<h5>JS</h5>
<pre><code class="js">
// With JQuery
$("#ex17a").slider({
	min: 0,
	max: 10,
	value: 0,
	tooltip_position:'bottom'
});
$("#ex17b").slider({
	min: 0,
	max: 10,
	value: 0,
	orientation: 'vertical',
	tooltip_position:'left'
});

// Without JQuery
var sliderA = new Slider("#ex17a", {
	min: 0,
	max: 10,
	value: 0,
	tooltip_position:'bottom'
});

var sliderB = new Slider("#ex17b", {
	min: 0,
	max: 10,
	value: 0,
	orientation: 'vertical',
	tooltip_position:'left'
});
</code></pre>

      </div>

      <div id="example-18" class="slider-example">
        <h3>Example 18:</h3>
        <p>Accessibility with ARIA labels</p>

        <div class="well">
          Slider with single value and label:<br/><br/>
          <span id="ex18-label-1" class="hidden">
            Example slider label
          </span>
          <input id="ex18a" type="text" /><br/><br/><br/>

          Range slider with multiple labels:<br/><br/>
          <span id="ex18-label-2a" class="hidden">
            Example low value
          </span>
          <span id="ex18-label-2b" class="hidden">
            Example high value
          </span>
          <input id="ex18b" type="text" />
        </div>
<h5>HTML</h5>
<pre><code class="html">
&lt;span id="ex18-label-1" class="hidden"&gt;Example slider label&lt;/span&gt;
&lt;input id="ex18a" type="text"/&gt;

&lt;span id="ex18-label-2a" class="hidden"&gt;Example low value&lt;/span&gt;
&lt;span id="ex18-label-2b" class="hidden"&gt;Example high value&lt;/span&gt;
&lt;input id="ex18b" type="text"/&gt;
</pre></code>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex18a").slider({
	min: 0,
	max: 10,
	value: 5,
	labelledby: 'ex18-label-1'
});
$("#ex18b").slider({
	min: 0,
	max: 10,
	value: [3, 6],
	labelledby: ['ex18-label-2a', 'ex18-label-2b']
});

// Without JQuery
var sliderA = new Slider("#ex18a", {
	min: 0,
	max: 10,
	value: 5,
	labelledby: 'ex18-label-1'
});
var sliderB = new Slider("#ex18b", {
	min: 0,
	max: 10,
	value: [3, 6],
	labelledby: ['ex18-label-2a', 'ex18-label-2b']
});
</pre></code>
      </div>

      <div  id="example-19" class="slider-example">
        <h3>Example 19:</h3>
        <p>Auto-Register data-provide="slider" Elements</p>

        <div class="well">
          Slider-Element not accompanied by any custom Javascript:<br/><br/>
          <span id="ex18-label-1" class="hidden">
            Example slider label
          </span>
          <input id="ex19" type="text"
                data-provide="slider"
                data-slider-ticks="[1, 2, 3]"
                data-slider-ticks-labels='["short", "medium", "long"]'
                data-slider-min="1"
                data-slider-max="3"
                data-slider-step="1"
                data-slider-value="3"
                data-slider-tooltip="hide" />
        </div>
<h5>HTML</h5>
<pre><code class="html">
 &lt;span id="ex18-label-1" class="hidden">Example slider label&lt;/span&gt;
        &lt;input id="ex19" type="text"
              data-provide="slider"
              data-slider-ticks="[1, 2, 3]"
              data-slider-ticks-labels='["short", "medium", "long"]'
              data-slider-min="1"
              data-slider-max="3"
              data-slider-step="1"
              data-slider-value="3"
              data-slider-tooltip="hide" /&gt;
</pre></code>
      </div>

      <div  id="example-20" class="slider-example">
        <h3>Example 20:</h3>
        <p>Slider-Elements initially hidden</p>

        <a class="btn btn-primary" href="" id="ex20a">Show</a>
        <br><br>
        <div class="well" style="display: none">
          Slider-Element initially hidden, revealed by Javascript:<br/><br/>
          <span id="ex18-label-1" class="hidden">
            Example slider label
          </span>
          <input id="ex20" type="text"
                data-provide="slider"
                data-slider-ticks="[1, 2, 3]"
                data-slider-ticks-labels='["short", "medium", "long"]'
                data-slider-min="1"
                data-slider-max="3"
                data-slider-step="1"
                data-slider-value="3"
                data-slider-tooltip="hide" />
        </div>
<h5>HTML</h5>
<pre><code class="html">
 &lt;a class="btn btn-primary" href="" id="ex20a">Show&lt;/a&gt;
        &lt;div class="well" style="display: none"&gt;
            &lt;span id="ex18-label-1" class="hidden"&gt;Example slider label&lt;/span&gt;
            &lt;input id="ex19" type="text"
                  data-provide="slider"
                  data-slider-ticks="[1, 2, 3]"
                  data-slider-ticks-labels='["short", "medium", "long"]'
                  data-slider-min="1"
                  data-slider-max="3"
                  data-slider-step="1"
                  data-slider-value="3"
                  data-slider-tooltip="hide" /&gt;
        &lt;/div&gt;
</pre></code>

<h5>JavaScript</h5>
<pre><code class="js">
 $('#ex20a').on('click', function(e) {
      $('#ex20a')
          .parent()
          .find(' >.well')
          .toggle()
          .find('input')
          .slider('relayout');
      e.preventDefault();
  });
</pre></code>
      </div>

      <div id="example-21" class="slider-example">
        <h3>Example 21:</h3>
        <p>Create an input element with the <strong>data-provide="slider"</strong> attribute automatically turns it into a slider. Options can be supplied via <strong>data-slider-</strong> attributes.</p>

        <div class="well">
	      	<input id="ex21" type="text"
	           data-provide="slider"
	           data-slider-ticks="[1, 2, 3]"
	           data-slider-ticks-labels='["short", "medium", "long"]'
	           data-slider-min="1"
	           data-slider-max="3"
	           data-slider-step="1"
	           data-slider-value="3"
	           data-slider-tooltip="hide" />
        </div>
<h5>HTML</h5>
<pre><code class="html">
 &lt;input id="ex21" type="text"
          data-provide="slider"
          data-slider-ticks="[1, 2, 3]"
          data-slider-ticks-labels='["short", "medium", "long"]'
          data-slider-min="1"
          data-slider-max="3"
          data-slider-step="1"
          data-slider-value="3"
          data-slider-tooltip="hide" /&gt;
</pre></code>
      </div>

    <div id="example-22" class="slider-example">
		  <h3>Example 22:</h3>
		  <p>Highlight ranges on slider with <strong>rangeHighlights</strong> attribute</p>

		  <div class="well">
			  <input id="ex22" type="text"
					 data-slider-id="slider22"
					 data-slider-min="0"
					 data-slider-max="20"
					 data-slider-step="1"
					 data-slider-value="14"
					 data-slider-rangeHighlights='[{ "start": 2, "end": 5, "class": "category1" },
					                               { "start": 7, "end": 8, "class": "category2" },
					                               { "start": 17, "end": 19 },
					                               { "start": 17, "end": 24 },
					                               { "start": -3, "end": 19 }]'/>
		  </div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex22" type="text"
     data-slider-id="slider22"
     data-slider-min="0"
     data-slider-max="20"
     data-slider-step="1"
     data-slider-value="14"
     data-slider-rangeHighlights='[{ "start": 2, "end": 5, "class": "category1" },
                                   { "start": 7, "end": 8, "class": "category2" },
                                   { "start": 17, "end": 19 },
                                   { "start": 17, "end": 24 }, //not visible -  out of slider range
                                   { "start": -3, "end": 19 }]' /&gt;
</pre></code>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$('#ex22').slider({
    id: 'slider22',
    min: 0,
    max: 20,
    step: 1,
    value: 14,
    rangeHighlights: [{ "start": 2, "end": 5, "class": "category1" },
                      { "start": 7, "end": 8, "class": "category2" },
                      { "start": 17, "end": 19 },
                      { "start": 17, "end": 24 },
                      { "start": -3, "end": 19 }]});

// Without JQuery
var slider = new Slider("#ex22", {
    id: 'slider22',
    min: 0,
    max: 20,
    step: 1,
    value: 14,
    rangeHighlights: [{ "start": 2, "end": 5, "class": "category1" },
                      { "start": 7, "end": 8, "class": "category2" },
                      { "start": 17, "end": 19 },
                      { "start": 17, "end": 24 },
                      { "start": -3, "end": 19 }]});
</pre></code>

<h5>CSS</h5>
<pre><code class="css">
#slider22 .slider-selection {
	background: #81bfde;
}

#slider22 .slider-rangeHighlight {
	background: #f70616;
}

#slider22 .slider-rangeHighlight.category1 {
    background: #FF9900;
}

#slider22 .slider-rangeHighlight.category2 {
    background: #99CC00;
}

</pre></code>
	  </div>

	  	<div id="example-23" class='slider-example'>
		<h3>Example 23:</h3>
		<p>Using tick marks at specific positions..</p>
		<div class="well">
		<input id="ex23" type="text"/>
		</div>
<h5>HTML</h5>
<pre><code class="html">
&ltinput id="ex23" type="text" data-slider-ticks="[0, 1, 2, 3, 4]" data-slider-step="0.01" data-slider-ticks-snap-bounds="200" data-slider-ticks-tooltip="true" ticks_positions="[0, 30, 60, 70, 90, 100]" /&gt
</pre></code>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex23").slider({
    ticks: [0, 1, 2, 3, 4],
    ticks_positions: [0, 30, 60, 70, 90, 100],
    ticks_snap_bounds: 200,
	formatter: function(value) {
		return 'Current value: ' + value;
	},
	ticks_tooltip: true,
	step: 0.01
});

// Without JQuery
var slider = new Slider("#ex23", {
    ticks: [0, 1, 2, 3, 4],
	ticks_positions: [0, 30, 70, 90, 100],
    ticks_snap_bounds: 200,
	formatter: function(value) {
		return 'Current value: ' + value;
	},
	ticks_tooltip: true,
	step: 0.01
});
</pre></code>
	</div>

			<div id="example-24" class='slider-example'>
				<h3>Example 24:</h3>
				<p>rtl mode (auto)</p>
				<div class='well' dir ="rtl">
					<span>-5</span>
						<input id="ex24" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="14"/>
					<span>20</span>
				</div>
<h5>HTML</h5>
<pre><code class="html">
&lt;div class='well' dir ="rtl"&gt;
  &lt;span&gt;-5&lt;/span&gt;
    &lt;input id="ex24" type="text" data-slider-min="-5" data-slider-max="20" data-slider-step="1" data-slider-value="14"/&gt;
  &lt;span&gt;20&lt;/span&gt;
&lt;/div&gt;
</pre></code>

<h5>JavaScript</h5>
<pre><code class="js">
// With JQuery
$("#ex24").slider({});
</pre></code>
			</div>

	  </div> <!-- /examples -->
    </div> <!-- /container -->


    <!-- core JavaScript
    ================================================== -->
    <script type='text/javascript' src="<%= js.jquery %>"></script>
    <script type='text/javascript' src="<%= js.slider %>"></script>
    <script type='text/javascript' src="<%= js.highlightjs %>"></script>
    <script>hljs.initHighlightingOnLoad();</script>
    <script type='text/javascript'>
    	$(document).ready(function() {
    		/* Example 1 */
	    	$('#ex1').slider({
	          	formatter: function(value) {
	            	return 'Current value: ' + value;
	          	}
	        });

	    	/* Example 2 */
	        $("#ex2").slider({});

	        /* Example 3 */
	        var RGBChange = function() {
	          $('#RGB').css('background', 'rgb('+r.getValue()+','+g.getValue()+','+b.getValue()+')')
	        };

	        var r = $('#R').slider()
	                	.on('slide', RGBChange)
	                	.data('slider');
	        var g = $('#G').slider()
	                	.on('slide', RGBChange)
	                	.data('slider');
	        var b = $('#B').slider()
	                	.on('slide', RGBChange)
	                	.data('slider');

	        /* Example 4 */
	        $("#ex4").slider({
	        	reversed : true
	        });

	        /* Example 5 */
	        $("#ex5").slider();
			$("#destroyEx5Slider").click(function() {
				$("#ex5").slider('destroy');
			});

			/* Example 6 */
			$("#ex6").slider();
			$("#ex6").on('slide', function(slideEvt) {
				$("#ex6SliderVal").text(slideEvt.value);
			});

			/* Example 7 */
			$("#ex7").slider();
			$("#ex7-enabled").click(function() {
				if(this.checked) {
					$("#ex7").slider("enable");
				}
				else {
					$("#ex7").slider("disable");
				}
			});

			/* Example 8 */
			$("#ex8").slider({
				tooltip: 'always'
			});

			/* Example 9 */
			$("#ex9").slider({
				precision: 2,
				value: 8.115
			});

	      	/* Example 10 */
	      	$("#ex10").slider({});

	      	/* Example 11 */
	      	$("#ex11").slider({
		        step: 20000,
		        min: 0,
		        max: 200000
	      	});

			/* Example 12 */
			$("#ex12a").slider({
				id: "slider12a",
				min: 0,
				max: 10,
				value: 5
            });
			$("#ex12b").slider({
				id: "slider12b",
				min: 0,
				max: 10,
				range: true,
				value: [ 3, 7 ]
			});
			$("#ex12c").slider({
				id: "slider12c",
				min: 0,
				max: 10,
				range: true,
				value: [ 3, 7 ]
			});

			/* Example 13 */
			$("#ex13").slider({
				ticks: [0, 100, 200, 300, 400],
				ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
				ticks_snap_bounds: 30,
				value: 200
			});

			/* Example 14 */
			$("#ex14").slider({
				ticks: [0, 100, 200, 300, 400],
				ticks_labels: ['$0', '$100', '$200', '$300', '$400'],
				ticks_positions: [0, 30, 70, 90, 100],
				ticks_snap_bounds: 20,
				value: 200,
				reversed: true
			});

			/* Example 15 */
			$("#ex15").slider({
				min: 10,
				max: 1000,
				scale: 'logarithmic',
				step: 10
			});

			/* Example 16 */
			$("#ex16a").slider({
				min  : 0,
				max  : 10,
				value: 0,
				focus: true
			});
			$("#ex16b").slider({
				min  : 0,
				max  : 10,
				value: [ 0, 10 ],
				focus: true
			});

			/* Example 17 */
			$("#ex17a").slider({
				min  : 0,
				max  : 10,
				value: 0,
				tooltip_position:'bottom'
			});
			$("#ex17b").slider({
				min  : 0,
				max  : 10,
				value: 0,
				orientation: 'vertical',
				tooltip_position:'left'
			});

			/* Example 18 */
			$('#ex18a').slider({
				min  : 0,
				max  : 10,
				value: 5,
				labelledby: 'ex18-label-1'
			});

			$('#ex18b').slider({
				min  : 0,
				max  : 10,
				value: [3, 6],
				labelledby: ['ex18-label-2a', 'ex18-label-2b']
			});

			$('#ex20a').on('click', function(e) {
				$('#ex20a')
					.parent()
					.find(' >.well')
					.toggle()
					.find('input')
					.slider('relayout');
				e.preventDefault();
			});

			/* Example 22 */
            $('#ex22').slider({});

			/* Example 23 */
            $('#ex23').slider({
				ticks: [0, 1, 2, 3, 4],
				ticks_positions: [0, 30, 70, 90, 100],
				formatter: function(value) {
					return 'Current value: ' + value;
				},
				step: 0.01,
				ticks_tooltip: true
			});
		});
			/* example 24 */
			$('#ex24').slider({});
    </script>
    <!-- Placed at the end of the document so the pages load faster -->
  </body>
</html>
