# Event-flow

demo at <a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a>

<img
  width="700"
  src="https://user-images.githubusercontent.com/4496521/28103495-d58b2c34-668a-11e7-86c3-3b33d853153a.gif"
/>

### Overview
This visualization is inspired by a <a href="https://www.cs.umd.edu/~ben/papers/Wongsuphasawat2011LifeFlow.pdf" target="_blank">2011 LifeFlow paper</a> from Ben Shneiderman's group. It is meant to facilitate finding aggregate patterns in event sequences. It takes multiple user (or generically entity) event sequences as input and aggregates similar sequences together using the following visual paradigm: 

<img
  width="500"
  src="https://user-images.githubusercontent.com/4496521/28243463-9fef9734-697f-11e7-959b-027544c8f6e0.png"
/>

### Features
The visualization has a variety of features to facilitate exploratory analysis:

- #### Event alignment
  Users can align event sequences by an arbitrary event _index_ and event _type_ (e.g., the 2nd click event). This operation can actually filter out event sequences, e.g., if you align by th 3rd event and a sequence only has 2 events or if you align by the first event type "x" and a specific sequence has no events of that type. Filtered nodes are shown visually with a pattern line root node, and in the legend.

- #### Event type filtering
  Users can filter to / filter out specific types of events by clicking on the legend in the right panel. This operation still aligns the fully unfiltered sequences, but then hides relevant event types from view. The number of hidden events is shown in the right panel.

- #### Raw sequence view
  By clicking on any node or edge in the aggregate view, the aggregate panel will filter to the selected subtree and users can view the raw sequences captured by that selection in the bottom panel. You can hide the panel to explore the aggregate view, or clear the selection to return to the unfiltered view.

- #### Event type breakdown
  A breakdown of event type counts is displayed as a pie chart in the right pane. This breakdown also displays the number of filtered or hidden events depending on the vis state.

- #### X-axis -- elapsed time vs sequence
  By default, aggregate nodes are positioned according to the mean elapsed time from the _previous_ node. It can be hard to differentiate closely-spaced events, so the vis also supports positioning nodes by sequence number (1st, 2nd, 3rd, etc) with equal spacing between events.

- #### Node sorting (vertical)
  By default nodes are ordered top -> bottom based on high -> low event count, meaning that the most common nodes appear at the top. Users can also order by short -> long elapsed time to the next event.

- #### Trimming
  To improve visualization / web app performance and to reduce visual noise, nodes which represent less than a minimum number of events can be hidden. Again, all events are considered for sequence alignment, but 'leaf' nodes are hidden from view.

- #### Zooming
  X- and Y-axis zoom + Panning is supported with common mouse movements.
