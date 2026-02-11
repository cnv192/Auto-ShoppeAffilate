import { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ArticleCard } from '@/components/ArticleCard'
import { ArticleFeatured } from '@/components/ArticleFeatured'
import { ArticleListItem } from '@/components/ArticleListItem'
import { fetchFromApi } from '@/lib/utils'
import { Link, PaginatedResponse } from '@/lib/types'
import { fetchOptions } from '@/config/api'

export const metadata: Metadata = {
  title: 'Báo mới - Tin tức 24h mới nhất, tin nhanh, tin nóng hàng ngày',
  description: 'Báo mới cập nhật tin tức 24h, đọc báo online với tin nóng, tin nhanh về thời sự, thế giới, kinh tế, đời sống, giải trí, thể thao, công nghệ.',
  openGraph: {
    title: 'Báo mới - Tin tức 24h mới nhất',
    description: 'Tin tức 24h mới nhất, tin nhanh, tin nóng hàng ngày',
    type: 'website',
  },
}

async function getArticles(): Promise<Link[]> {
  try {
    const response = await fetchFromApi<PaginatedResponse<Link>>(
      '/api/links/public?limit=20&offset=0',
      fetchOptions.noStore
    )

    return response.data || []
  } catch (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }
}

export default async function HomePage() {
  const articles = await getArticles()

  // Split articles for different sections
  const featuredArticle = articles[0]
  const topArticles = articles.slice(1, 5)
  const sidebarArticles = articles.slice(5, 12)
  const gridArticles = articles.slice(12, 18)

  return (
    <div className="min-h-screen flex flex-col bg-news-lightgray">
      <Header title="Báo mới" />

      <main className="flex-grow">
        {/* Main Content Area */}
        <div className="container-news py-6">
          {articles && articles.length > 0 ? (
            <>
              {/* Featured Section */}
              <section className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Featured Article - Left side */}
                  <div className="lg:col-span-2">
                    {featuredArticle && (
                      <ArticleFeatured article={featuredArticle} />
                    )}
                  </div>

                  {/* Top Articles - Right side */}
                  <div className="space-y-4">
                    {topArticles.map((article) => (
                      <ArticleCard
                        key={article._id}
                        article={article}
                        variant="horizontal"
                      />
                    ))}
                  </div>
                </div>
              </section>

              {/* Main Grid + Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2">
                  {/* Latest News Section */}
                  <section className="news-section">
                    <h2 className="news-section-title">Tin mới nhất</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {gridArticles.map((article) => (
                        <ArticleCard key={article._id} article={article} />
                      ))}
                    </div>
                  </section>
                </div>

                {/* Sidebar */}
                <aside className="lg:col-span-1">
                  {/* Hot News */}
                  <div className="sidebar-section sticky top-20">
                    <h3 className="sidebar-title">🔥 Tin nóng 24h</h3>
                    <div className="space-y-0">
                      {sidebarArticles.map((article, index) => (
                        <ArticleListItem
                          key={article._id}
                          article={article}
                          showImage={false}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📰</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chưa có bài viết nào
              </h3>
              <p className="text-gray-600">
                Vui lòng quay lại sau để xem tin tức mới nhất.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
