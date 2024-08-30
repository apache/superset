# Setting up GCP cluster

## Doc references
- Deploy to GCP using Helm: https://docs.onosproject.org/onos-docs/docs/content/developers/deploy_on_gcp/
- Configuring Superset: https://superset.apache.org/docs/configuration/configuring-superset
- Superset & Kubernetes Architecture: https://2cloud.io/blog/apache-superset-deployment-in-kubernetes-gcp-architecture-and-features
- Using Managed Certificates: https://cloud.google.com/kubernetes-engine/docs/how-to/managed-certs#console
- Setting up OAuth (GCP part): https://guides.mangoapps.com/integration-guide/single-sign-on/integration-with-google-enterprise-using-oauth-2.0

## Staging playground

### 1. Setting up the cluster

Create cluster
```
gcloud container clusters create {cluster-name} --subnetwork default --num-nodes 2 --region=us-west1
```

Install Kubectl Auth plugin
```
gcloud components install gke-gcloud-auth-plugin
```
- Source (https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke)

Fetch credentials of the cluster into `kubeconfig`
```
gcloud container clusters get-credentials {cluster-name} --region=us-west1
```
- The command above should be done to re-authenticate in case you get an error like:
```
[...] the server has asked for the client to provide credentials [...]
```

Authenticate (will popup a browser for your actual Google Account)
```
gcloud auth application-default login
```
- At this point, credentials will be saved in a local .json

Check the cluster status
```
kubectl cluster-info
```

### 2. Installing using Helm -- TODO: Clean up this section and reference the files

On the folder `{project-home}/helm/superset`:

Create a namespace:
```
kubectl create namespace superset4
```

Add the superset repository for helm visibility:
```
helm repo add superset http://apache.github.io/superset/
```

Make sure the file `wt-values.yaml` exists (pull it from 1Password Engineering vault)

Install from the helm chart
```
helm upgrade superset402app superset/superset --values wt-values.yaml --atomic --debug --namespace superset402
```
- Add `--install` when running if for the first time
- Where `superset4app` is the application name

Upgrade the cluster (re-install)
```
{see command above}
```

(Optional) To monitor the nodes during deployment
```
kubectl -n superset4 get pods -w
```

(Optional) List the charts installed
```
helm -n superset4 ls
```

### (Optional) Deleting a cluster

If a clean-up is needed
```
gcloud container clusters delete superset4-cluster --region us-west1
```

### Create a Kubernetes Ingress

In the Kubernetes Cluster page, select the app created
Click to create Ingress:
    - (Optional) Create/Upload a SSL certificate for the domain that will be used
    - Edit the load balancer (created with the Ingress) to use the proper SSL certificate
    - Update the backend service (created with the Ingress) to enable HTTPS

### Enanble SSL

*This step can be done through GCP UI when setting up the Ingress and the front-end service*

Create a certificate (if Google managed, use the file `managed-cert.yaml` on the `helm` folder) by doing:
```
kubectl apply -f managed-cert.yaml
```

Once the certificate is ready update the cluster manifest by adding a metadata:
```
networking.gke.io/managed-certificates: {certificate-name}
```

To verify if a certificate is ready use:
```
kubectl describe managedcertificate {certificate-name}
```

Point any specific record to the cluster IP. You can get it from:
```
kubectl get ingress --namespace={namespace-name}
```

### To connect (SSH) into the pods

Get the list of pods of the cluster
```
kubectl get pods
```

See the logs of a pod:
```
kubectl logs -f `{pod-name}` --namespace superset4
```

Connect via bash:
```
kubectl exec -it {pod-name} --namespace=tools -- bash
```

Where `{pod-name}` is from the previous step. To verify installation of components, use the back-end pod.

### Enable BigQuery Support

From the `{project-home}` folder:

Create a local requirements to be used on Docker installation:
```
echo "sqlalchemy-bigquery" >> ./docker/requirements-local.txt
```

Re-deploy the cluster:
```
helm upgrade superset4app superset/superset --recreate-pods --wait --atomic --debug --namespace superset4 --set-file configOverrides.secret=secrets.py

helm upgrade superset4app superset/superset --values values.yaml --set-file configOverrides.secret=secrets.py
```

### Upgrading (through helm)
1. Checkout the right tag from the community project
```
git checkout tags/{version} -b {local_branch_for_that_version}
```

2. Open the helm folder
```
cd helm
```

3. Update the dependencies on the superset folder so Charts.yaml is generated. This step will download the dependencies (redis and postgres) so the chart is complete
```
helm dependency update superset/
```

4. Now pack the folder using:
```
helm repo packahe superset/
```
This will create a tarball (`.tar.gz`) containing the chart definition and dependencies

5. Create a repository index on the current folder:
```
helm repo index .
```
This will create an `index.yaml` needed to locate the repository online

6. Upload all files on the current folder (`helm/`) to visible http address (another repo would work if you use `raw.githubusercontent.com` from github)

7. Add a local helm repository pointing to the online version you just uploaded:
```
helm repo add {app-name} 'https://raw.githubusercontent.com/{path_to_folder_uploaded}'
```
Important notes on this step:
- Keep the single quotes `'` on the URL above
- As githubusercontent is not public visible you may need to add:
```
... --username {your_github_username} --password {your_personal_token}
```

8. Now you can list your local repos and should be able to see the one you just added pointing to the right version:
```
helm search repo superset -l
```

9. If everything is good up to here you can now use your repository and run:
```
helm upgrade {your_app_name} {repository_name_just_added} --values ... --atomic ... --namespace ...
```

### Enable Goggle SSO

*IMPORTANT*: This only works if https is enabled and domain resolution is working as SSO won't redirect back to IPs or http addresses

1. Use the file stored in the engineering vault as it contains the proper configurations needed.

2. Create an OAuth application in GCP and replace the tokens if needed.

3. Configure the callback addresses (in GCP application) to the superset address you are deploying.

4. Re-deploy the cluster (steps above).

### Enable Celery + Celery Beat

1. Use the file stored in the engineering vault as it contains the proper configurations needed.

2. Re-deploy the cluster (steps above).