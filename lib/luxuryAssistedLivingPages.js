import landingPages from "../landing/luxury-assisted-living-pages.json";

const TOWN_POSITION_IN_URL = 1;

function getTownFromUrl(url) {
  const segments = url.split("/").filter(Boolean);
  return segments[TOWN_POSITION_IN_URL] || "";
}

export const LUXURY_ASSISTED_LIVING_PAGES = landingPages.map((page) => ({
  ...page,
  town: getTownFromUrl(page.url),
}));

export const LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN =
  LUXURY_ASSISTED_LIVING_PAGES.reduce((acc, page) => {
    if (page.town) {
      acc[page.town] = page;
    }
    return acc;
  }, {});
