ARG ASTRA_VER=registry.astralinux.ru/library/alse:1.7

FROM ${ASTRA_VER} AS astra-base

RUN apt update && \
    apt install -y build-essential \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libssl-dev \
    libreadline-dev \
    libffi-dev \
    libsqlite3-dev \
    wget \
    libbz2-dev

FROM astra-base AS python-astra

WORKDIR /python

RUN wget https://www.python.org/ftp/python/3.11.3/Python-3.11.3.tgz && tar -xvf Python-3.11.3.tgz

WORKDIR /python/Python-3.11.3

RUN ./configure --enable-optimizations

RUN make altinstall

RUN rm -f /python/Python-3.11.3.tgz

RUN ln -s /usr/local/bin/python3.11 /usr/bin/python && ln -s /usr/local/bin/pip3.11 /usr/bin/pip

WORKDIR /

# ENV PATH="/app/.venv/bin:${PATH}"

