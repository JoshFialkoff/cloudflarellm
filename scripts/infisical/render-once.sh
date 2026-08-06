#!/usr/bin/env bash
set -euo pipefail
infisical export --env=prod --format=dotenv > /opt/assistedly/.env.infisical-rendered
echo "Rendered to /opt/assistedly/.env.infisical-rendered"
echo "Now restart: docker compose -f compose.dify-host.yaml.infisical up -d --force-recreate"
