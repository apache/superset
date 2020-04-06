..  Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

..    http://www.apache.org/licenses/LICENSE-2.0

..  Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

Exploring data with Apache Superset
===================================

In this tutorial, we will introduce key concepts in Apache Superset
through the exploration of a real dataset which contains the flights
made by employees of a UK-based organization in 2011. The following
information about each flight is given:

-  The traveller's department. For the purposes of this tutorial the
   departments have been renamed Orange, Yellow and Purple.
-  The cost of the ticket.
-  The travel class (Economy, Premium Economy, Business and First
   Class).
-  Whether the ticket was a single or return.
-  The date of travel.
-  Information about the origin and destination.
-  The distance between the origin and destination, in kilometers (km).

Enabling Upload a CSV Functionality
-----------------------------------

You may need to enable the functionality to upload a CSV to your
database. The following section explains how to enable this
functionality for the examples database.

In the top menu, select :menuselection:`Sources --> Databases`. Find the
:guilabel:`examples` database in the list and select the edit record
button.

.. image:: _static/images/usertutorial/edit-record.png

Within the :guilabel:`Edit Database` page, check the
:guilabel:`Allow Csv Upload` checkbox.

Finally, save by selecting :guilabel:`Save` at the bottom of the page.

Obtaining and loading the data
------------------------------

Download the data for this tutorial to your computer from
`Github <https://raw.githubusercontent.com/apache-superset/examples-data/master/tutorial_flights.csv>`__.

In the top menu, select :menuselection:`Sources --> Upload a CSV`.

.. image:: _static/images/usertutorial/upload_a_csv.png

Then, enter the :guilabel:`Table name` as `tutorial_flights`
and select the :guilabel:`CSV file` from your computer.

.. image:: _static/images/usertutorial/csv_to_database_configuration.png

Next enter the text `Travel Date` into the
:guilabel:`Parse Dates` field.

.. image:: _static/images/usertutorial/parse_dates_column.png

Leaving all the other options in their default settings, select
:guilabel:`Save` at the bottom of the page.

Table Visualization
-------------------

In this section, we’ll create our first visualization: a table to show
the number of flights and cost per travel class.

To create a new chart, select the :menuselection:`New --> Chart`.

.. image:: _static/images/usertutorial/add_new_chart.png

Once in the :guilabel:`Create a new chart` dialogue, select
:guilabel:`tutorial_flights` from the :guilabel:`Chose a datasource`
dropdown.

.. image:: _static/images/usertutorial/chose_a_datasource.png

Next, select the visualization type as :guilabel:`Table`.

.. image:: _static/images/usertutorial/select_table_visualization_type.png

Then, select :guilabel:`Create new chart` to go into the chart view.

By default, Apache Superset only shows the last week of data: in our
example, we want to look at all the data in the dataset. No problem -
within the :guilabel:`Time` section, remove the filter on
:guilabel:`Time range` by selecting on :guilabel:`Last week` then
changing the selection to :guilabel:`No filter`, with a final
:guilabel:`OK` to confirm your selection.

.. image:: _static/images/usertutorial/no_filter_on_time_filter.png

Now, we want to specify the rows in our table by using the
:guilabel:`Group by` option. Since in this example, we want to
understand different Travel Classes, we select :guilabel:`Travel Class`
in this menu.

Next, we can specify the metrics we would like to see in our table with
the :guilabel:`Metrics` option. :guilabel:`Count(*)`, which represents the number of
rows in the table (in this case corresponding to the number of flights
since we have a row per flight), is already there. To add cost, within
:guilabel:`Metrics`, select :guilabel:`Cost`. :guilabel:`Save` the
default aggregation option, which is to sum the column.

.. image:: _static/images/usertutorial/sum_cost_column.png

Finally, select :guilabel:`Run Query` to see the results of the table.

.. image:: _static/images/usertutorial/tutorial_table.png

Congratulations, you have created your first visualization in Apache
Superset!

To save the visualization, click on :guilabel:`Save` in the top left of
the screen. Select the :guilabel:`Save as` option, and enter the chart
name as Tutorial Table (you will be able to find it again through the
:guilabel:`Charts` screen, accessible in the top menu). Similarly,
select :guilabel:`Add to new dashboard` and enter `Tutorial Dashboard`.
Finally, select :guilabel:`Save & go to dashboard`.

.. image:: _static/images/usertutorial/save_tutorial_table.png

Dashboard basics
----------------

Next, we are going to explore the dashboard interface. If you’ve
followed the previous section, you should already have the dashboard
open. Otherwise, you can navigate to the dashboard by selecting
:guilabel:`Dashboards` on the top menu, then :guilabel:`Tutorial dashboard`
from the list of dashboards.

On this dashboard you should see the table you created in the previous
section. Select :guilabel:`Edit dashboard` and then hover over the
table. By selecting the bottom right hand corner of the table (the
cursor will change too), you can resize it by dragging and dropping.

.. image:: _static/images/usertutorial/resize_tutorial_table_on_dashboard.png

Finally, save your changes by selecting :guilabel:`Save changes` in the
top right.

Pivot Table
-----------

In this section, we will extend our analysis using a more complex
visualization, Pivot Table. By the end of this section, you will have
created a table that shows the monthly spend on flights for the first
six months, by department, by travel class.

As before, create a new visualization by selecting
:menuselection:`New --> Chart` on the top menu. Choose tutorial_flights
again as a datasource, then click on the visualization type to get to
the visualization menu. Select the :guilabel:`Pivot Table` visualization
(you can filter by entering text in the search box) and then
:guilabel:`Create a new chart`.

In the :guilabel:`Time` section, keep the Time Column as Travel Date
(this is selected automatically as we only have one time column in our
dataset). Then select :guilabel:`Time Grain` to be month as having daily
data would be too granular to see patterns from. Then select the time
range to be the first six months of 2011 by click on Last week in the
:guilabel:`Time Range` section, then in :guilabel:`Custom` selecting a
:guilabel:`Start / end` of 1\ :sup:`st` January 2011 and 30\ :sup:`th`
June 2011 respectively by either entering directly the dates or using
the calendar widget (by selecting the month name and then the year, you
can move more quickly to far away dates).

.. image:: _static/images/usertutorial/select_dates_pivot_table.png

Next, within the :guilabel:`Query` section, remove the default COUNT(*)
and add Cost, keeping the default SUM aggregate. Note that Apache
Superset will indicate the type of the metric by the symbol on the left
hand column of the list (ABC for string, # for number, a clock face for
time, etc.).

In :guilabel:`Group by` select :guilabel:`Time`: this will automatically
use the Time Column and Time Grain selections we defined in the Time
section.

Within :guilabel:`Columns`, select first :guilabel:`Department` and then
:guilabel:`Travel Class`. All set – let’s :guilabel:`Run Query` to see
some data!

.. image:: _static/images/usertutorial/tutorial_pivot_table.png

You should see months in the rows and Department and Travel Class in the
columns. To get this in our dashboard, select :guilabel:`Save`, name the
chart Tutorial Pivot and using
:guilabel:`Add chart to existing dashboard` select
:guilabel:`Tutorial Dashboard`, and then finally
:guilabel:`Save & go to dashboard`.

Line Chart
----------

In this section, we are going to create a line chart to understand the
average price of a ticket by month across the entire dataset. As before,
select :menuselection:`New --> Chart`, and then
:guilabel:`tutorial_flights` as the datasource and
:guilabel:`Line Chart` as the visualization type.

In the Time section, as before, keep the :guilabel:`Time Column` as
Travel Date and :guilabel:`Time Grain` as month but this time for the
:guilabel:`Time range` select :guilabel:`No filter` as we want to look
at entire dataset.

Within :guilabel:`Metrics`, remove the default :guilabel:`COUNT(*)` and
add :guilabel:`Cost`. This time, we want to change how this column is
aggregated to show the mean value: we can do this by selecting
:guilabel:`AVG` in the :guilabel:`aggregate` dropdown.

.. image:: _static/images/usertutorial/average_aggregate_for_cost.png

Next, select :guilabel:`Run Query` to show the data on the chart.

How does this look? Well, we can see that the average cost goes up in
December. However, perhaps it doesn’t make sense to combine both single
and return tickets, but rather show two separate lines for each ticket
type.

Let’s do this by selecting :guilabel:`Ticket Single or Return` in the
:guilabel:`Group by` box, and the selecting :guilabel:`Run Query` again.
Nice! We can see that on average single tickets are cheaper than returns
and that the big spike in December is caused by return tickets.

Our chart is looking pretty good already, but let’s customize some more
by going to the :guilabel:`Customize` tab on the left hand pane. Within
this pane, try changing the :guilabel:`Color Scheme`, removing the range
filter by selecting No in the :guilabel:`Show Range Filter` drop down
and adding some labels using :guilabel:`X Axis Label` and
:guilabel:`Y Axis Label`.

.. image:: _static/images/usertutorial/tutorial_line_chart.png

Once you’re done, :guilabel:`Save` as Tutorial Line Chart, use
:guilabel:`Add chart to
existing dashboard` to add this chart to the previous ones on the
Tutorial Dashboard and then :guilabel:`Save & go to dashboard`.

Markup
------

In this section, we will add some text to our dashboard. If you’re there
already, you can navigate to the dashboard by selecting
:guilabel:`Dashboards` on the top menu, then
:guilabel:`Tutorial dashboard` from the list of dashboards. Got into
edit mode by selecting :guilabel:`Edit dashboard`.

Within the Insert components pane, drag and drop a :guilabel:`Markdown`
box on the dashboard. Look for the blue lines which indicate the anchor
where the box will go.

.. image:: _static/images/usertutorial/blue_bar_insert_component.png

Now, to edit the text, select the box. You can enter text, in markdown
format (see `this Markdown
Cheatsheet <https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet>`__
for more information about this format). You can toggle between
:guilabel:`Edit` and :guilabel:`Preview` using the menu on the top of
the box.

.. image:: _static/images/usertutorial/markdown.png

To exit, select any other part of the dashboard. Finally, don’t forget
to keep your changes using :guilabel:`Save changes`.

Filter box
----------

In this section, you will learn how to add a filter to your dashboard.
Specifically, we will create a filter that allows us to look at those
flights that depart from a particular country.

A filter box visualization can be created as any other visualization by
selecting :menuselection:`New --> Chart`, and then
:guilabel:`tutorial_flights` as the datasource and
:guilabel:`Filter Box` as the visualization type.

First of all, in the :guilabel:`Time` section, remove the filter from
the :guilabel:`Time
range` selection by selecting :guilabel:`No filter`.

Next, in :guilabel:`Filters Configurations` first add a new filter by
selecting the plus sign and then edit the newly created filter by
selecting the pencil icon.

For our use case, it makes most sense to present a list of countries in
alphabetical order. First, enter the column as
:guilabel:`Origin Country` and keep all other options the same and then
select :guilabel:`Run Query`. This gives us a preview of our filter.

Next, remove the date filter by unchecking the :guilabel:`Date Filter`
checkbox.

.. image:: _static/images/usertutorial/filter_on_origin_country.png

Finally, select :guilabel:`Save`, name the chart as Tutorial Filter, add
the chart to our existing Tutorial Dashboard and then
:guilabel:`Save & go to
dashboard`. Once on the Dashboard, try using the filter to show only
those flights that departed from the United Kingdom – you will see the
filter is applied to all of the other visualizations on the dashboard.

Publishing your dashboard
-------------------------

If you have followed all of the steps outlined in the previous section,
you should have a dashboard that looks like the below. If you would
like, you can rearrange the elements of the dashboard by selecting
:guilabel:`Edit dashboard` and dragging and dropping.

If you would like to make your dashboard available to other users,
simply select :guilabel:`Draft` next to the title of your dashboard on
the top left to change your dashboard to be in :guilabel:`Published`
state. You can also favorite this dashboard by selecting the star.

.. image:: _static/images/usertutorial/publish_dashboard.png

Taking your dashboard further
-----------------------------

In the following sections, we will look at more advanced Apache Superset
topics.

Annotations
-----------

Annotations allow you to add additional context to your chart. In this
section, we will add an annotation to the Tutorial Line Chart we made in
a previous section. Specifically, we will add the dates when some
flights were cancelled by the UK's Civil Aviation Authority in response
to the eruption of the Grímsvötn volcano in Iceland (23-25 May 2011).

First, add an annotation layer by navigating to
:menuselection:`Manage --> Annotation Layers`. Add a new annotation
layer by selecting the green plus sign to add a new record. Enter the
name Volcanic Eruptions and save. We can use this layer to refer to a
number of different annotations.

Next, add an annotation by navigating to
:menuselection:`Manage --> Annotations` and then create a new annotation
by selecting the green plus sign. Then, select the
:guilabel:`Volcanic Eruptions` layer, add a short description Grímsvötn
and the eruption dates (23-25 May 2011) before finally saving.

.. image:: _static/images/usertutorial/edit_annotation.png

Then, navigate to the line chart by going to :guilabel:`Charts` then
selecting :guilabel:`Tutorial
Line Chart` from the list. Next, go to the
:guilabel:`Annotations and Layers` section and select
:guilabel:`Add Annotation Layer`. Within this dialogue:

- name the layer as `Volcanic Eruptions`
- change the :guilabel:`Annotation Layer Type` to :guilabel:`Event`
- set the :guilabel:`Annotation Source` as :guilabel:`Superset annotation`
- specify the :guilabel:`Annotation Layer` as :guilabel:`Volcanic Eruptions`

.. image:: _static/images/usertutorial/annotation_settings.png

Select :guilabel:`Apply` to see your annotation shown on the chart.

.. image:: _static/images/usertutorial/annotation.png

If you wish, you can change how your annotation looks by changing the
settings in the :guilabel:`Display configuration` section. Otherwise,
select :guilabel:`OK` and finally :guilabel:`Save` to save your chart.
If you keep the default selection to overwrite the chart, your
annotation will be saved to the chart and also appear automatically in
the Tutorial Dashboard.

Advanced Analytics
------------------

In this section, we are going to explore the Advanced Analytics feature
of Apache Superset that allows you to apply additional transformations
to your data. The three types of transformation are:

Moving Average
  Select a rolling window [#f1]_, and then apply a calculation on it (mean,
  sum or standard deviation). The fourth option, cumsum, calculates the
  cumulative sum of the series [#f2]_.

Time Comparison
  Shift your data in time and, optionally, apply a calculation to compare the
  shifted data with your actual data (e.g. calculate the absolute difference
  between the two).

Python Functions
  Resample your data using one of a variety of methods [#f3]_.

Setting up the base chart
~~~~~~~~~~~~~~~~~~~~~~~~~

In this section, we're going to set up a base chart which we can then
apply the different Advanced Analytics features to. Start off by
creating a new chart using the same :guilabel:`tutorial_flights`
datasource and the :guilabel:`Line Chart` visualization type. Within the
Time section, set the :guilabel:`Time Range` as 1\ :sup:`st` October
2011 and 31\ :sup:`st` October 2011.

Next, in the query section, change the :guilabel:`Metrics` to the sum of
:guilabel:`Cost`. Select :guilabel:`Run Query` to show the chart. You
should see the total cost per day for each month in October 2011.

.. image:: _static/images/usertutorial/advanced_analytics_base.png

Finally, save the visualization as Tutorial Advanced Analytics Base,
adding it to the Tutorial Dashboard.

Rolling mean
~~~~~~~~~~~~

There is quite a lot of variation in the data, which makes it difficult
to identify any trend. One approach we can take is to show instead a
rolling average of the time series. To do this, in the
:guilabel:`Moving Average` subsection of :guilabel:`Advanced Analytics`,
select mean in the :guilabel:`Rolling` box and enter 7 into both Periods
and Min Periods. The period is the length of the rolling period
expressed as a multiple of the :guilabel:`Time Grain`. In our example,
the :guilabel:`Time Grain` is day, so the rolling period is 7 days, such
that on the 7th October 2011 the value shown would correspond to the
first seven days of October 2011. Lastly, by specifying
:guilabel:`Min Periods` as 7, we ensure that our mean is always
calculated on 7 days and we avoid any ramp up period.

After displaying the chart by selecting :guilabel:`Run Query` you will
see that the data is less variable and that the series starts later as
the ramp up period is excluded.

.. image:: _static/images/usertutorial/rolling_mean.png

Save the chart as Tutorial Rolling Mean and add it to the Tutorial
Dashboard.

Time Comparison
~~~~~~~~~~~~~~~

In this section, we will compare values in our time series to the value
a week before. Start off by opening the Tutorial Advanced Analytics Base
chart, by going to :guilabel:`Charts` in the top menu and then selecting
the visualization name in the list (alternatively, find the chart in the
Tutorial Dashboard and select Explore chart from the menu for that
visualization).

Next, in the :guilabel:`Time Comparison` subsection of
:guilabel:`Advanced Analytics`, enter the :guilabel:`Time Shift` by
typing in "minus 1 week" (note this box accepts input in natural
language). :guilabel:`Run Query` to see the new chart, which has an
additional series with the same values, shifted a week back in time.

.. image:: _static/images/usertutorial/time_comparison_two_series.png

Then, change the :guilabel:`Calculation type` to
:guilabel:`Absolute difference` and select :guilabel:`Run
Query`. We can now see only one series again, this time showing the
difference between the two series we saw previously.

.. image:: _static/images/usertutorial/time_comparison_absolute_difference.png

Save the chart as Tutorial Time Comparison and add it to the Tutorial
Dashboard.

Resampling the data
~~~~~~~~~~~~~~~~~~~

In this section, we'll resample the data so that rather than having
daily data we have weekly data. As in the previous section, reopen the
Tutorial Advanced Analytics Base chart.

Next, in the :guilabel:`Python Functions` subsection of
:guilabel:`Advanced Analytics`, enter 7D, corresponding to seven days,
in the :guilabel:`Rule` and median as the :guilabel:`Method` and show
the chart by selecting :guilabel:`Run Query`.

.. image:: _static/images/usertutorial/resample.png

Note that now we have a single data point every 7 days. In our case, the
value showed corresponds to the median value within the seven daily data
points. For more information on the meaning of the various options in
this section, refer to the `Pandas
documentation <https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.resample.html>`__.

Lastly, save your chart as Tutorial Resample and add it to the Tutorial
Dashboard. Go to the tutorial dashboard to see the four charts side by
side and compare the different outputs.

.. rubric:: Footnotes

.. [#f1] See the Pandas `rolling method documentation <https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.rolling.html>`_ for more information.
.. [#f2] See the Pandas `cumsum method documentation <https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.cumsum.html>`_ for more information.
.. [#f3] See the Pandas `resample method documentation <https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.resample.html>`_ for more information.
