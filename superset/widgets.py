from flask_appbuilder.widgets import ListWidget


class CsvListWidget(ListWidget):
    template = 'superset/widgets/list.html'
