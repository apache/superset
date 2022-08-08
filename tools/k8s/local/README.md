docker build -t superset .
comment out `init-job.yaml` as changes won't need applying (if you need to apply changes set `deployment-superset.yaml` image to apache)
kubectl apply -f tools/k8s/local
kubectl port-forward <pod>  8088:8088

In mac M1 you will need to comment out `"sqloxide==0.1.15",`
