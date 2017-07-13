from flask_appbuilder.widgets import RenderTemplateWidget


class ChartWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/chart.html'


class DirectChartWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/direct_chart.html'


class MultipleChartWidget(RenderTemplateWidget):
    template = 'appbuilder/general/widgets/multiple_chart.html'

