FROM node:24-trixie-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl git python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
CMD ["sleep", "infinity"]
