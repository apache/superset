

//---------------------------------------
// Function for keeping tab focus
// after page reload, uses cookies
//---------------------------------------
$(function() 
{ 
    $('a[data-toggle="tab"]').on('shown.bs.tab', function () {
        //save the latest tab; use cookies if you like 'em better:
        localStorage.setItem('lastTab', $(this).attr('href'));
    });

    //go to the latest tab, if it exists:
    var lastTab = localStorage.getItem('lastTab');
    if (lastTab) {
        $('a[href=' + lastTab + ']').tab('show');
    }
    else
    {
    // Set the first tab if cookie do not exist
        $('a[data-toggle="tab"]:first').tab('show');
    }

//---------------------------------------
// Function for keeping accordion focus
// after page reload, uses cookies
//---------------------------------------

    $('.panel-collapse').on('shown.bs.collapse', function () {
        //save the latest accordion; use cookies if you like 'em better:
        localStorage.setItem('lastAccordion', $(this).attr('id'));
    });


    $('.panel-collapse').on('hidden.bs.collapse', function () {
        //remove the latest accordion; use cookies if you like 'em better:
        localStorage.removeItem('lastAccordion');
    });


    //go to the latest accordion, if it exists:
    var lastAccordion = localStorage.getItem('lastAccordion');
    if (lastAccordion) {
        if (!($('#' + lastAccordion).hasClass('collapse in')))
        {
            $('#' + lastAccordion).collapse('show');
        }
    }

});


