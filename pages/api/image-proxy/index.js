const WP_UPLOADS_BASE = "https://aiassistliving.com/wp-content/uploads";
const DEFAULT_MONTH_PATHS = ["2026/02", "2026/01"];

function asNonEmptyStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function splitFilename(filename) {
  const i = filename.lastIndexOf(".");
  if (i <= 0) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i) };
}

function ratioVariants(filename, ratio) {
  const { stem, ext } = splitFilename(filename);
  const fallback = [`${stem}${ext}`, `${stem}-scaled${ext}`];
  const ratioMap = {
    wide: [`${stem}-1536x1024${ext}`, `${stem}-1200x800${ext}`, `${stem}-1024x683${ext}`],
    portrait: [`${stem}-683x1024${ext}`, `${stem}-768x1152${ext}`, `${stem}-640x960${ext}`],
    square: [`${stem}-1024x1024${ext}`, `${stem}-768x768${ext}`, `${stem}-640x640${ext}`],
  };
  return [...(ratioMap[ratio] || []), ...fallback];
}

function buildCandidateUrls(imagePath, ratio) {
  const cleanedPath = imagePath.replace(/^\/+/, "");
  const filename = cleanedPath.split("/").pop();
  if (!filename) return [];
  const candidates = [];
  const names = ratioVariants(filename, ratio);

  // 1) Exact relative path first (handles already-correct YYYY/MM paths).
  for (const name of names) {
    const replaced = cleanedPath.replace(filename, name);
    candidates.push(`${WP_UPLOADS_BASE}/${replaced}`);
  }

  // 2) Month fallbacks for historical assets that moved.
  for (const monthPath of DEFAULT_MONTH_PATHS) {
    for (const name of names) {
      candidates.push(`${WP_UPLOADS_BASE}/${monthPath}/${name}`);
    }
  }

  return [...new Set(candidates)];
}

export default async function handler(req, res) {
  const paths = asNonEmptyStringArray(req.query.path);
  const extras = asNonEmptyStringArray(req.query.paths);
  const requestedPaths = [...new Set([...paths, ...extras])];
  const ratio = typeof req.query.ratio === "string" ? req.query.ratio.trim().toLowerCase() : "";

  if (!requestedPaths.length) {
    return res.status(400).json({
      error: "Path parameter is required",
      hint: "Use ?path=2026/02/photo.jpg or multiple with ?path=a.jpg&path=b.jpg / ?paths=a.jpg,b.jpg",
    });
  }

  const candidateUrls = requestedPaths.flatMap((p) => buildCandidateUrls(p, ratio));

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ct = response.headers.get("content-type") || "application/octet-stream";

      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Image-Proxy-Source", url);
      return res.send(buffer);
    } catch {
      // Continue trying other candidates.
    }
  }

  return res.status(404).json({
    error: "Image not found",
    tried: candidateUrls.length,
  });
}
