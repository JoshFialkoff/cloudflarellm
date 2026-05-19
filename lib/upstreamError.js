export function jsonUpstreamFailure({ status, attemptedUrl, mode, upstreamBody }) {
  const safeMode = mode === 'workflow' ? 'workflow' : 'chat'
  let hint =
    safeMode === 'workflow'
      ? 'Check DIFY_WORKFLOW_INPUT_KEY and workflow start variable names in Dify.'
      : 'Check DIFY_API_BASE_URL, DIFY_API_KEY, and app type in Dify.'

  if (Number(status) === 404) {
    hint = `Endpoint not found. Verify Dify base URL and API version path for ${safeMode}.`
  }

  return new Response(
    JSON.stringify(
      {
        error: `Upstream ${safeMode} request failed with HTTP ${status}.`,
        hint,
        attemptedUrl,
        upstream: String(upstreamBody || '').slice(0, 5000),
      },
      null,
      2
    ),
    {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  )
}
