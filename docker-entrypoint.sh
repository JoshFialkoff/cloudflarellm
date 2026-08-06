#!/bin/sh
set -e
cd /code
node scripts/ensure-next-build.js
exec "$@"
