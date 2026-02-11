import { redirect } from 'next/navigation'

interface ArticleRedirectProps {
  params: {
    slug: string
  }
}

/**
 * Redirect /article/[slug] → /[slug]
 * Backward compatibility for old URLs
 */
export default function ArticleRedirect({ params }: ArticleRedirectProps) {
  redirect(`/${params.slug}`)
}
