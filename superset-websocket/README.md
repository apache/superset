
NOT using Redis Stream consumer groups due to the fact that they only read
a subset of the data for a stream, and Websocket clients have a persistent
connection to each app instance, requiring access to all data in a stream.
Horizontal scaling of the websocket app means having multiple websocket servers,
each with full access to the Redis Stream.

Stream options:

1. Stream for each Superset installation (including all horizontal nodes)
  Pros:
    - single (blocking?) connection to Redis
  Cons:
    - retrieving records for a single user on reconnection will be inefficient
2. Stream for each Superset user
  Pros:
    - retrieving records for a single user on reconnection will be namespaced
    - reading only from streams for users connected to this wss server instance
  Cons:
    - multiple (blocking?) connections to Redis
      - could read multiple streams using the same blocking connection
    - Users could be connected to multiple wss server instances in different browser tabs
3. Publish events to two streams, one global and one user-specific [SELECTED].
  Single blocking connection (XREAD) to continuously ready new events on the global stream.
  Load data from user-specific streams (XRANGE) only upon reconnection to fetch any missed events.
