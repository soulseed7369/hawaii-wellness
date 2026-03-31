import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { getArticleBySlug } from '@/lib/ssr';
import { SITE_NAME, SITE_URL } from '@/lib/siteConfig';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Article Not Found' };

  return {
    title: article.title,
    description: article.excerpt || `Read ${article.title} on ${SITE_NAME}.`,
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      type: 'article',
      url: `${SITE_URL}/articles/${article.slug}`,
      images: article.image ? [article.image] : undefined,
      publishedTime: article.date,
      authors: [article.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || undefined,
      images: article.image ? [article.image] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.image || undefined,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    datePublished: article.date,
    url: `${SITE_URL}/articles/${article.slug}`,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE_URL}/articles` },
      { '@type': 'ListItem', position: 3, name: article.title, item: `${SITE_URL}/articles/${article.slug}` },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/articles" className="hover:text-foreground transition-colors">Articles</Link></li>
          <li aria-hidden>/</li>
          <li className="text-foreground font-medium truncate max-w-[200px]">{article.title}</li>
        </ol>
      </nav>

      {/* Category badge */}
      {article.category && (
        <span className="inline-block mb-4 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {article.category}
        </span>
      )}

      {/* Header */}
      <h1 className="mb-4 font-display text-4xl font-bold leading-tight">{article.title}</h1>

      <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{article.author}</span>
        {article.date && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={article.date}>
              {new Date(article.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </>
        )}
      </div>

      {/* Cover image */}
      {article.image && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            src={article.image}
            alt={article.title}
            className="w-full object-cover"
            style={{ maxHeight: '480px' }}
            loading="eager"
          />
        </div>
      )}

      {/* Article body — sanitized server-side with isomorphic-dompurify */}
      {article.body ? (
        <div
          className="prose prose-stone max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.body) }}
        />
      ) : article.excerpt ? (
        <p className="text-muted-foreground leading-relaxed">{article.excerpt}</p>
      ) : null}

      {/* Footer nav */}
      <div className="mt-12 pt-8 border-t border-border">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Articles
        </Link>
      </div>
    </div>
  );
}
