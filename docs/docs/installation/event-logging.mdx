---
title: Event Logging
hide_title: true
sidebar_position: 6
version: 1
---

## Logging

### Event Logging

Superset by default logs special action events in its internal database. These logs can be accessed
on the UI by navigating to **Security > Action Log**. You can freely customize these logs by
implementing your own event log class.

Here's an example of a simple JSON-to-stdout class:

```python
    def log(self, user_id, action, *args, **kwargs):
        records = kwargs.get('records', list())
        dashboard_id = kwargs.get('dashboard_id')
        slice_id = kwargs.get('slice_id')
        duration_ms = kwargs.get('duration_ms')
        referrer = kwargs.get('referrer')

        for record in records:
            log = dict(
                action=action,
                json=record,
                dashboard_id=dashboard_id,
                slice_id=slice_id,
                duration_ms=duration_ms,
                referrer=referrer,
                user_id=user_id
            )
            print(json.dumps(log))
```

End by updating your config to pass in an instance of the logger you want to use:

```
EVENT_LOGGER = JSONStdOutEventLogger()
```

### StatsD Logging

Superset can be instrumented to log events to StatsD if desired. Most endpoints hit are logged as
well as key events like query start and end in SQL Lab.

To setup StatsD logging, it’s a matter of configuring the logger in your `superset_config.py`.

```python
from superset.stats_logger import StatsdStatsLogger
STATS_LOGGER = StatsdStatsLogger(host='localhost', port=8125, prefix='superset')
```

Note that it’s also possible to implement you own logger by deriving
`superset.stats_logger.BaseStatsLogger`.
