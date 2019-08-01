# This is a sub-readme for the Superconductive Health Fork

## Container Specifics for SCH

### Building the image and pushing
Execute the do-nothing script in the [The edw-stack repo](https://github.com/superconductive/edw-stack/blob/master/superset_scripts/build_docker_image.py)
to have a walkthrough of the various steps for building and pushing the image to teh aws container registry.

### Scripts we added/modified
#### `create-superset-admin.py`

This script pulls superset admin credentials from AWS Secrets Manager and invokes the the [Flask-AppBuilder](https://flask-appbuilder.readthedocs.io/en/latest/intro.html)
`create-admin` command, passing in the appropriate credentials.

#### `helpers.py`

This was a nice thought but this code is repeated in `superset_config.py` due to the file moving around for docker image
building requirements. If you can get imports to work, go for it.

#### `superset_config.py`

Something useful is that this uses terraform and Fargate secure environment variables to populate configs.
This is why all of that JSON Decoding hoop jumping is needed. It may or may not be better to try doing what `create-superset-admin.py`
is doing with teh invocation of the `boto3` library to get credentials (it is maybe only slightly less JSON decoding-weird).
The ECS instance already has a task role with appropriate permissions so it can invoke the api without need for further credentials. 

#### `docker-init.sh`

Some key things here:
* Removed the exporting of the `FLASK_APP` environment variable because it's not truly environment-wide. It's invocation specific.
* Removed the call to `flask fab create-admin` call and moved it to `create-superset-admin.py` as discussed above.
* And most importantly, added an invocation of `docker-entrypoin.sh`. This ensures that the container has a long running process so it doesn't
just kill when the init script is done. **_You can't have 2 entrypoint scripts, only 1 so they need to be combined or invoked in the single script._** 
(Using CMD could be an alternative if you know you don't always want to run `init` scripts but this seems to work well)

#### `Dockerfile`

* Copied over our new scripts
* No longer renaming `docker-entrypint.sh` 
* added `docker-init.sh` as the entrypoint rather than `docker-entrypoint.sh` (maybe those should be swapped. Semantics.) 
 