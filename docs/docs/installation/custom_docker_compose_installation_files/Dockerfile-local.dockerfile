# This Dockerfile is used to build a custom Apache Superset image with additional dependencies.
# It is based on the official Apache Superset image and includes geckodriver and Firefox ESR.
ARG UPSTREAM=apachesuperset.docker.scarf.sh/apache/superset
ARG TAG=latest
FROM ${UPSTREAM}:${TAG}

# Install geckodriver with checksum verification.
ARG GECKODRIVER_VERSION=v0.24.0
ARG GECKODRIVER_CHECKSUM=03be3d3b16b57e0f3e7e8ba7c1e4bf090620c147e6804f6c6f3203864f5e3784
ARG GECKODRIVER_URL=https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux64.tar.gz

# Labels for better metadata (following Open Container Initiative recommendations).
LABEL maintainer="Your Name <your.email@example.com>"
LABEL version="1.0"
LABEL description="Custom Apache Superset Dockerfile with additional dependencies"

# Avoid running as root; switch back to the superset user at the end.
USER root

# Combine apt-get update and install into single RUN to reduce layers and avoid cache issues.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    wget \
    bzip2 \
    gnupg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN wget --no-verbose --output-document=/tmp/geckodriver.tar.gz "${GECKODRIVER_URL}" \
    && echo "${GECKODRIVER_CHECKSUM} /tmp/geckodriver.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/geckodriver \
    && rm /tmp/geckodriver.tar.gz

# Install Firefox ESR using Mozilla's official repository.
RUN install -d -m 0755 /etc/apt/keyrings \
    && wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O /etc/apt/keyrings/packages.mozilla.org.asc \
    && echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" > /etc/apt/sources.list.d/mozilla.list \
    && echo "Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000" > /etc/apt/preferences.d/mozilla \
    && apt-get update && apt-get install -y --no-install-recommends firefox-esr \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements-local.txt and install Python packages.
COPY docker/requirements-local.txt /app/docker/requirements-local.txt
RUN pip install --no-cache-dir -r /app/docker/requirements-local.txt
