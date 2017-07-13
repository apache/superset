var AdminFilters = function(element, labels, form, filters, active_filters) {
    // Admin filters will deal with the adding and removing of search filters
    // :param labels:
    //      {'col','label'}
    // :param active_filters:
    //      [['col','filter name','value'],[...],...]
    
    var $root = $(element);
    var $container = $('.filters', $root);
    var lastCount = 0;

    function removeFilter() {
        $(this).closest('tr').remove();
        $('button', $root).show();

        return false;
    }

    function addActiveFilters()
    {
        $(active_filters).each(function() {
            addActiveFilter(this[0], this[1], this[2]);
        });
    }

    function addActiveFilter(name, filter_name, value)
    {
        var $el = $('<tr />').appendTo($container);

	    addRemoveFilter($el, name, labels[name]);
        var i_option = addFilterOptionsValue($el, name, filter_name);
	
        var $field = $(form[name])
        // if form item complex like <div><input bla></div>, datetime
        if ( $("input", $($field)).html() != undefined ) {
            $field_inner = $("input", $field)
            $field_inner.attr('name', '_flt_' + i_option + '_' + name);
            $field_inner.val(value);
            $field_inner.attr('class', ' filter_val ' + $field_inner.attr('class'));
	    }
        else {
            if (($field.attr( 'type')) == 'checkbox') {
                $field.attr( 'checked', true );
            }
            $field.attr('name', '_flt_' + i_option + '_' + name);
            $field.val(value);
            $field.attr('class', ' filter_val ' + $field.attr('class'));
        }
        $el.append(
            $('<td/>').append($field)
            );;
    }

	function addRemoveFilter($el, name, label)
	{
		$el.append(
                $('<td class="col-lg-1 col-md-1" />').append(
                    $('<a href="#" class="btn remove-filter" />')
                        .append($('<span class="close-icon">&times;</span>'))
                        .append('&nbsp;')
                        .append(label)
                        .click(removeFilter)
                    )
            );
	}

    function addFilterOptionsValue($el, name, value)
	{
		var $select = $('<select class="filter-op my_select2" />')                     

		cx = 0;
        var i_option = -1;
        $(filters[name]).each(function() {
            if (value == this) {
                $select.append($('<option selected="selected"/>').attr('value', cx).text(this));
                i_option = cx;
            }
            else {
                $select.append($('<option/>').attr('value', cx).text(this));
            }
	    cx += 1;
        });

        $el.append(
               $('<td class="col-lg-1 col-md-1 col-sm-1" />').append($select)
        );
        // avoids error
        if (i_option == -1) { $select.select2(); }
        $select.change(function(e) {
        	changeOperation(e, $el, name)
    	});
        
        return i_option;
	}
    

    function addFilter(name, filter) {
        var $el = $('<tr />').appendTo($container);
		
	    addRemoveFilter($el, name, labels[name]);

        addFilterOptionsValue($el, name);
	    var $field = $(form[name])
	
	    // if form item complex like <div><input bla></div>, datetime
	    if ( $("input", $($field)).html() != undefined ) {
		    $field_inner = $("input", $($field))
		    $field_inner.attr('name', '_flt_0_' + name);
		    $field_inner.attr('class', ' filter_val ' + $field_inner.attr('class'));
	
	    }
	    else {
		    $field.attr('name', '_flt_0_' + name);
		    $field.attr('class', ' filter_val ' + $field.attr('class'));
	    }
	    $el.append(
        	$('<td/>').append($field)
        );;
        if ($field.hasClass( "my_select2" )) {
        	$field.select2({placeholder: "Select a State", allowClear: true});
        }
        if ($field.hasClass( "appbuilder_datetime" )) {
        	$field.datetimepicker();
        }
        if ($field.hasClass( "appbuilder_date" )) {
        	$field.datetimepicker({pickTime: false });
        }
        lastCount += 1;
    };

	// ----------------------------------------------------------
	// Trigger for option change will change input element name
	// ----------------------------------------------------------
    function changeOperation(e, $el, name) {
        $in = $el.find('.filter_val');
        $in.attr('name','_flt_' + e.val + '_' + name);
    }


    $('a.filter').click(function() {
        var name = $(this).attr('name')
        addFilter(name);
    });
    
    addActiveFilters();

};
