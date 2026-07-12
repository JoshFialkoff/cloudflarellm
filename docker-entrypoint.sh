#!/bin/sh
set -e
cd /code

# Ensure the .next/standalone directory exists and contains server.js
if [ ! -d ".next/standalone" ]; then
  echo "Standalone directory not found, running Next.js build..."
  npm run build
fi

# Check if server.js exists in the standalone directory
if [ -f ".next/standalone/server.js" ]; then
  echo "Starting Next.js standalone server..."
  exec node .next/standalone/server.js
else
  echo "Standalone server.js not found, falling back to next start..."
  # Fallback to next start if standalone server is not available
  exec npm run start
fi
