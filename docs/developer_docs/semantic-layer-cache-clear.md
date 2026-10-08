---
title: Semantic layer cache invalidation
sidebar_position: 21
---

# Save configuration and reload metadata

Saving a semantic layer's configuration increments its metadata database
`cache_version` in the same transaction, including when the configuration is
unchanged. Description-only updates leave the version unchanged. Failed saves
roll back both configuration and version. `configuration_version` continues to
identify the configuration format, independently of cache invalidation.

For upstream-only changes, open the saved layer's configuration editor and select
**Reload metadata**. Unsaved edits must be saved or discarded first. The action
clears the host cache generation, shows **Cache cleared; reload to fetch metadata**,
and closes the editor. Reload the affected Explore or dashboard tab to fetch
metadata, using the browser's existing unsaved-change guards. Save retains its
ordinary close-and-refresh behavior; reload the affected tab afterward too.

`POST /api/v1/semantic_layer/<uuid>/clear_cache` accepts only `{}`. It requires
`can_write` on `SemanticLayer`, access to that layer, and connection modification
authority (`current_user_can_modify_object`). Guests and view-edit-only users
cannot clear a connection. Success means the database increment committed; it
performs no provider discovery and does not assert upstream health. A subsequent
read failure is separate from a successful Save or clear.

## Provider SDK contract

Providers may override this optional factory, invoked before eager discovery:

```python
@classmethod
def from_configuration_with_cache_token(
    cls, configuration: dict[str, Any], *, cache_token: str
) -> SemanticLayer:
    ...
```

The default delegates to `from_configuration(configuration)`, preserving legacy
providers. The host captures a database/workspace-scoped layer UUID and version
once per metadata session (the ordinary request/task session). The namespace is
an opaque digest of the metadata database backend, host, port and database name;
credentials, driver adapters, connection query options and `SECRET_KEY` do not
affect it. `SEMANTIC_LAYER_CACHE_NAMESPACE`, when nonempty, replaces that database
identity with an operator-provided, globally unique workspace name. Configure it
when routing through different database host aliases or sharing a database across
tenants. A callable may return the active workspace, but web, Celery and MCP
contexts must resolve the same value for the same workspace. The host captures it
once per session. No URL or credential is exposed in the token.

The MetricFlow and Snowflake shell implementations must include the supplied
token alongside existing endpoint, credential, role and view scope **before**
any dictionary lookup or eager discovery. Their returned SDK views carry the
same captured identity through `metadata_cache_token`; never relabel previously
cached members with a later token. Runtime schema helpers receiving the layer's
configuration must preserve its operation identity too. Keep existing expiries
and prune retired dictionary generations to bound memory. Cube should carry the
token onward; this mechanism does not clear Cube or warehouse server caches.
Until a provider honours this hook in its caches, it cannot promise complete
metadata reload support. The shell implementation is a separate dependency.

Host result, annotation-source, compatibility and value-suggestion cache keys
include the captured generation while preserving their other key dimensions.
Containment caches must likewise key on the **host ORM view**
`metadata_cache_token`, optionally alongside the provider token. A legacy SDK
view may return `None`; that must not disable host invalidation. Provider tokens
keep their existing `str | None` contract. The containment integration is owned
by the separate containment-cache change.

Old entries expire normally. A page reload clears browser structure promises and
rehydrates Explore state. Reload does not create/delete saved views, widen
allow-lists, rewrite chart selections, or automatically execute charts. Removed
members produce ordinary validation errors.

An in-flight fetch during a clear can repopulate a stale entry; clear again if
necessary. Captured keys normally keep that entry under its old version. There
is no coordinated publication, fencing, polling, revalidation or guarantee that
all workers observe an identical upstream catalog. Responses already in flight
are not recalled.
