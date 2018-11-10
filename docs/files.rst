Files
=====
Superset can visualize data contained in flat files or outputted by REST APIs
using Pandas.  This page clarifies the features and limitations of using File
Datasources with Superset.
File Datasources do not use files uploaded directly to the Superset server. The
files are stored elsewhere and downloaded (and cached) by Superset when required.
This approach offers two important advantages over uploaded files:
1. If the remote file is updated, then Superset will automatically download
and use the new data when the datasource timeout expires. If the file had
been uploaded manually then each change in the source data would require a
new manual upload.
2. Data can be provided by a REST API rather than an actual file. This provides
a method to use Superset to visualize current data stored in other systems
without needing to manually extract it first.
.. note ::
    A File Datasource downloads the full content of the source url
    and then performs all filtering, grouping and aggregation locally
    on the Superset server.  File Datasources that access large
    volumes of data may impact server performance and affect other users.
    Server administrators should ensure that adequate memory and CPU
    resources are available before enabling the File Datasource.
Installation
''''''''''''
File Datasources are not enabled by default. To enable them the systems
administrator should update the `superset_config.py` or other configuration
file to include: :: python
    # Include additional data sources
    ADDITIONAL_MODULE_DS_MAP = {
        'contrib.connectors.pandas.models': ['PandasDatasource'],
    }
Supported Formats
'''''''''''''''''
File Datasources use the `Pandas library <http://pandas.pydata.org/>`_
directly. Using a default installation in Superset, Pandas can read the
following formats:
* csv
* html
* json
* Microsoft Excel
* Stata
If the appropriate dependencies have also been installed then the following
additional formats are supported:
* HDF5 (if PyTables is installed: `pip install tables`)
* Feather (if Feather is installed: `pip install feather-format`)
See the `Pandas Dependencies <http://pandas.pydata.org/pandas-docs/stable/install.html#dependencies>`_
documentation for more information.
Adding a File Datasource
''''''''''''''''''''''''
When you add a new File Datasource you need to provide the following information:
* Source URL: the URL that the file to be visualized can be downloaded from.
This can be a file hosted on another server or on a file sharing platform
such as Dropbox, Google Drive or Amazon S3. It can also be the URL of a REST API
end point.
* Source Credentials: if the Source URL requires authentication then specify
the credentials to be used. Credentials entered as ``["username", "password"]`` -
i.e. as a valid username and password enclosed in quotation marks, separated
by a comma and surrounded by parentheses - will be treated as a separate username
and password and the File Datasource will use HTTP Basic Auth to authenticate to
the remote server. Text in any other format will be passed to the remote server
as an `Authentication` header. Typically this is used with API tokens issued by
the remote server. Remote servers that require authentication should also use
an HTTPS Source URL.
* Source Parameters: a JSON-formatted dictionary of additional query parameters
that are passed to the remote server. This field will not be required for file
downloads, but is useful for specifying requests against REST APIs.
* Format: The format of the data returned by the remote server
* Read Parameters: a JSON-formatted dictionary of additional parameters that are
passed to Pandas when the file retrieved from the remote Server is read into a
DataFrame.
Aggregations
''''''''''''
Common aggregations can be defined and used in Superset.
The first and simpler use case is to use the checkbox matrix exposed in your
datasource's edit view (``Sources -> File Datasources ->
[your datasource] -> Edit -> [tab] List Datasource Column``).
Clicking the ``GroupBy`` and ``Filterable`` checkboxes will make the column
appear in the related dropdowns while in explore view. Checking
``Count Distinct``, ``Min``, ``Max`` ``Average`` or ``Sum`` will result in creating
new metrics that will appear in the ``List Metrics`` tab. 
You can create your own aggregations manually from the ``List Metrics`` tab for
more complex cases.
Post-Aggregations
'''''''''''''''''
File Datasources allow post aggregation in Superset. Any Metric that has been
defined for the Datasource can be used as part of a Result Filter to limit
the returned data.