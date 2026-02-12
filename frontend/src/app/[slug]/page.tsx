import { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ArticleInteractionClient } from '@/components/ArticleInteractionClient'
import BannerDisplay from '@/components/BannerDisplay'
import { fetchFromApi, formatDate } from '@/lib/utils'
import { Article, ApiResponse } from '@/lib/types'
import { fetchOptions } from '@/config/api'

interface ArticlePageProps {
  params: {
    slug: string
  }
}

async function getArticle(slug: string): Promise<Article | null> {
  try {
    // Try fetching by slug first
    const response = await fetchFromApi<ApiResponse<Article>>(
      `/api/links/${slug}`,
      fetchOptions.noStore
    )

    if (response.success && response.data) {
      return response.data
    }

    return null
  } catch (error) {
    console.error('Failed to fetch article:', error)
    return null
  }
}

export async function generateMetadata(
  { params }: ArticlePageProps
): Promise<Metadata> {
  const article = await getArticle(params.slug)

  if (!article) {
    return {
      title: 'Không tìm thấy bài viết',
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tintuc24h.site'
  const url = `${siteUrl}/${params.slug}`
  
  // Lấy image URL - bỏ qua base64 data URLs vì Facebook không crawl được
  let imageUrl: string | undefined = article.imageUrl || article.thumbnail
  if (imageUrl && imageUrl.startsWith('data:')) {
    imageUrl = undefined
  }
  
  // Nếu không có imageUrl hợp lệ, thử trích xuất ảnh đầu tiên từ content bài viết
  if (!imageUrl && article.content) {
    const imgMatch = article.content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|avif)/i)
    if (imgMatch) {
      imageUrl = imgMatch[0]
    }
  }
  
  // Fallback description: nếu rỗng, tạo từ title
  const description = article.description && article.description.trim()
    ? article.description
    : `${article.title} - Đọc tin tức mới nhất trên Tin tức 24h`

  return {
    title: article.title,
    description: description,
    keywords: article.tags?.join(', '),
    openGraph: {
      title: article.title,
      description: description,
      type: 'article',
      url,
      siteName: 'Tin tức 24h',
      locale: 'vi_VN',
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: article.title }] : undefined,
      publishedTime: article.createdAt,
      authors: article.author ? [article.author] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    other: {
      'fb:app_id': process.env.NEXT_PUBLIC_FB_APP_ID || '',
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getArticle(params.slug)

  if (!article) {
    notFound()
  }

  const isCloaked = article.isCloaked ?? false
  const imageUrl = article.imageUrl || article.thumbnail

  // Xử lý content HTML - loại bỏ các ảnh base64 placeholder (lazy loading)
  const processContent = (content: string): string => {
    if (!content) return ''
    
    // Loại bỏ các thẻ img có src là data:image/gif;base64 (lazy loading placeholder)
    let processedContent = content.replace(
      /<img[^>]*src=["']data:image\/gif;base64[^"']*["'][^>]*>/gi, 
      ''
    )
    
    // Loại bỏ các ảnh rỗng hoặc placeholder
    processedContent = processedContent.replace(
      /<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi,
      ''
    )

    // Xử lý video iframe - thêm autoplay, muted và responsive wrapper
    processedContent = processedContent.replace(
      /<iframe([^>]*)(src=["'](https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^"']*)["'])([^>]*)>/gi,
      (_match, before, _srcAttr, srcUrl, after) => {
        // Thêm autoplay=1 và mute=1 vào URL YouTube nếu chưa có
        let newSrc = srcUrl
        if (!newSrc.includes('autoplay=')) {
          newSrc += (newSrc.includes('?') ? '&' : '?') + 'autoplay=1'
        }
        if (!newSrc.includes('mute=')) {
          newSrc += '&mute=1'
        }
        
        // Thêm allow="autoplay" attribute nếu chưa có
        let attrs = before + after
        if (!attrs.includes('allow=')) {
          attrs = before + ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"` + after
        }
        
        return `<div class="video-responsive"><iframe${attrs} src="${newSrc}">`
      }
    )
    
    // Đóng wrapper div sau </iframe>
    processedContent = processedContent.replace(
      /(<div class="video-responsive"><iframe[^>]*>.*?<\/iframe>)/gi,
      '$1</div>'
    )
    
    return processedContent
  }

  const processedContent = processContent(article.content || '')

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-grow">
        {/* Article Container */}
        <article className="container-wide py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            {/* Hero Section with Thumbnail */}
            {imageUrl && (
              <div className="mb-8 rounded-lg overflow-hidden -mx-4 md:mx-0">
                <Image
                  src={imageUrl}
                  alt={article.title}
                  width={800}
                  height={400}
                  className="w-full h-96 object-cover"
                />
              </div>
            )}

            {/* Meta Information */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                {article.category && (
                  <span className="badge badge-primary">
                    {article.category}
                  </span>
                )}
                {article.createdAt && (
                  <time dateTime={article.createdAt}>
                    {formatDate(article.createdAt)}
                  </time>
                )}
                {article.author && (
                  <span>By {article.author}</span>
                )}
                {article.clicks && (
                  <span>{article.clicks} views</span>
                )}
              </div>

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Description */}
            {article.description && (
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {article.description}
              </p>
            )}

            {/* Content */}
            {processedContent ? (
              <div 
                className="prose prose-lg max-w-none mb-8"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <p className="text-blue-900">
                  Full content is available on the original source. 
                  {article.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline ml-1"
                    >
                      Read full article →
                    </a>
                  )}
                </p>
              </div>
            )}

            {/* Inline Banner */}
            <BannerDisplay 
              type="inline" 
              articleSlug={params.slug} 
              category={article.category} 
            />

            {/* CTA Section */}
            {article.url && (
              <div className="bg-primary-50 rounded-lg border border-primary-200 p-8 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Want to read more?
                </h3>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Visit Original Source
                </a>
              </div>
            )}
          </div>
        </article>

        {/* Related Articles Section (placeholder) */}
        <section className="bg-gray-50 py-16 md:py-24">
          <div className="container-wide">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              More Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* TODO: Fetch and display related articles */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                <p>More articles coming soon...</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Sticky Bottom Banner */}
      <BannerDisplay 
        type="sticky_bottom" 
        articleSlug={params.slug} 
        category={article.category} 
      />

      {/* Header Banner */}
      <BannerDisplay 
        type="header" 
        articleSlug={params.slug} 
        category={article.category} 
      />

      {/* Center Popup Banner */}
      <BannerDisplay 
        type="center_popup" 
        articleSlug={params.slug} 
        category={article.category} 
      />

      {/* Sidebar Banner */}
      <BannerDisplay 
        type="sidebar" 
        articleSlug={params.slug} 
        category={article.category} 
      />

      {/* Client-side interaction detection */}
      <ArticleInteractionClient isCloaked={isCloaked} />
    </div>
  )
}
