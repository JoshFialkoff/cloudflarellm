const DEFAULT_FOCUS_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

function isScrollable(element) {
  if (!element || element === document.body || element === document.documentElement) {
    return false
  }
  const style = window.getComputedStyle(element)
  const overflowY = style.overflowY
  const canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  return canScrollY && element.scrollHeight > element.clientHeight + 1
}

function scrollElementWithinContainer(container, target, { padding = 12 } = {}) {
  if (!container || !target) return false

  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  let changed = false

  if (targetRect.bottom > containerRect.bottom - padding) {
    container.scrollTop += targetRect.bottom - containerRect.bottom + padding
    changed = true
  }

  const nextRect = changed ? target.getBoundingClientRect() : targetRect
  if (nextRect.top < containerRect.top + padding) {
    container.scrollTop -= containerRect.top + padding - nextRect.top
    changed = true
  }

  return changed
}

function isMostlyVisible(target, padding = 12) {
  if (!target || typeof window === 'undefined') return false
  const rect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  return rect.top >= padding && rect.bottom <= viewportHeight - padding
}

/**
 * Scroll a target into view within nested scroll containers, then optionally focus.
 * Use for wizard composers, auth gates, and other interactive panels site-wide.
 */
export function revealFocusTarget(target, options = {}) {
  if (!target || typeof window === 'undefined') return

  const {
    behavior = 'smooth',
    block = 'nearest',
    inline = 'nearest',
    padding = 12,
    focus = true,
    focusElement = null,
    focusSelector = DEFAULT_FOCUS_SELECTOR,
    scrollRoot = null,
    pageAnchorId = '',
  } = options

  const scrollBehavior = prefersReducedMotion() ? 'auto' : behavior

  const run = () => {
    if (pageAnchorId) {
      const anchor = document.getElementById(pageAnchorId)
      if (anchor) {
        anchor.scrollIntoView({ behavior: scrollBehavior, block: 'start', inline: 'nearest' })
      }
    }

    if (scrollRoot?.contains?.(target)) {
      scrollElementWithinContainer(scrollRoot, target, { padding })
    }

    let parent = target.parentElement
    while (parent) {
      if (isScrollable(parent)) {
        scrollElementWithinContainer(parent, target, { padding })
      }
      parent = parent.parentElement
    }

    if (!isMostlyVisible(target, padding)) {
      target.scrollIntoView({ behavior: scrollBehavior, block, inline })
    }

    if (focus === false) return

    const focusTarget =
      focusElement ||
      (typeof target.matches === 'function' && target.matches(focusSelector)
        ? target
        : target.querySelector?.(focusSelector))

    if (!focusTarget || typeof focusTarget.focus !== 'function') return

    try {
      focusTarget.focus({ preventScroll: true })
    } catch {
      focusTarget.focus()
    }
  }

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run))
  } else {
    setTimeout(run, 0)
  }
}

export function revealFocusSelector(root, selector, options = {}) {
  if (!root || !selector) return
  const target = root.querySelector(selector)
  if (target) revealFocusTarget(target, options)
}
