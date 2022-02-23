(function ($) {
  /**
   * Patch TOC list.
   *
   * Will mutate the underlying span to have a correct ul for nav.
   *
   * @param $span: Span containing nested UL"s to mutate.
   * @param minLevel: Starting level for nested lists. (1: global, 2: local).
   */
  var patchToc = function ($ul, minLevel) {
    var findA,
      patchTables,
      $localLi;

    // Find all a "internal" tags, traversing recursively.
    findA = function ($elem, level) {
      level = level || 0;
      var $items = $elem.find("> li > a.internal, > ul, > li > ul");

      // Iterate everything in order.
      $items.each(function (index, item) {
        var $item = $(item),
          tag = item.tagName.toLowerCase(),
          $childrenLi = $item.children("li"),
          $parentLi = $($item.parent("li"), $item.parent().parent("li"));

        // Add dropdowns if more children and above minimum level.
        if (tag === "ul" && level >= minLevel && $childrenLi.length > 0) {
          $parentLi
            .addClass("dropdown-submenu")
            .children("a").first().attr("tabindex", -1);

          $item.addClass("dropdown-menu");
        }

        findA($item, level + 1);
      });
    };

    findA($ul);
  };

  /**
   * Patch all tables to remove ``docutils`` class and add Bootstrap base
   * ``table`` class.
   */
  patchTables = function () {
    $("table.docutils")
      .removeClass("docutils")
      .addClass("table")
      .attr("border", 0);
  };

  $(window).load(function () {
    /*
     * Scroll the window to avoid the topnav bar
     * https://github.com/twbs/bootstrap/issues/1768
     */
    if ($("#navbar.navbar-fixed-top").length > 0) {
      var navHeight = $("#navbar").height(),
        shiftWindow = function() { scrollBy(0, -navHeight - 10); };

      if (location.hash) {
        setTimeout(shiftWindow, 1);
      }

      window.addEventListener("hashchange", shiftWindow);
    }
  });

  $(document).ready(function () {
    // Add styling, structure to TOC"s.
    $(".dropdown-menu").each(function () {
      $(this).find("ul").each(function (index, item){
        var $item = $(item);
        $item.addClass("unstyled");
      });
    });

    // Global TOC.
    if ($("ul.globaltoc li").length) {
      patchToc($("ul.globaltoc"), 1);
    } else {
      // Remove Global TOC.
      $(".globaltoc-container").remove();
    }

    // Local TOC.
    $(".bs-sidenav ul").addClass("nav nav-list");
    $(".bs-sidenav > ul > li > a").addClass("nav-header");

    

    // Local TOC.
    patchToc($("ul.localtoc"), 2);

    // Mutate sub-lists (for bs-2.3.0).
    $(".dropdown-menu ul").not(".dropdown-menu").each(function () {
      var $ul = $(this),
        $parent = $ul.parent(),
        tag = $parent[0].tagName.toLowerCase(),
        $kids = $ul.children().detach();

      // Replace list with items if submenu header.
      if (tag === "ul") {
        $ul.replaceWith($kids);
      } else if (tag === "li") {
        // Insert into previous list.
        $parent.after($kids);
        $ul.remove();
      }
    });

    // Add divider in page TOC.
    $localLi = $("ul.localtoc li");
    if ($localLi.length > 2) {
      $localLi.first().after("<li class=\"divider\"></li>");
    }

    // Patch tables.
    patchTables();

    // Add Note, Warning styles. (BS v2,3 compatible).
    $(".admonition").addClass("alert alert-info")
      .filter(".warning, .caution")
        .removeClass("alert-info")
        .addClass("alert-warning").end()
      .filter(".error, .danger")
        .removeClass("alert-info")
        .addClass("alert-danger alert-error").end();

    // Inline code styles to Bootstrap style.
    $("tt.docutils.literal").not(".xref").each(function (i, e) {
      // ignore references
      if (!$(e).parent().hasClass("reference")) {
        $(e).replaceWith(function () {
          return $("<code />").html($(this).html());
        });
      }});

    // Update sourcelink to remove outerdiv (fixes appearance in navbar).
    var $srcLink = $(".nav #sourcelink");
    $srcLink.parent().html($srcLink.html());
  });
}(window.$jqTheme || window.jQuery));