#!/usr/bin/env node
const base = Number.parseInt(process.env.PORT || "3010", 10) || 3010;
process.stdout.write(`http://localhost:${base}/\n`);
