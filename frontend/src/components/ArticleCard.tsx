import Link from 'next/link'
import Image from 'next/image'
import { Link as LinkType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

interface ArticleCardProps {
  article: LinkType
  variant?: 'default' | 'compact' | 'horizontal'
}

export function ArticleCard({ article, variant = 'default' }: ArticleCardProps) {
  const slug = article.slug || article._id
  const href = `/${slug}`
  const imageUrl = article.imageUrl || article.thumbnail

  if (variant === 'horizontal') {
    return (
      <Link href={href} className="block">
        <article className="article-card flex gap-4 p-4 group">
          {imageUrl && (
            <div className="flex-shrink-0 relative w-32 h-24 md:w-40 md:h-28 overflow-hidden rounded">
              <Image
                src={imageUrl}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}
          <div className="flex-grow min-w-0">
            {article.category && (
              <span className="text-xs font-semibold text-primary-500 uppercase tracking-wide">
                {article.category}
              </span>
            )}
            <h3 className="article-title mt-1 text-base">
              {article.title}
            </h3>
            <div className="article-meta mt-2">
              {article.createdAt && (
                <time className="time-ago">{formatTimeAgo(article.createdAt)}</time>
              )}
            </div>
          </div>
        </article>
      </Link>
    )
  }

  if (variant === 'compact') {
    return (
      <Link href={href} className="block">
        <article className="article-card p-3 group">
          <h3 className="article-title text-sm">
            {article.title}
          </h3>
          <div className="article-meta mt-2">
            {article.category && (
              <span className="text-primary-500 font-medium">{article.category}</span>
            )}
            {article.createdAt && (
              <time className="time-ago">{formatTimeAgo(article.createdAt)}</time>
            )}
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={href} className="block">
      <article className="article-card h-full flex flex-col group">
        {/* Thumbnail */}
        {imageUrl && (
          <div className="relative h-48 overflow-hidden">
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        <div className="p-4 flex flex-col flex-grow">
          {/* Category */}
          {article.category && (
            <span className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-2">
              {article.category}
            </span>
          )}

          {/* Title */}
          <h3 className="article-title text-lg mb-2">
            {article.title}
          </h3>

          {/* Description */}
          {article.description && (
            <p className="text-gray-600 text-sm line-clamp-2 flex-grow">
              {article.description}
            </p>
          )}

          {/* Metadata */}
          <div className="article-meta mt-3 pt-3 border-t border-gray-100">
            {article.createdAt && (
              <time className="time-ago">{formatTimeAgo(article.createdAt)}</time>
            )}
            {article.clicks && (
              <span>{article.clicks} lượt xem</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
