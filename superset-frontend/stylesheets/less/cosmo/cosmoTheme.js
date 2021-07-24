/**
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
(function () {
  $(window).scroll(function () {
    var top = $(document).scrollTop();
    $('.splash').css({
      'background-position': '0px -' + (top / 3).toFixed(2) + 'px',
    });
    if (top > 50) $('#home > .navbar').removeClass('navbar-transparent');
    else $('#home > .navbar').addClass('navbar-transparent');
  });

  $("a[href='#']").click(function (e) {
    e.preventDefault();
  });

  var $button = $(
    "<div id='source-button' class='btn btn-primary btn-xs'>&lt; &gt;</div>",
  ).click(function () {
    var html = $(this).parent().html();
    html = cleanSource(html);
    $('#source-modal pre').text(html);
    $('#source-modal').modal();
  });

  $('.bs-component [data-toggle="popover"]').popover();
  $('.bs-component [data-toggle="tooltip"]').tooltip();

  $('.bs-component').hover(
    function () {
      $(this).append($button);
      $button.show();
    },
    function () {
      $button.hide();
    },
  );

  function cleanSource(html) {
    html = html
      .replace(/×/g, '&times;')
      .replace(/«/g, '&laquo;')
      .replace(/»/g, '&raquo;')
      .replace(/←/g, '&larr;')
      .replace(/→/g, '&rarr;');

    var lines = html.split(/\n/);

    lines.shift();
    lines.splice(-1, 1);

    var indentSize = lines[0].length - lines[0].trim().length,
      re = new RegExp(' {' + indentSize + '}');

    lines = lines.map(function (line) {
      if (line.match(re)) {
        line = line.substring(indentSize);
      }

      return line;
    });

    lines = lines.join('\n');

    return lines;
  }
})();
