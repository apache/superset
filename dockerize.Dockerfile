FROM alpine:latest

ARG DOCKERIZE_VERSION=v0.7.0

RUN apk update --no-cache \
    && apk add --no-cache wget openssl \
    && case "$(apk --print-arch)" in \
        x86_64) ARCH=amd64 ;; \
        aarch64) ARCH=arm64 ;; \
       esac \
    && wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz | tar xzf - -C /usr/local/bin \
    && apk del wget

USER 10001
