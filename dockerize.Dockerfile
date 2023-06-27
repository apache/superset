FROM alpine:latest

ARG DOCKERIZE_VERSION=v0.6.1

RUN apk update --no-cache \
    && apk upgrade --no-cache \
    && apk add --no-cache wget openssl \
    && wget -O - wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin \
    && apk del wget

USER 10001

ENTRYPOINT ["dockerize"]
CMD ["--help"]