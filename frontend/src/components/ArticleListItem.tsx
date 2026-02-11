import Link from 'next/link'
import Image from 'next/image'
import { Link as LinkType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

interface ArticleListItemProps {
    article: LinkType
    showImage?: boolean
    index?: number
}

export function ArticleListItem({ article, showImage = true, index }: ArticleListItemProps) {
    const slug = article.slug || article._id
    const href = `/article/${slug}`

    return (
        <Link href={href} className="block">
            <article className="article-list-item group">
                {index !== undefined && (
                    <span className="text-2xl font-bold text-primary-500 min-w-[30px]">
                        {index + 1}
                    </span>
                )}

                {showImage && article.thumbnail && (
                    <div className="flex-shrink-0 relative w-24 h-16 md:w-32 md:h-20 overflow-hidden rounded">
                        <Image
                            src={article.thumbnail}
                            alt={article.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                )}

                <div className="flex-grow min-w-0">
                    <h3 className="article-title text-sm md:text-base group-hover:text-primary-500">
                        {article.title}
                    </h3>
                    <div className="article-meta mt-1">
                        {article.category && (
                            <span className="text-primary-500 font-medium">
                                {article.category}
                            </span>
                        )}
                        {article.createdAt && (
                            <time className="time-ago">
                                {formatTimeAgo(article.createdAt)}
                            </time>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    )
}
