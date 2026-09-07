# 3. Redis: queue and cache

[← PostgreSQL](02-postgresql.md) · [Index](README.md) · [Next: Application code →](04-application-code.md)

## 3.1 What Redis does here

Redis does two different jobs for Superset, and it is worth keeping them
separate in your head:

1. **It is the Celery queue.** When the web process needs a chart query run in
   the background, it puts a job in Redis; a Celery worker picks it up. This is
   why a worker on the wrong Redis appears to do nothing at all — it is
   listening to an empty queue.
2. **It is the cache.** Chart results, dashboard filter state, thumbnails and
   Explore form state all live in Redis. This is what makes a warmed dashboard
   open instantly instead of re-running ninety queries.

Superset separates these using numbered logical databases on one connection.
The layout this install uses, matching the existing instances:

| DB | Used for |
|---|---|
| 0 | Celery broker (the job queue itself) |
| 1 | Metadata cache |
| 2 | Chart data cache |
| 3 | Dashboard filter state / thumbnails |
| 4 | Explore form data |
| 5 | SQL Lab results backend |
| 6 | Celery results backend |

## 3.2 Give this instance its own Redis process

Ubuntu's `redis-server` package gives you one instance on port 6379. If that
one is already in use — and on a shared server it is — create a second process
rather than borrowing database numbers from the first. The reasoning is in
[Prerequisites §1.5](01-prerequisites.md#choosing-the-redis-port); the short
version is that a shared Redis has one shared memory ceiling, and filling it
takes down whoever else is using it.

### Create the config file

Copy an existing instance's config and change the four things that make a Redis
instance distinct: its port, its log file, its dump file and its data directory.

```bash
sudo cp /etc/redis/redis.conf /etc/redis/redis-<REDIS_PORT>.conf

sudo sed -i \
  -e 's|^port .*|port <REDIS_PORT>|' \
  -e 's|^logfile .*|logfile /var/log/redis/redis-<REDIS_PORT>.log|' \
  -e 's|^dbfilename .*|dbfilename dump-<REDIS_PORT>.rdb|' \
  -e 's|^dir .*|dir /var/lib/redis-<REDIS_PORT>|' \
  /etc/redis/redis-<REDIS_PORT>.conf
```

Check all four actually changed. `sed` reports no error when its pattern
matches nothing, so a silent no-op is the failure mode to watch for:

```bash
grep -nE '^(port|logfile|dbfilename|dir|bind|maxmemory) ' \
  /etc/redis/redis-<REDIS_PORT>.conf
```

You should see your new port and paths. Also confirm two safety settings:

- `bind 127.0.0.1 -::1` — loopback only. Redis has no password here, so it must
  never be reachable from the network.
- `maxmemory 512mb` — this instance's own ceiling. Set one. Without it, this
  instance can consume all the server's RAM.

If `maxmemory` is missing or `0`:

```bash
echo 'maxmemory 512mb' | sudo tee -a /etc/redis/redis-<REDIS_PORT>.conf
echo 'maxmemory-policy allkeys-lru' | sudo tee -a /etc/redis/redis-<REDIS_PORT>.conf
```

`allkeys-lru` means "when full, throw away the least recently used key". That
is the right policy for a cache. It is the *wrong* policy for a queue, which is
why some instances deliberately use `noeviction` instead — if you copied the
config from such an instance, think about which you want. For a non-critical
instance, `allkeys-lru` is safer for the server as a whole.

### Set permissions and create the data directory

```bash
sudo chown root:redis /etc/redis/redis-<REDIS_PORT>.conf
sudo chmod 0640       /etc/redis/redis-<REDIS_PORT>.conf

sudo mkdir -p /var/lib/redis-<REDIS_PORT>
sudo chown redis:redis /var/lib/redis-<REDIS_PORT>
sudo chmod 0750        /var/lib/redis-<REDIS_PORT>
```

### Create the systemd unit

```bash
sudo tee /etc/systemd/system/redis-<REDIS_PORT>.service > /dev/null <<'UNIT'
# Redis instance dedicated to the <INSTANCE> Superset deployment.
# Separate process (not just separate DB numbers) so this instance has its own
# memory ceiling and its own dump file, and can be removed without touching
# anyone else's keys.
[Unit]
Description=Redis server on port <REDIS_PORT> (<INSTANCE>)
After=network.target

[Service]
Type=notify
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/redis-<REDIS_PORT>.conf --supervised systemd
PIDFile=/run/redis/redis-<REDIS_PORT>.pid
TimeoutStopSec=0
Restart=always
RuntimeDirectory=redis
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
UNIT
```

Replace the `<…>` placeholders in the file you just wrote — the heredoc is
quoted, so the shell did not substitute them for you:

```bash
sudo sed -i 's|<REDIS_PORT>|YOUR_PORT|g; s|<INSTANCE>|YOUR_INSTANCE|g' \
  /etc/systemd/system/redis-YOUR_PORT.service
```

### Start it

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now redis-<REDIS_PORT>.service
```

`enable` makes it start at boot; `--now` also starts it immediately. Forgetting
`enable` is a classic — everything works until the next reboot.

## 3.3 Verify

```bash
systemctl is-active redis-<REDIS_PORT>.service     # expect: active
redis-cli -p <REDIS_PORT> ping                     # expect: PONG
```

Confirm it is a genuinely separate instance and not an echo of another one:

```bash
# This instance must be empty; a busy one means you are talking to somebody else's Redis
redis-cli -p <REDIS_PORT> info keyspace

# Confirm the port really belongs to this new process
sudo ss -tlnp | grep <REDIS_PORT>
```

Write a key here and check it does **not** appear on the other instance:

```bash
redis-cli -p <REDIS_PORT> set isolation_probe hello
redis-cli -p <OTHER_REDIS_PORT> get isolation_probe     # expect: (nil)
redis-cli -p <REDIS_PORT> del isolation_probe
```

If the other instance returns `hello`, the two are the same process and you
must fix that before going further.

---

[← PostgreSQL](02-postgresql.md) · [Index](README.md) · [Next: Application code →](04-application-code.md)
