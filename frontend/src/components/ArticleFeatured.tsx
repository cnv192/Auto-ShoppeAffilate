import Link from 'next/link'
import Image from 'next/image'
import { Link as LinkType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

interface ArticleFeaturedProps {
    article: LinkType
}

export function ArticleFeatured({ article }: ArticleFeaturedProps) {
    const slug = article.slug || article._id
    const href = `/${slug}`
    const imageUrl = article.imageUrl || article.thumbnail

    return (
        <Link href={href} className="block">
            <article className="featured-article h-[400px] md:h-[500px] relative group">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
                )}

                <div className="featured-article-content">
                    {article.category && (
                        <span className="category-badge category-badge-red mb-3 inline-block">
                            {article.category}
                        </span>
                    )}
                    <h2 className="article-title-featured line-clamp-3 mb-3">
                        {article.title}
                    </h2>
                    {article.description && (
                        <p className="text-gray-200 text-sm md:text-base line-clamp-2 mb-3">
                            {article.description}
                        </p>
                    )}
                    <div className="flex items-center gap-3 text-gray-300 text-sm">
                        {article.createdAt && (
                            <time className="time-ago text-gray-300">
                                {formatTimeAgo(article.createdAt)}
                            </time>
                        )}
                        {article.clicks && (
                            <span>• {article.clicks} lượt xem</span>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    )
}
