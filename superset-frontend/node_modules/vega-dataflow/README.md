# vega-dataflow

Reactive dataflow processing.

Defines a reactive dataflow graph that can process both scalar values and streaming relational data. A central `Dataflow` instance manages and schedules a collection of `Operator` instances, each of which is a node in a dataflow graph. Each operator maintains a local state *value*, and may also process streaming data objects (or *tuples*) passing through. Operators may depend on a set of named `Parameters`, which can either be fixed values or live references to other operator values.

Upon modifications to operator parameters or input data, changes are propagated through the graph in topological order. `Pulse` objects propagate from operators to their dependencies, and carry queues of added, removed and/or modified tuples.

This module contains only the core reactive dataflow processing engine. Other modules provide a library of `Operator` types for data stream query processing, including data generation, sampling, filtering, binning, aggregation, cross-stream lookup, visual encoding, and spatial layout.

For more information about data stream transforms, see the [Vega transform documentation](https://vega.github.io/vega/docs/transforms/).
