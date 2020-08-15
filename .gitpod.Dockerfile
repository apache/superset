# Install custom tools, runtimes, etc.
# For example "bastet", a command-line tetris clone:
# RUN brew install bastet
#
# More information: https://www.gitpod.io/docs/config-docker/
FROM gitpod/workspace-postgres

RUN sudo apt-get update && \
    sudo apt-get install -y redis-server && \
    sudo rm -rf sudo rm -rf /var/lib/apt/lists/*


FROM gitpod/workspace-full:latest
RUN sudo apt-get install build-essential libssl-dev libffi-dev python3.6-dev python-pip libsasl2-dev libldap2-dev
RUN pip install --upgrade setuptools pip && \
    pip install apache-superset && \
    superset db upgrade && \
    export FLASK_APP=superset && \
    superset fab create-admin && \
    superset load_examples && \
    superset init 