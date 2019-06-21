DEFAULT_SLICES = {
                  'table': {
                      'slice_name':'Untitled',
                      'datasource':None,
                      'viz_type':'table',
                      'url_params':{},
                      'publish_columns':[],
                      'granularity_sqla':None,
                      'time_grain_sqla':None,
                      'time_range':'No filter',
                      'query_with_partitions':False,
                      'groupby':[],
                      'metrics':None,
                      'percent_metrics':[],
                      'timeseries_limit_metric':None,
                      'row_limit':100,
                      'include_time':False,
                      'order_desc':False,
                      'all_columns':[],
                      'order_by_cols':[],
                      'adhoc_filters':[],
                      'table_timestamp_format':'%Y-%m-%d %H:%M:%S',
                      'page_length':0,
                      'include_search':False,
                      'table_filter':False,
                      'align_pn':False,
                      'color_pn':True
                  },
                  'pie': {
                      'slice_name':'Untitled',
                      'datasource':None,
                      'viz_type':'pie',
                      'url_params':{},
                      'publish_columns':[],
                      'granularity_sqla':None,
                      'time_grain_sqla':None,
                      'time_range':'No filter',
                      'query_with_partitions':True,
                      'metric':{
                          'expressionType':'SIMPLE',
                          'column':{
                              'column_name':'variable',
                              'verbose_name':None,
                              'description':None,
                              'expression':'',
                              'filterable':True,
                              'groupby':True,
                              'is_dttm':False,
                              'type':'STRING',
                              'database_expression':None,
                              'python_date_format':None,
                              'optionName':'_col_variable'
                            },
                          'aggregate':'SUM',
                          'sqlExpression':None,
                          'hasCustomLabel':False,
                          'fromFormData':False,
                          'label':'SUM(variable)',
                          'optionName':'metric_02qsr6hpi1cw_a31d68o81b'
                      },
                      'adhoc_filters':[],
                      'groupby':['agg_count'],
                      'row_limit':100,
                      'pie_label_type':'key',
                      'number_format':'.3s',
                      'donut':False,
                      'show_legend':True,
                      'show_labels':True,
                      'labels_outside':True,
                      'color_scheme':'bnbColors'
                  },
                  'line': {
                    'slice_name':'Untitled',
                    'datasource':None,
                    'viz_type':'line',
                    'url_params':{},
                    'publish_columns':[],
                    'granularity_sqla':None,
                    'time_grain_sqla':None,
                    'time_range':'No filter',
                    'query_with_partitions':True,
                    'metrics':[
                    {
                      'expressionType':'SIMPLE',
                      'column':{
                        'column_name':'intensity_anomaly',
                        'verbose_name':None,
                        'description':None,
                        'expression':'cast(substr(intensity_anomaly, 1, 13) as float)',
                        'filterable':True,
                        'groupby':True,
                        'is_dttm':True,
                        'type':'NUMBER',
                        'database_expression':None,
                        'python_date_format':None,
                        'optionName':'_col_intensity_anomaly'
                      },
                      'aggregate':'SUM','sqlExpression':None,
                      'hasCustomLabel':False,
                      'fromFormData':False,
                      'label':'SUM(intensity_anomaly)',
                      'optionName':'metric_lroxvsvj0wp_3vukvtskqso'
                    }],
                    'adhoc_filters':[],
                    'groupby':[],
                    'timeseries_limit_metric':None,
                    'order_desc':True,
                    'contribution':False,
                    'row_limit':100,
                    'color_scheme':'bnbColors',
                    'show_brush':'auto',
                    'send_time_range':False,
                    'show_legend':True,
                    'rich_tooltip':True,
                    'show_markers':False,
                    'line_interpolation':'linear',
                    'x_axis_label':'',
                    'bottom_margin':'auto',
                    'x_ticks_layout':'auto',
                    'x_axis_format':'smart_date',
                    'x_axis_showminmax':False,
                    'y_axis_label':'',
                    'left_margin':'auto',
                    'y_axis_showminmax':False,
                    'y_log_scale':False,
                    'y_axis_format':'.3s',
                    'y_axis_bounds':[None,None],
                    'rolling_type':'None',
                    'comparison_type':'values',
                    'resample_how':None,
                    'resample_rule':None,
                    'resample_fillmethod':None,
                    'annotation_layers':[]
                  },
                  'dist_bar': {
                     'slice_name':'Untitled',
                     'datasource':None,
                     'viz_type':'dist_bar',
                     'url_params':{},
                     'publish_columns':[],
                     'granularity_sqla':None,
                     'time_grain_sqla':None,
                     'time_range':'Last week',
                     'query_with_partitions':False,
                     'metrics':[
                      {
                         'expressionType':'SIMPLE',
                         'column':{
                           'column_name':'changed_on',
                           'verbose_name':None,
                           'description':None,
                           'expression':'',
                           'filterable':True,
                           'groupby':True,
                           'is_dttm':True,
                           'type':'TIMESTAMP WITHOUT TIME ZONE',
                           'database_expression':None,
                           'python_date_format':None,
                           'optionName':'_col_changed_on'
                        },
                        'aggregate':'COUNT',
                        'sqlExpression':None,
                        'hasCustomLabel':False,
                        'fromFormData':True,
                        'label':'COUNT(changed_on)',
                        'optionName':'metric_93ultv39q4_91gfus7ijqa'
                      }],
                      'adhoc_filters':[],
                      'groupby':['created_on'],
                      'columns':[],
                      'row_limit':100,
                      'contribution':False,
                      'color_scheme':'bnbColors',
                      'show_legend':True,
                      'show_bar_value':False,
                      'bar_stacked':False,
                      'order_bars':False,
                      'y_axis_format':'.3s',
                      'y_axis_label':'',
                      'show_controls':False,
                      'x_axis_label':'',
                      'bottom_margin':'auto',
                      'x_ticks_layout':'auto',
                      'reduce_x_ticks':False
                  }

}

SIMPLE_ADHOC_FILTER = {
                'clause': 'WHERE',
                'comparator': '0',
                'expressionType': 'SIMPLE',
                'filterOptionName': 'filter_kzua5dxzas_eny55grh7z',
                'fromFormData': True,
                'operator': '==',
                'sqlExpression': None,
                'subject': None
}

DEFAULT_COLUMN = {
              'column_name': 'aggregated_metric',
              'database_expression': None,
              'description': None,
              'expression': '',
              'filterable': True,
              'groupby': True,
              'is_dttm': False,
              'optionName': '_col_aggregated_metric',
              'python_date_format': None,
              'type': 'NUMBER',
              'verbose_name': None
}

DEFAULT_METRIC = {
              'aggregate': 'SUM',
              'column': {
              },
              'expressionType': 'SIMPLE',
              'fromFormData': True,
              'hasCustomLabel': False,
              'label': 'SUM(aggregated_metric)',
              'optionName': 'metric_kdw7m7era8_n3780y6yebi',
              'sqlExpression': None
}

def update_slice_metadata(slice):
    default_slice_info = DEFAULT_SLICES[slice['viz_type']]
    temp_slice = list(default_slice_info)

    for key in temp_slice:

      if key not in slice:
        slice[key] = default_slice_info[key]

      if key == 'adhoc_filters' and key in slice  and slice[key] != None:
        for filter in slice[key]:
          for prop in SIMPLE_ADHOC_FILTER:
            if prop not in filter:
              filter[prop] = SIMPLE_ADHOC_FILTER[prop]

      if key == 'metrics' and key in slice and slice[key] != None:
        for metric in slice[key]:
          for prop in DEFAULT_METRIC:
            if prop == 'column':
                for column_prop in DEFAULT_COLUMN:
                  if column_prop not in metric[prop]:
                    metric[prop][column_prop] = DEFAULT_COLUMN[column_prop]
            if prop not in metric:
              metric[prop] = DEFAULT_METRIC[prop]


      if key == 'metric' and key in slice and slice[key] != None:
         metric = slice[key]
         for prop in DEFAULT_METRIC:
            if prop == 'column':
                for column_prop in DEFAULT_COLUMN:
                  if column_prop not in metric[prop]:
                    metric[prop][column_prop] = DEFAULT_COLUMN[column_prop]
            if prop not in metric:
              metric[prop] = DEFAULT_METRIC[prop]


    return slice



