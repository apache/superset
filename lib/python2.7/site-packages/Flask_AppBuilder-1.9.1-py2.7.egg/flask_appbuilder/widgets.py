'''
Created on Oct 12, 2013

@author: Daniel Gaspar
'''

import logging
from flask.globals import _request_ctx_stack
from ._compat import as_unicode


log = logging.getLogger(__name__)


class RenderTemplateWidget(object):
    """
        Base template for every widget
        Enables the possibility of rendering a template
         inside a template with run time options
    """
    template = 'appbuilder/general/widgets/render.html'
    template_args = None

    def __init__(self, **kwargs):
        self.template_args = kwargs

    def __call__(self, **kwargs):
        ctx = _request_ctx_stack.top
        jinja_env = ctx.app.jinja_env

        template = jinja_env.get_template(self.template)
        args = self.template_args.copy()
        args.update(kwargs)
        return template.render(args)


class FormWidget(RenderTemplateWidget):
    """
        FormWidget

        form = None
        include_cols = []
        exclude_cols = []
        fieldsets = []
    """
    template = 'appbuilder/general/widgets/form.html'


class FormVerticalWidget(RenderTemplateWidget):
    """
        FormWidget

        form = None
        include_cols = []
        exclude_cols = []
        fieldsets = []
    """
    template = 'appbuilder/general/widgets/form_vertical.html'


class FormHorizontalWidget(RenderTemplateWidget):
    """
        FormWidget

        form = None
        include_cols = []
        exclude_cols = []
        fieldsets = []
    """
    template = 'appbuilder/general/widgets/form_horizontal.html'


class FormInlineWidget(RenderTemplateWidget):
    """
        FormWidget

        form = None
        include_cols = []
        exclude_cols = []
        fieldsets = []
    """
    template = 'appbuilder/general/widgets/form_inline.html'


class GroupFormListWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/group_form_list.html'


class SearchWidget(FormWidget):
    template = 'appbuilder/general/widgets/search.html'
    filters = None

    def __init__(self, **kwargs):
        self.filters = kwargs.get('filters')
        return super(SearchWidget, self).__init__(**kwargs)

    def __call__(self, **kwargs):
        """ create dict labels based on form """
        """ create dict of form widgets """
        """ create dict of possible filters """
        """ create list of active filters """
        label_columns = {}
        form_fields = {}
        search_filters = {}
        dict_filters = self.filters.get_search_filters()
        for col in self.template_args['include_cols']:
            label_columns[col] = as_unicode(self.template_args['form'][col].label.text)
            form_fields[col] = self.template_args['form'][col]()
            search_filters[col] = [as_unicode(flt.name) for flt in dict_filters[col]]

        kwargs['label_columns'] = label_columns
        kwargs['form_fields'] = form_fields
        kwargs['search_filters'] = search_filters
        kwargs['active_filters'] = self.filters.get_filters_values_tojson()
        return super(SearchWidget, self).__call__(**kwargs)


class ShowWidget(RenderTemplateWidget):
    """
        ShowWidget implements a template as an widget
        it takes the following arguments

        pk = None
        label_columns = []
        include_columns = []
        value_columns = []
        actions = None
        fieldsets = []
        modelview_name = ''
    """
    template = 'appbuilder/general/widgets/show.html'


class ShowBlockWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/show_block.html'


class ShowVerticalWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/show_vertical.html'


class ListWidget(RenderTemplateWidget):
    """
        List Widget implements a Template as an widget.
        It takes the following arguments

        label_columns = []
        include_columns = []
        value_columns = []
        order_columns = []
        page = None
        page_size = None
        count = 0
        pks = []
        actions = None
        filters = {}
        modelview_name = ''
    """
    template = 'appbuilder/general/widgets/list.html'


class ListMasterWidget(ListWidget):
    template = 'appbuilder/general/widgets/list_master.html'


class ListAddWidget(ListWidget):
    template = 'appbuilder/general/widgets/list_add.html'

    def __init__(self, **kwargs):
        super(ListAddWidget, self).__init__(**kwargs)

    def __call__(self, **kwargs):
        return super(ListAddWidget, self).__call__(**kwargs)


class ListThumbnail(ListWidget):
    template = 'appbuilder/general/widgets/list_thumbnail.html'


class ListLinkWidget(ListWidget):
    template = 'appbuilder/general/widgets/list_link.html'


class ListCarousel(ListWidget):
    template = 'appbuilder/general/widgets/list_carousel.html'


class ListItem(ListWidget):
    template = 'appbuilder/general/widgets/list_item.html'


class ListBlock(ListWidget):
    template = 'appbuilder/general/widgets/list_block.html'
