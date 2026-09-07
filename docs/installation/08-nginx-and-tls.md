# 8. nginx and HTTPS

[← systemd](07-systemd.md) · [Index](README.md) · [Next: Verification →](09-verification.md)

nginx does three jobs: it terminates HTTPS, it forwards everything else to
gunicorn, and it serves the ~99 MB of static frontend files itself so they
never occupy a Python worker.

## 8.1 Before you touch the config

On a shared server, `/etc/nginx/sites-available/default` holds every site.
A mistake here takes all of them down. Back it up first, every time:

```bash
sudo cp -a /etc/nginx/sites-available/default \
          /etc/nginx/sites-available/default.bak-$(date +%Y%m%d-%H%M%S)
```

Confirm DNS already points at this server. If it does not, the certificate step
later will fail:

```bash
getent hosts <DOMAIN>
curl -s ifconfig.me; echo     # must match
```

## 8.2 Add the server block

Append to `/etc/nginx/sites-available/default`:

```nginx
# Without upstream{} + keepalive, nginx opens a new TCP connection to gunicorn
# for every single request.
upstream <INSTANCE>_app {
    server 127.0.0.1:<GUNICORN_PORT>;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name <DOMAIN>;

    access_log /var/log/nginx/<INSTANCE>.access.log;
    error_log  /var/log/nginx/<INSTANCE>.error.log warn;

    # Superset serves large CSV/Excel exports and accepts dashboard imports.
    client_max_body_size 100M;

    location / {
        proxy_pass http://<INSTANCE>_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_pass_request_headers on;
        proxy_set_header Cookie $http_cookie;

        # Must stay >= gunicorn's --timeout (120s), or nginx gives up on a slow
        # dashboard query before gunicorn does and the user sees a 504 while
        # the query is still running.
        proxy_read_timeout 180s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 180s;
    }

    # Serve the compiled frontend directly. ~1000 files, ~99MB.
    # NOTE: /static/appbuilder/ is deliberately NOT matched -- it is served from
    # inside the flask_appbuilder package and must reach Flask.
    location /static/assets/ {
        alias <APP_DIR>/superset/static/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri @<INSTANCE>_fallback;
    }

    location @<INSTANCE>_fallback {
        proxy_pass http://<INSTANCE>_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    gzip on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_types application/json application/javascript text/javascript text/css
               text/plain image/svg+xml;
}
```

Three things people get wrong here:

- **`proxy_set_header Connection ""`** — required for keepalive to the upstream.
  Without it nginx sends `Connection: close` and the pool is pointless.
- **The trailing slash on `alias`** — `alias <APP_DIR>/superset/static/assets/;`
  must end in `/` to match the `location` that also ends in `/`. Omit it and
  you get 404s on every asset.
- **`try_files $uri @fallback`** — if a file is not on disk, hand the request to
  Flask instead of returning 404. Superset serves a few assets dynamically.

### Test and reload

Always in this order. `nginx -t` checks the syntax of every site on the server:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

`reload` finishes in-flight requests before switching; `restart` drops them.
Use `reload`.

If `nginx -t` fails, fix it before reloading — a running nginx keeps serving
the old config, so you have not broken anything yet.

### Confirm you did not disturb the other sites

```bash
for u in https://<OTHER_SITE_1>/ https://<OTHER_SITE_2>/; do
  curl -s -o /dev/null -w "%{http_code}  $u\n" "$u"
done
```

Do this every time you reload nginx on a shared server.

## 8.3 Get a TLS certificate

```bash
sudo certbot --nginx -d <DOMAIN> --agree-tos --redirect
```

`--redirect` makes certbot add the HTTP→HTTPS redirect for you. It edits the
server block in place and reloads nginx.

On a server that already has certbot certificates, reuse the same ACME account
rather than registering a new one:

```bash
# find the existing account id
ls /etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory/

sudo certbot --nginx -d <DOMAIN> \
  --non-interactive --agree-tos --keep-until-expiring \
  --account <ACCOUNT_ID> --key-type ecdsa --redirect
```

Verify:

```bash
curl -s -o /dev/null -w "https  -> %{http_code}\n" https://<DOMAIN>/health
curl -s -o /dev/null -w "http   -> %{http_code} -> %{redirect_url}\n" http://<DOMAIN>/
```

You want `200`, then `301` to the `https://` URL.

Renewal is automatic — certbot installs a systemd timer. Confirm it:

```bash
systemctl list-timers | grep -i certbot
sudo certbot renew --dry-run
```

> **Warning**
> Let's Encrypt rate-limits certificate issuance (currently 5 identical
> certificates per week). Get the nginx config right *before* running certbot,
> so you are not re-issuing repeatedly to fix an unrelated mistake.

## 8.4 Serving a separate single-page web client

If a Flutter/React web client is served from its own hostname, it needs a
different kind of server block — static files, not a proxy:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name <WEB_DOMAIN>;

    root /var/www/<WEB_INSTANCE>;
    index index.html;

    # A single-page app: any path that is not a real file must return
    # index.html, or refreshing the browser on a deep link gives a 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Build tools emit content-hashed filenames under these paths, so they are
    # safe to cache hard.
    location ~* ^/(assets|canvaskit|icons)/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # index.html and the service worker must NOT be cached, or users keep
    # running the previous build after every deploy.
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    location = /flutter_service_worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    gzip on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_types application/json application/javascript text/javascript text/css
               text/plain image/svg+xml application/wasm;
}
```

Because the client is on a different hostname from the API, its browser
requests are cross-origin. Two things must line up or every API call fails:

1. `<WEB_DOMAIN>` must appear in `CORS_OPTIONS["origins"]` in
   `superset_config.py` — see [§5.3](05-configuration.md#cors-origins).
2. Session cookies must reach the API. If both hostnames are subdomains of the
   same registered domain, the default `SameSite=Lax` is fine. If they are on
   genuinely different domains, cookies will be dropped and you need a
   different auth approach — do not "fix" this by weakening cookie settings
   without understanding what you are giving up.

Test the preflight explicitly:

```bash
curl -s -i -X OPTIONS https://<DOMAIN>/api/v1/security/login \
  -H "Origin: https://<WEB_DOMAIN>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  | grep -iE '^HTTP|access-control-allow-'
```

You want `200` with `Access-Control-Allow-Origin: https://<WEB_DOMAIN>` and
`Access-Control-Allow-Credentials: true`.

---

[← systemd](07-systemd.md) · [Index](README.md) · [Next: Verification →](09-verification.md)
