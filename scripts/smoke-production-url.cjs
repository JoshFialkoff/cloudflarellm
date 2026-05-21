#!/usr/bin/env node
/**
 * HEAD/GET public URLs; fails on DNS errors or 5xx (e.g. Cloudflare 502 when Traefik upstream is wrong).
 * Uses Cloudflare DNS-over-HTTPS so edge checks do not depend on the runner's local resolver.
 * PRODUCTION_SMOKE_URLS — comma/newline-separated URL list
 * PRODUCTION_SMOKE_URL — single URL override
 */
const http = require("http");
const https = require("https");
const dns = require("dns").promises;
const { PRODUCTION_SMOKE_URLS } = require("./lib/public-hosts.cjs");

const DNS_ENDPOINTS = [
  { label: "cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  { label: "google", url: "https://dns.google/resolve" },
];
const REQUEST_TIMEOUT_MS = 25_000;
const REDIRECT_LIMIT = 5;

function getUrls() {
  const raw =
    process.env.PRODUCTION_SMOKE_URLS ||
    process.env.PRODUCTION_SMOKE_URL ||
    PRODUCTION_SMOKE_URLS.join(",");

  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function queryDns(endpoint, hostname, type) {
  const url = new URL(endpoint.url);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);

  let res;
  try {
    res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`${endpoint.label} DoH fetch failed: ${error.message}`);
  }

  if (!res.ok) {
    throw new Error(`${endpoint.label} DoH returned ${res.status}`);
  }

  const payload = await res.json();
  if (payload.Status !== 0 && payload.Status !== 3) {
    throw new Error(`${endpoint.label} DoH status ${payload.Status} for ${hostname}`);
  }

  return payload.Answer || [];
}

async function resolveHostname(hostname, endpoint, seen = new Set()) {
  if (seen.has(hostname)) {
    throw new Error(`CNAME loop while resolving ${hostname}`);
  }

  const nextSeen = new Set(seen);
  nextSeen.add(hostname);

  const [aAnswers, aaaaAnswers, cnameAnswers] = await Promise.all([
    queryDns(endpoint, hostname, "A"),
    queryDns(endpoint, hostname, "AAAA"),
    queryDns(endpoint, hostname, "CNAME"),
  ]);

  const addresses = [...aAnswers, ...aaaaAnswers]
    .filter((answer) => answer.type === 1 || answer.type === 28)
    .map((answer) => answer.data)
    .filter(Boolean);

  if (addresses.length) {
    const address = addresses[0];
    return {
      address,
      family: address.includes(":") ? 6 : 4,
      provider: endpoint.label,
    };
  }

  const cname = cnameAnswers.find((answer) => answer.type === 5)?.data?.replace(/\.$/, "");
  if (cname) {
    return resolveHostname(cname, endpoint, nextSeen);
  }

  throw new Error(`No public DNS answer for ${hostname} via ${endpoint.label}`);
}

async function resolveSystemHostname(hostname) {
  const answers = await dns.lookup(hostname, { all: true });
  const first = answers[0];
  if (!first) {
    throw new Error(`No system DNS answer for ${hostname}`);
  }

  return {
    address: first.address,
    family: first.family,
    provider: "system",
  };
}

async function resolvePublicAddress(hostname) {
  let lastError;
  for (const endpoint of DNS_ENDPOINTS) {
    try {
      return await resolveHostname(hostname, endpoint);
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await resolveSystemHostname(hostname);
  } catch (error) {
    throw lastError || error || new Error(`Unable to resolve ${hostname}`);
  }
}

function requestOnce(targetUrl, method, resolution) {
  const transport = targetUrl.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method,
        headers: {
          host: targetUrl.host,
          "user-agent": "assistedly-production-smoke/1.0",
        },
        servername: targetUrl.hostname,
        timeout: REQUEST_TIMEOUT_MS,
        lookup(hostname, _options, callback) {
          if (_options?.all) {
            callback(null, [{ address: resolution.address, family: resolution.family }]);
            return;
          }

          callback(null, resolution.address, resolution.family);
        },
      },
      (res) => {
        res.resume();
        resolve(res);
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

async function requestWithDns(targetUrl, method, redirectsRemaining = REDIRECT_LIMIT) {
  const resolution = await resolvePublicAddress(targetUrl.hostname);
  const res = await requestOnce(targetUrl, method, resolution);

  if (
    redirectsRemaining > 0 &&
    res.statusCode >= 300 &&
    res.statusCode < 400 &&
    res.headers.location
  ) {
    return requestWithDns(new URL(res.headers.location, targetUrl), method, redirectsRemaining - 1);
  }

  return { resolution, res };
}

function formatHeaderSummary(headers) {
  const summary = ["server", "cf-cache-status", "cf-ray", "location"]
    .map((name) => [name, headers[name]])
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`);

  return summary.length ? ` [${summary.join(" ")}]` : "";
}

async function smokeUrl(rawUrl) {
  const targetUrl = new URL(rawUrl);
  let result = await requestWithDns(targetUrl, "HEAD");

  if (result.res.statusCode === 405 || result.res.statusCode === 501) {
    result = await requestWithDns(targetUrl, "GET");
  }

  if (result.res.statusCode >= 500) {
    throw new Error(`${rawUrl} returned ${result.res.statusCode}`);
  }

  process.stdout.write(
    `Production smoke OK (${result.res.statusCode}) ${rawUrl} via ${result.resolution.provider}:${result.resolution.address}${formatHeaderSummary(result.res.headers)}\n`,
  );
}

async function run() {
  const failures = [];

  for (const url of getUrls()) {
    try {
      await smokeUrl(url);
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
}

run().catch((e) => {
  process.stderr.write(`Production smoke failed: ${e.message}\n`);
  process.exit(1);
});
