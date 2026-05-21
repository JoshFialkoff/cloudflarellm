const TRAEFIK_PUBLIC_HOSTS = Object.freeze([
  "assistedly.ai",
  "www.assistedly.ai",
  "agent1.assistedly.ai",
  "agent3.assistedly.ai",
]);

const PRODUCTION_SMOKE_URLS = Object.freeze(
  TRAEFIK_PUBLIC_HOSTS.map((host) => `https://${host}/`),
);

module.exports = {
  PRODUCTION_SMOKE_URLS,
  TRAEFIK_PUBLIC_HOSTS,
};
