import {
  buildBannerProxyUrl,
  LANDING_BANNER_CAROUSEL_SLIDES,
} from './landingBannerPhotos'

function hashString(value = '') {
  return [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

export function facilityHeroImage(facility) {
  const slides = LANDING_BANNER_CAROUSEL_SLIDES
  if (!slides.length) return { src: '', alt: '' }

  const key = facility?.slug || facility?.name || 'facility'
  const slide = slides[hashString(key) % slides.length]
  const useProxy = process.env.NEXT_PUBLIC_BANNER_USE_PROXY === '1'
  const src =
    useProxy && slide.proxyPaths?.length
      ? buildBannerProxyUrl(slide.proxyPaths, 'wide')
      : slide.src

  return {
    src,
    alt: slide.alt || `${facility?.name || 'Senior living community'} lifestyle photo`,
    objectPosition: slide.objectPosition || 'center 30%',
  }
}
