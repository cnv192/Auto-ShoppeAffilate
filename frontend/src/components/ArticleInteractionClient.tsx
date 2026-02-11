'use client'

import { useUserInteraction } from '@/hooks/useUserInteraction'
import { useEffect, useCallback } from 'react'

interface ArticleInteractionClientProps {
  isCloaked?: boolean
}

/**
 * Client component that handles user interactions for articles
 * - Mounts useUserInteraction hook only for real users
 * - Lazy loads external scripts/iframes on user interaction
 */
export function ArticleInteractionClient({ isCloaked = false }: ArticleInteractionClientProps) {
  const loadExternalResources = useCallback(() => {
    // Example: Load external scripts, iframes, or tracking code
    console.log('User interacted - loading external resources')

    // You can trigger loading of:
    // - Analytics scripts
    // - Ad networks
    // - Social media embeds
    // - Comment systems
    // - Other third-party services

    // Example:
    if (!isCloaked) {
      // Load GA or similar tracking
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_ID'
      document.head.appendChild(script)

      // Load ad networks
      console.log('Loading ads...')
    }
  }, [isCloaked])

  // Initialize user interaction detection
  useUserInteraction({
    scrollThreshold: 200,
    debounceDelay: 300,
    onInteraction: () => {
      // Trigger lazy loading of external resources
      loadExternalResources()
    },
  })

  useEffect(() => {
    // Listen for user interaction event
    const handleInteraction = () => {
      loadExternalResources()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('userInteraction', handleInteraction)
      return () => {
        window.removeEventListener('userInteraction', handleInteraction)
      }
    }
    loadExternalResources()
  }, [loadExternalResources])

  return null
}
