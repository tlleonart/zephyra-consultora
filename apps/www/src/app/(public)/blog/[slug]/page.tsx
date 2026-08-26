import type { Metadata } from 'next';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { BlogPostContent } from '@/components/public/BlogPostContent';
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_URL } from '@/lib/site';
import styles from './BlogPost.module.css';

export const dynamic = 'force-dynamic';

/**
 * Per-post Open Graph metadata. A separate, lightweight server-side fetch from
 * BlogPostContent's own client-side `useQuery` — that duplication is
 * deliberate, not an oversight: `generateMetadata` runs before any client
 * component mounts and Next has no mechanism to hand a client hook's result to
 * it, so the metadata needs its own read of the same query.
 *
 * `post.coverUrl` comes back ALREADY RESOLVED by the query itself
 * (blogPosts.getBySlug calls ctx.storage.getUrl server-side) — an absolute
 * Convex storage URL, or null when the post has no cover. That is the only
 * cover source used here. `@/lib/staticImages`' BLOG_COVER_MAP is a
 * client-rendering fallback for legacy posts and is a separate concern —
 * consulting it here would mean shipping a relative `/images/*.webp` path as
 * an OG image, which no scraper resolves.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // The fetch is wrapped: metadata is a share-preview nicety, not the page
  // itself. BlogPostContent does its own client-side useQuery and renders the
  // real not-found / loading / content states regardless of what happens here,
  // so a Convex hiccup at THIS call must degrade to generic metadata — WITH the
  // default image, so a share preview is never blank — rather than take the
  // whole route down with it.
  let post: Awaited<ReturnType<typeof fetchPostForMetadata>>;
  try {
    post = await fetchPostForMetadata(slug);
  } catch {
    return {
      title: 'Blog',
      description: SITE_DESCRIPTION,
      openGraph: {
        title: 'Blog',
        description: SITE_DESCRIPTION,
        type: 'article',
        images: [{ url: DEFAULT_OG_IMAGE, alt: 'Zephyra Consultora' }],
      },
    };
  }

  if (!post) {
    return {
      title: 'Articulo no encontrado',
      description: 'El articulo que buscas no existe o ha sido eliminado.',
    };
  }

  const description = post.excerpt;
  const url = `${SITE_URL}/blog/${slug}`;
  const image = post.coverUrl ?? DEFAULT_OG_IMAGE;

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url,
      images: [{ url: image, alt: post.title }],
    },
  };
}

function fetchPostForMetadata(slug: string) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  return convex.query(api.blogPosts.getBySlug, { slug });
}

export default function BlogPostPage() {
  return (
    <main className={styles.main}>
      <BlogPostContent />
    </main>
  );
}
