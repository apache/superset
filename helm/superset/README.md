# superset

![Version: 0.7.5](https://img.shields.io/badge/Version-0.7.5-informational?style=flat-square)

Apache Superset is a modern, enterprise-ready business intelligence web application

## TL;DR;

```console
helm repo add superset http://apache.github.io/superset/
helm install my-superset superset/superset
```

## Requirements

| Repository | Name | Version |
|------------|------|---------|
| https://charts.bitnami.com/bitnami | postgresql | 11.1.22 |
| https://charts.bitnami.com/bitnami | redis | 16.3.1 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` |  |
| bootstrapScript | string | see `values.yaml` | Install additional packages and do any other bootstrap configuration in this script For production clusters it's recommended to build own image with this step done in CI |
| configFromSecret | string | `"{{ template \"superset.fullname\" . }}-config"` | The name of the secret which we will use to generate a superset_config.py file Note: this secret must have the key superset_config.py in it and can include other files as well |
| configMountPath | string | `"/app/pythonpath"` |  |
| configOverrides | object | `{}` | A dictionary of overrides to append at the end of superset_config.py - the name does not matter WARNING: the order is not guaranteed Files can be passed as helm --set-file configOverrides.my-override=my-file.py |
| configOverridesFiles | object | `{}` | Same as above but the values are files |
| envFromSecret | string | `"{{ template \"superset.fullname\" . }}-env"` | The name of the secret which we will use to populate env vars in deployed pods This can be useful for secret keys, etc. |
| envFromSecrets | list | `[]` | This can be a list of templated strings |
| extraConfigMountPath | string | `"/app/configs"` |  |
| extraConfigs | object | `{}` | Extra files to mount on `/app/pythonpath` |
| extraEnv | object | `{}` | Extra environment variables that will be passed into pods |
| extraEnvRaw | list | `[]` | Extra environment variables in RAW format that will be passed into pods |
| extraSecretEnv | object | `{}` | Extra environment variables to pass as secrets |
| extraSecrets | object | `{}` | Extra files to mount on `/app/pythonpath` as secrets |
| extraVolumeMounts | list | `[]` |  |
| extraVolumes | list | `[]` |  |
| hostAliases | list | `[]` | Custom hostAliases for all superset pods # https://kubernetes.io/docs/tasks/network/customize-hosts-file-for-pods/ |
| image.pullPolicy | string | `"IfNotPresent"` |  |
| image.repository | string | `"apache/superset"` |  |
| image.tag | string | `"latest"` |  |
| imagePullSecrets | list | `[]` |  |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0] | string | `"chart-example.local"` |  |
| ingress.path | string | `"/"` |  |
| ingress.pathType | string | `"ImplementationSpecific"` |  |
| ingress.tls | list | `[]` |  |
| init.adminUser.email | string | `"admin@superset.com"` |  |
| init.adminUser.firstname | string | `"Superset"` |  |
| init.adminUser.lastname | string | `"Admin"` |  |
| init.adminUser.password | string | `"admin"` |  |
| init.adminUser.username | string | `"admin"` |  |
| init.command | list | a `superset_init.sh` command | Command |
| init.containerSecurityContext | object | `{}` |  |
| init.createAdmin | bool | `true` |  |
| init.enabled | bool | `true` |  |
| init.initContainers | list | a container waiting for postgres | List of initContainers |
| init.initscript | string | a script to create admin user and initailize roles | A Superset init script |
| init.loadExamples | bool | `false` |  |
| init.podAnnotations | object | `{}` |  |
| init.podSecurityContext | object | `{}` |  |
| init.resources | object | `{}` |  |
| initImage.pullPolicy | string | `"IfNotPresent"` |  |
| initImage.repository | string | `"busybox"` |  |
| initImage.tag | string | `"latest"` |  |
| nodeSelector | object | `{}` |  |
| postgresql | object | see `values.yaml` | Configuration values for the postgresql dependency. ref: https://github.com/kubernetes/charts/blob/master/stable/postgresql/README.md |
| redis | object | see `values.yaml` | Configuration values for the Redis dependency. ref: https://github.com/bitnami/charts/blob/master/bitnami/redis More documentation can be found here: https://artifacthub.io/packages/helm/bitnami/redis |
| resources | object | `{}` |  |
| runAsUser | int | `0` | User ID directive. This user must have enough permissions to run the bootstrap script Running containers as root is not recommended in production. Change this to another UID - e.g. 1000 to be more secure |
| service.annotations | object | `{}` |  |
| service.loadBalancerIP | string | `nil` |  |
| service.port | int | `8088` |  |
| service.type | string | `"ClusterIP"` |  |
| serviceAccount.annotations | object | `{}` |  |
| serviceAccount.create | bool | `false` | Create custom service account for Superset. If create: true and name is not provided, `superset.fullname` will be used. |
| supersetCeleryBeat.command | list | a port wait command | Command |
| supersetCeleryBeat.containerSecurityContext | object | `{}` |  |
| supersetCeleryBeat.deploymentAnnotations | object | `{}` | Annotations to be added to supersetCeleryBeat deployment |
| supersetCeleryBeat.enabled | bool | `false` | This is only required if you intend to use alerts and reports |
| supersetCeleryBeat.flower.command | list | a `celery flower` command | Command |
| supersetCeleryBeat.flower.enabled | bool | `false` | If true, will expose a web-based UI to monitor jobs WARNING: requires a Superset image that has `flower<1.0.0` installed (which is NOT the case of the default images) flower>=1.0.0 requires Celery 5+ which Superset does not support |
| supersetCeleryBeat.flower.livenessProbe.failureThreshold | int | `3` |  |
| supersetCeleryBeat.flower.livenessProbe.httpGet.path | string | `"/api/workers"` |  |
| supersetCeleryBeat.flower.livenessProbe.httpGet.port | string | `"flower"` |  |
| supersetCeleryBeat.flower.livenessProbe.initialDelaySeconds | int | `5` |  |
| supersetCeleryBeat.flower.livenessProbe.periodSeconds | int | `5` |  |
| supersetCeleryBeat.flower.livenessProbe.successThreshold | int | `1` |  |
| supersetCeleryBeat.flower.livenessProbe.timeoutSeconds | int | `1` |  |
| supersetCeleryBeat.flower.readinessProbe.failureThreshold | int | `3` |  |
| supersetCeleryBeat.flower.readinessProbe.httpGet.path | string | `"/api/workers"` |  |
| supersetCeleryBeat.flower.readinessProbe.httpGet.port | string | `"flower"` |  |
| supersetCeleryBeat.flower.readinessProbe.initialDelaySeconds | int | `5` |  |
| supersetCeleryBeat.flower.readinessProbe.periodSeconds | int | `5` |  |
| supersetCeleryBeat.flower.readinessProbe.successThreshold | int | `1` |  |
| supersetCeleryBeat.flower.readinessProbe.timeoutSeconds | int | `1` |  |
| supersetCeleryBeat.flower.service.annotations | object | `{}` |  |
| supersetCeleryBeat.flower.service.port | int | `5555` |  |
| supersetCeleryBeat.flower.service.type | string | `"ClusterIP"` |  |
| supersetCeleryBeat.flower.startupProbe.failureThreshold | int | `60` |  |
| supersetCeleryBeat.flower.startupProbe.httpGet.path | string | `"/api/workers"` |  |
| supersetCeleryBeat.flower.startupProbe.httpGet.port | string | `"flower"` |  |
| supersetCeleryBeat.flower.startupProbe.initialDelaySeconds | int | `5` |  |
| supersetCeleryBeat.flower.startupProbe.periodSeconds | int | `5` |  |
| supersetCeleryBeat.flower.startupProbe.successThreshold | int | `1` |  |
| supersetCeleryBeat.flower.startupProbe.timeoutSeconds | int | `1` |  |
| supersetCeleryBeat.forceReload | bool | `false` | If true, forces deployment to reload on each upgrade |
| supersetCeleryBeat.initContainers | list | a container waiting for postgres | List of init containers |
| supersetCeleryBeat.podAnnotations | object | `{}` | Annotations to be added to supersetCeleryBeat pods |
| supersetCeleryBeat.podLabels | object | `{}` | Labels to be added to supersetCeleryBeat pods |
| supersetCeleryBeat.podSecurityContext | object | `{}` |  |
| supersetCeleryBeat.resources | object | `{}` | Resource settings for the CeleryBeat pods - these settings overwrite might existing values from the global resources object defined above. |
| supersetNode.command | list | See `values.yaml` | Startup command |
| supersetNode.connections.db_host | string | `"{{ template \"superset.fullname\" . }}-postgresql"` |  |
| supersetNode.connections.db_name | string | `"superset"` |  |
| supersetNode.connections.db_pass | string | `"superset"` |  |
| supersetNode.connections.db_port | string | `"5432"` |  |
| supersetNode.connections.db_user | string | `"superset"` |  |
| supersetNode.connections.redis_host | string | `"{{ template \"superset.fullname\" . }}-redis-headless"` | Change in case of bringing your own redis and then also set redis.enabled:false |
| supersetNode.connections.redis_port | string | `"6379"` |  |
| supersetNode.containerSecurityContext | object | `{}` |  |
| supersetNode.deploymentAnnotations | object | `{}` | Annotations to be added to supersetNode deployment |
| supersetNode.env | object | `{}` |  |
| supersetNode.forceReload | bool | `false` | If true, forces deployment to reload on each upgrade |
| supersetNode.initContainers | list | a container waiting for postgres to be up | Init containers |
| supersetNode.livenessProbe.failureThreshold | int | `3` |  |
| supersetNode.livenessProbe.httpGet.path | string | `"/health"` |  |
| supersetNode.livenessProbe.httpGet.port | string | `"http"` |  |
| supersetNode.livenessProbe.initialDelaySeconds | int | `15` |  |
| supersetNode.livenessProbe.periodSeconds | int | `15` |  |
| supersetNode.livenessProbe.successThreshold | int | `1` |  |
| supersetNode.livenessProbe.timeoutSeconds | int | `1` |  |
| supersetNode.podAnnotations | object | `{}` | Annotations to be added to supersetNode pods |
| supersetNode.podLabels | object | `{}` | Labels to be added to supersetNode pods |
| supersetNode.podSecurityContext | object | `{}` |  |
| supersetNode.readinessProbe.failureThreshold | int | `3` |  |
| supersetNode.readinessProbe.httpGet.path | string | `"/health"` |  |
| supersetNode.readinessProbe.httpGet.port | string | `"http"` |  |
| supersetNode.readinessProbe.initialDelaySeconds | int | `15` |  |
| supersetNode.readinessProbe.periodSeconds | int | `15` |  |
| supersetNode.readinessProbe.successThreshold | int | `1` |  |
| supersetNode.readinessProbe.timeoutSeconds | int | `1` |  |
| supersetNode.replicaCount | int | `1` |  |
| supersetNode.resources | object | `{}` | Resource settings for the supersetNode pods - these settings overwrite might existing values from the global resources object defined above. |
| supersetNode.startupProbe.failureThreshold | int | `60` |  |
| supersetNode.startupProbe.httpGet.path | string | `"/health"` |  |
| supersetNode.startupProbe.httpGet.port | string | `"http"` |  |
| supersetNode.startupProbe.initialDelaySeconds | int | `15` |  |
| supersetNode.startupProbe.periodSeconds | int | `5` |  |
| supersetNode.startupProbe.successThreshold | int | `1` |  |
| supersetNode.startupProbe.timeoutSeconds | int | `1` |  |
| supersetNode.strategy | object | `{}` |  |
| supersetWebsockets.command | list | `[]` |  |
| supersetWebsockets.config | object | see `values.yaml` | The config.json to pass to the server, see https://github.com/apache/superset/tree/master/superset-websocket Note that the configuration can also read from environment variables (which will have priority), see https://github.com/apache/superset/blob/master/superset-websocket/src/config.ts for a list of supported variables |
| supersetWebsockets.containerSecurityContext | object | `{}` |  |
| supersetWebsockets.deploymentAnnotations | object | `{}` |  |
| supersetWebsockets.enabled | bool | `false` | This is only required if you intend to use `GLOBAL_ASYNC_QUERIES` in `ws` mode see https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries |
| supersetWebsockets.image.pullPolicy | string | `"IfNotPresent"` |  |
| supersetWebsockets.image.repository | string | `"immobisolusiprima/superset-websocket"` | There is no official image (yet), this one is community-supported |
| supersetWebsockets.image.tag | string | `"latest"` |  |
| supersetWebsockets.ingress.path | string | `"/ws"` |  |
| supersetWebsockets.ingress.pathType | string | `"Prefix"` |  |
| supersetWebsockets.livenessProbe.failureThreshold | int | `3` |  |
| supersetWebsockets.livenessProbe.httpGet.path | string | `"/health"` |  |
| supersetWebsockets.livenessProbe.httpGet.port | string | `"ws"` |  |
| supersetWebsockets.livenessProbe.initialDelaySeconds | int | `5` |  |
| supersetWebsockets.livenessProbe.periodSeconds | int | `5` |  |
| supersetWebsockets.livenessProbe.successThreshold | int | `1` |  |
| supersetWebsockets.livenessProbe.timeoutSeconds | int | `1` |  |
| supersetWebsockets.podAnnotations | object | `{}` |  |
| supersetWebsockets.podLabels | object | `{}` |  |
| supersetWebsockets.podSecurityContext | object | `{}` |  |
| supersetWebsockets.readinessProbe.failureThreshold | int | `3` |  |
| supersetWebsockets.readinessProbe.httpGet.path | string | `"/health"` |  |
| supersetWebsockets.readinessProbe.httpGet.port | string | `"ws"` |  |
| supersetWebsockets.readinessProbe.initialDelaySeconds | int | `5` |  |
| supersetWebsockets.readinessProbe.periodSeconds | int | `5` |  |
| supersetWebsockets.readinessProbe.successThreshold | int | `1` |  |
| supersetWebsockets.readinessProbe.timeoutSeconds | int | `1` |  |
| supersetWebsockets.replicaCount | int | `1` |  |
| supersetWebsockets.resources | object | `{}` |  |
| supersetWebsockets.service.annotations | object | `{}` |  |
| supersetWebsockets.service.port | int | `8080` |  |
| supersetWebsockets.service.type | string | `"ClusterIP"` |  |
| supersetWebsockets.startupProbe.failureThreshold | int | `60` |  |
| supersetWebsockets.startupProbe.httpGet.path | string | `"/health"` |  |
| supersetWebsockets.startupProbe.httpGet.port | string | `"ws"` |  |
| supersetWebsockets.startupProbe.initialDelaySeconds | int | `5` |  |
| supersetWebsockets.startupProbe.periodSeconds | int | `5` |  |
| supersetWebsockets.startupProbe.successThreshold | int | `1` |  |
| supersetWebsockets.startupProbe.timeoutSeconds | int | `1` |  |
| supersetWebsockets.strategy | object | `{}` |  |
| supersetWorker.command | list | a `celery worker` command | Worker startup command |
| supersetWorker.containerSecurityContext | object | `{}` |  |
| supersetWorker.deploymentAnnotations | object | `{}` | Annotations to be added to supersetWorker deployment |
| supersetWorker.forceReload | bool | `false` | If true, forces deployment to reload on each upgrade |
| supersetWorker.initContainers | list | a container waiting for postgres | Init container |
| supersetWorker.livenessProbe.exec.command | list | a `celery inspect ping` command | Liveness probe command |
| supersetWorker.livenessProbe.failureThreshold | int | `3` |  |
| supersetWorker.livenessProbe.initialDelaySeconds | int | `120` |  |
| supersetWorker.livenessProbe.periodSeconds | int | `60` |  |
| supersetWorker.livenessProbe.successThreshold | int | `1` |  |
| supersetWorker.livenessProbe.timeoutSeconds | int | `60` |  |
| supersetWorker.podAnnotations | object | `{}` | Annotations to be added to supersetWorker pods |
| supersetWorker.podLabels | object | `{}` | Labels to be added to supersetWorker pods |
| supersetWorker.podSecurityContext | object | `{}` |  |
| supersetWorker.readinessProbe | object | `{}` | No startup/readiness probes by default since we don't really care about its startup time (it doesn't serve traffic) |
| supersetWorker.replicaCount | int | `1` |  |
| supersetWorker.resources | object | `{}` | Resource settings for the supersetWorker pods - these settings overwrite might existing values from the global resources object defined above. |
| supersetWorker.startupProbe | object | `{}` | No startup/readiness probes by default since we don't really care about its startup time (it doesn't serve traffic) |
| supersetWorker.strategy | object | `{}` |  |
| tolerations | list | `[]` |  |
