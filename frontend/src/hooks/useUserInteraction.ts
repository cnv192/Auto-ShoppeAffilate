'use client'

import { useEffect, useRef, useState } from 'react'

interface InteractionConfig {
  scrollThreshold?: number
  debounceDelay?: number
  onInteraction?: () => void
}

/**
 * Hook to detect user interactions (scroll/click) and trigger lazy loading
 * This hook runs ONLY on the client side and ONLY for real users (not bots)
 *
 * Use case: Lazy load external scripts, iframes, and heavy resources
 * only when user shows genuine interaction with the page.
 */
export function useUserInteraction(config: InteractionConfig = {}) {
  const {
    scrollThreshold = 100,
    debounceDelay = 500,
    onInteraction,
  } = config

  const hasInteractedRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return
    }

    // Check if user is a bot via the middleware header
    const userType = document.documentElement.getAttribute('data-user-type')
    if (userType === 'bot') {
      return
    }

    /**
     * Handle scroll event
     */
    const handleScroll = () => {
      if (hasInteractedRef.current) {
        return
      }

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        const scrolled = window.scrollY || document.documentElement.scrollTop

        if (scrolled > scrollThreshold) {
          triggerInteraction()
        }
      }, debounceDelay)
    }

    /**
     * Handle click event
     */
    const handleClick = () => {
      if (hasInteractedRef.current) {
        return
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      triggerInteraction()
    }

    /**
     * Handle keyboard event
     */
    const handleKeydown = () => {
      if (hasInteractedRef.current) {
        return
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      triggerInteraction()
    }

    /**
     * Trigger interaction callback
     */
    function triggerInteraction() {
      hasInteractedRef.current = true

      // Dispatch custom event for other components to listen to
      const event = new CustomEvent('userInteraction', {
        detail: { timestamp: Date.now() },
      })
      window.dispatchEvent(event)

      // Call optional callback
      if (onInteraction) {
        onInteraction()
      }

      // Remove event listeners
      removeEventListeners()
    }

    /**
     * Remove event listeners to prevent memory leaks
     */
    function removeEventListeners() {
      window.removeEventListener('scroll', handleScroll, { passive: true } as AddEventListenerOptions)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeydown)
    }

    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true } as AddEventListenerOptions)
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeydown)

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      removeEventListeners()
    }
  }, [scrollThreshold, debounceDelay, onInteraction])

  return {
    hasInteracted: hasInteractedRef.current,
  }
}

/**
 * Hook to wait for user interaction
 * Useful for components that need to wait until user interacts with the page
 */
export function useWaitForUserInteraction() {
  const [hasInteracted, setHasInteracted] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleUserInteraction = () => {
      setHasInteracted(true)
      window.removeEventListener('userInteraction', handleUserInteraction)
    }

    window.addEventListener('userInteraction', handleUserInteraction)

    return () => {
      window.removeEventListener('userInteraction', handleUserInteraction)
    }
  }, [])

  return hasInteracted
}
