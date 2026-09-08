# 4. Application code and the Python environment

[← Redis](03-redis.md) · [Index](README.md) · [Next: Configuration →](05-configuration.md)

This is the longest page and the one with the most surprises. Read §4.2 before
you start typing — the obvious `pip install` command **does not work** on this
project, and knowing why saves you an hour.

## 4.1 Get the code

```bash
sudo mkdir -p <APP_DIR>
sudo chown <APP_USER>:<APP_USER> <APP_DIR>

sudo -u <APP_USER> git clone git@github.com:HABTec/moh-superset.git <APP_DIR>
cd <APP_DIR>
sudo -u <APP_USER> git log --oneline -1
```

If you are matching an existing instance, check out the exact same commit:

```bash
# on the existing instance
cd <EXISTING_APP_DIR> && git rev-parse HEAD

# on the new one
cd <APP_DIR> && sudo -u <APP_USER> git checkout <THAT_COMMIT_SHA>
```

Matching commits matters for more than tidiness — §4.3 lets you skip a
40-minute frontend build if and only if the commits are identical.

## 4.2 The Python environment

### Superset is not installed as a package — this is the key fact

Normally you would `pip install apache-superset`. **This deployment does not.**
Instead, Superset is imported directly from the checkout: gunicorn and Celery
both put their working directory at the front of `sys.path`, so
`import superset` finds `<APP_DIR>/superset/`.

Two consequences you will run into:

1. The `WorkingDirectory=` line in each systemd unit is what decides which copy
   of the code that service runs. It is the most important line in those files.
2. There is no `superset` command in the virtualenv, because `pip` never
   created one. §4.4 shows how to add it back.

Only one package gets properly installed: `apache-superset-core`, from the
`superset-core/` subdirectory of the checkout.

### Create the virtualenv

```bash
cd <APP_DIR>
sudo -u <APP_USER> python3.12 -m venv .venv
sudo -u <APP_USER> ./.venv/bin/pip install --upgrade pip setuptools wheel
```

### Install the dependencies

> **Warning**
> The command the repository's own `requirements/moh.txt` header suggests —
> `pip install -e ".[postgres,clickhouse]"` — **fails** on this project:
>
> ```
> ERROR: Cannot install apache-superset[clickhouse,postgres]==0.0.0.dev0 and apache_superset
> because these package versions have conflicting dependencies.
>   apache-superset      depends on sqlglot<31 and >=30.8.0
>   apache-superset-core depends on sqlglot<29  and >=28.10.0
> ERROR: ResolutionImpossible
> ```
>
> The two halves of the project disagree about `sqlglot`. There is no version
> satisfying both, so pip gives up. The working instances resolve this by
> installing `apache-superset-core` **without dependency resolution** and
> letting the rest of the requirements decide the `sqlglot` version (30.8.0).

**If you are replicating an existing instance — do this.** It reproduces its
package set exactly, which is the whole point of a replica:

```bash
# On the EXISTING instance: capture its exact package versions.
# The grep drops the editable install; you install that separately below.
<EXISTING_APP_DIR>/.venv/bin/pip freeze | grep -v '^-e ' > /tmp/reference-freeze.txt
wc -l /tmp/reference-freeze.txt        # expect a couple of hundred lines

# On the NEW instance:
cd <APP_DIR>
sudo -u <APP_USER> ./.venv/bin/pip install -r /tmp/reference-freeze.txt
sudo -u <APP_USER> ./.venv/bin/pip install -e ./superset-core --no-deps
```

**If there is no existing instance to copy from**, install from the repository's
requirements files and accept that you are picking versions the project has not
necessarily been run with:

```bash
cd <APP_DIR>
sudo -u <APP_USER> ./.venv/bin/pip install -r requirements/base.txt
sudo -u <APP_USER> ./.venv/bin/pip install -r requirements/moh.txt
sudo -u <APP_USER> ./.venv/bin/pip install -e ./superset-core --no-deps
```

`--no-deps` says "install this package, but do not touch anything it says it
depends on". That is exactly what sidesteps the `sqlglot` conflict.

This step takes 10–30 minutes. Several packages compile C code.

### Verify the environment

```bash
cd <APP_DIR>
./.venv/bin/pip list | grep -i superset
```

Expect `apache-superset-core` with a path pointing at
`<APP_DIR>/superset-core` — that path is what "editable install" means.
`apache-superset` itself should **not** be listed. That is correct.

If you replicated an existing instance, prove the package sets match:

```bash
<EXISTING_APP_DIR>/.venv/bin/pip freeze | grep -v '^-e ' | sort > /tmp/a.txt
<APP_DIR>/.venv/bin/pip freeze          | grep -v '^-e ' | sort > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt
```

An empty diff, or a single extra line for `wheel`, is what you want.

## 4.3 Frontend assets

Superset's UI is a compiled JavaScript application, about 99 MB across roughly
a thousand files, in `<APP_DIR>/superset/static/assets/`. That directory is
**not** in git. If it is missing, the site loads but renders a blank page.

Check:

```bash
ls <APP_DIR>/superset/static/assets/ 2>/dev/null | head
```

### Option A — copy from an instance on the same commit (about a minute)

Only valid if the two checkouts are on the **exact same commit**. Compiled
assets correspond to a specific source tree; copying them across different
commits gives you a UI that does not match the backend, which fails in ways
that are very hard to debug.

```bash
# Prove the commits match FIRST. Do not skip this.
cd <EXISTING_APP_DIR> && git rev-parse HEAD
cd <APP_DIR>          && git rev-parse HEAD
# The two SHAs must be identical.

sudo -u <APP_USER> rsync -a \
  <EXISTING_APP_DIR>/superset/static/assets/ \
  <APP_DIR>/superset/static/assets/

du -sh <APP_DIR>/superset/static/assets      # expect ~99M
```

### Option B — build from source (20–40 minutes)

> **Warning**
> If you took Option A, `node_modules` was **never installed** in this checkout —
> copying the compiled assets does not install the toolchain that produced them.
> `npm run build` then fails immediately with:
>
> ```
> sh: 1: cross-env: not found
> ```
>
> `cross-env` is a devDependency, so the message means "dependencies are
> missing", not "cross-env is broken". Run `npm ci` first.

**1. Use the Node version the project pins.** `superset-frontend/.nvmrc` and the
`engines` block in `package.json` both pin it, and they are frequently *not*
what the system provides:

```bash
cat superset-frontend/.nvmrc                       # e.g. v22.22.0
node --version                                     # e.g. v23.10.0  <- mismatch
python3 -c "import json;print(json.load(open('superset-frontend/package.json'))['engines'])"
```

Do not upgrade or replace the system Node on a shared server — other services
depend on it. Install the pinned version alongside it:

```bash
V=22.22.0
cd /opt
sudo curl -fsSL -o node.tar.xz \
  "https://nodejs.org/dist/v$V/node-v$V-linux-x64.tar.xz"
sudo tar -xJf node.tar.xz && sudo rm node.tar.xz
/opt/node-v$V-linux-x64/bin/node --version         # confirm
```

Then wrap it, so nobody has to remember the PATH:

```bash
sudo tee /usr/local/bin/<INSTANCE>-frontend > /dev/null <<'EOF2'
#!/bin/bash
# npm for the Superset frontend, on the Node version the project pins.
# The system Node is deliberately left alone; other services use it.
export PATH=/opt/node-v22.22.0-linux-x64/bin:$PATH
export NODE_OPTIONS=--max_old_space_size=8192
cd <APP_DIR>/superset-frontend || exit 1
exec npm "$@"
EOF2
sudo chmod 0755 /usr/local/bin/<INSTANCE>-frontend
```

**2. Back up the assets before building.** `npm run build` writes straight into
`superset/static/assets/`, which is the directory nginx serves. A failed or
interrupted build leaves the live site with a half-written asset tree:

```bash
sudo cp -a <APP_DIR>/superset/static/assets \
          /var/backups/<INSTANCE>/assets-before-build-$(date +%F-%H%M%S)
```

**3. Install and build.**

```bash
sudo -u <APP_USER> <INSTANCE>-frontend ci        # ~2 GB, 1700 packages, 10-20 min
sudo -u <APP_USER> <INSTANCE>-frontend run build # webpack, a few minutes
```

Expect `webpack <version> compiled with N warnings`. Warnings are normal;
`ERROR` or `Module build failed` is not.

**4. Restart and verify.** Superset reads the webpack manifest at boot, and a
rebuild changes every content hash:

```bash
sudo systemctl restart <INSTANCE>
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMAIN>/login/
```

Then open the site and confirm it renders. If it does not, restore the backup
from step 2 and restart — that is what it is for.

> **Note**
> `/static/assets/pwa-manifest.js` returns 404 on this codebase. It is
> referenced by a template but never emitted by the build, and it 404s on the
> production instance too — so it is not evidence that your build went wrong.
> Check a hashed bundle instead, e.g.
> `curl -o /dev/null -w '%{http_code}' https://<DOMAIN>/static/assets/menu.<hash>.entry.js`.

> **Note**
> The build needs a lot of memory and is routinely killed by the kernel on small
> servers. If it dies without a clear error, check `dmesg | tail` for
> `Out of memory`. `NODE_OPTIONS=--max_old_space_size=8192` (set by the wrapper
> above) is what the build script itself expects.

## 4.4 Restore the `superset` command

Because Superset was never `pip install`ed, the CLI you see in every Superset
tutorial does not exist in your virtualenv. `setup.py` declares it as
`superset = superset.cli.main:superset`, so you can recreate exactly what pip
would have generated:

```bash
sudo -u <APP_USER> tee <APP_DIR>/.venv/bin/superset > /dev/null <<'EOF2'
#!<APP_DIR>/.venv/bin/python
import re
import sys
from superset.cli.main import superset

if __name__ == "__main__":
    sys.argv[0] = re.sub(r"(-script\.pyw|\.exe)?$", "", sys.argv[0])
    sys.exit(superset())
EOF2

# Substitute the real path into the shebang, then make it executable
sudo sed -i "s|<APP_DIR>|$(realpath <APP_DIR>)|" <APP_DIR>/.venv/bin/superset
sudo chmod 0755 <APP_DIR>/.venv/bin/superset
sudo chown <APP_USER>:<APP_USER> <APP_DIR>/.venv/bin/superset
```

### A wrapper so you never run it against the wrong instance

Running the Superset CLI needs three things set correctly every single time:
the environment file loaded, the working directory correct, and `PYTHONPATH`
pointing at the checkout. Getting any of them wrong on a multi-instance server
means running a migration against the wrong database. Write it down once:

```bash
sudo tee /usr/local/bin/<INSTANCE>-cli > /dev/null <<'EOF2'
#!/bin/bash
# Run a Superset CLI command against this instance.
#
# PYTHONPATH is needed here but NOT in the systemd units: gunicorn and celery
# insert the working directory into sys.path themselves, whereas a plain
# console script only gets its own bin/ directory on the path.
set -a
. <ENV_FILE>
set +a
cd <APP_DIR> || exit 1
export PYTHONPATH=<APP_DIR>${PYTHONPATH:+:$PYTHONPATH}
exec ./.venv/bin/superset "$@"
EOF2

sudo sed -i 's|<ENV_FILE>|/etc/<INSTANCE>/superset.env|; s|<APP_DIR>|/your/app/dir|g' \
  /usr/local/bin/<INSTANCE>-cli
sudo chmod 0755 /usr/local/bin/<INSTANCE>-cli
```

You cannot test it until the environment file exists — that is the next page.

> **Note**
> If you skip `PYTHONPATH` you get
> `ModuleNotFoundError: No module named 'superset'`, which is confusing because
> you *are* in the right directory. A console script puts its own `bin/`
> directory on `sys.path`, not your shell's working directory.

---

[← Redis](03-redis.md) · [Index](README.md) · [Next: Configuration →](05-configuration.md)
