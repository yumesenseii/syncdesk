let invalidateFeed: (() => void) | null = null

export function registerActivityFeedInvalidator(fn: () => void) {
  invalidateFeed = fn
  return () => {
    if (invalidateFeed === fn) invalidateFeed = null
  }
}

export function invalidateActivityFeed() {
  invalidateFeed?.()
}
