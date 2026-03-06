/**
 * Server-side props fetchers for discovered components.
 *
 * Each entry maps a discovery component ID to an async function that fetches
 * real data once — during the "Add to Playground" analysis flow. The result is
 * passed to the Cursor agent as a data snapshot so it can write realistic,
 * live-data-based mock props into the discovered wrapper file.
 *
 * NEVER call these at render time. They use the service-role Supabase client
 * and are only safe to run in server-side route handlers.
 */

import 'server-only';
import { getSupabaseClient } from '@/lib/supabase';

function formatDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type PropsSnapshot = Record<string, unknown>;

const propsFetchers: Record<string, () => Promise<PropsSnapshot>> = {
  // ---------------------------------------------------------------------------
  // Insights page — mirrors src/app/insights/page.tsx fetchInsightsData()
  // ---------------------------------------------------------------------------
  'insights-page': async () => {
    const supabase = getSupabaseClient();

    const { data: categoriesRes } = await supabase
      .from('insight_categories')
      .select('name,image_url,position,is_active')
      .order('position', { ascending: true });

    type CategoryRow = { name: string; image_url?: string | null };
    const categories = [
      { name: 'All Insights', image: undefined as string | undefined },
      ...((categoriesRes ?? []).map((c: CategoryRow) => ({
        name: c.name,
        image: c.image_url ?? undefined,
      }))),
    ];

    const { data: postsRes } = await supabase
      .from('insight_posts')
      .select(
        'id,slug,title,subtitle,badge,image_url,published_at,is_draft,tier,insight_categories(name),insight_authors(name,avatar_url)',
      )
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(10); // keep snapshot small for the agent prompt

    type PostRow = {
      id: number;
      slug: string;
      title: string | null;
      subtitle?: string | null;
      badge?: string | null;
      image_url?: string | null;
      published_at?: string | null;
      tier?: 'FREE' | 'PRO' | null;
      insight_categories?: { name?: string | null } | { name?: string | null }[] | null;
      insight_authors?:
        | { name?: string | null; avatar_url?: string | null }
        | { name?: string | null; avatar_url?: string | null }[]
        | null;
    };

    const posts = (postsRes ?? []).map((p: PostRow) => {
      const categoryName = Array.isArray(p.insight_categories)
        ? p.insight_categories[0]?.name
        : p.insight_categories?.name;
      const authorSource = Array.isArray(p.insight_authors)
        ? p.insight_authors[0]
        : p.insight_authors;
      return {
        id: p.id,
        title: p.title ?? '',
        subtitle: p.subtitle ?? undefined,
        category: categoryName ?? '',
        badge: p.badge ?? undefined,
        author: authorSource?.name ?? undefined,
        authorAvatar: authorSource?.avatar_url ?? undefined,
        date: formatDate(p.published_at ?? undefined),
        image: p.image_url ?? undefined,
        slug: p.slug,
        tier: (p.tier ?? undefined) as 'FREE' | 'PRO' | undefined,
      };
    });

    return {
      data: {
        categories,
        posts,
        recentEssays: posts.slice(0, 4),
      },
    };
  },

  // ---------------------------------------------------------------------------
  // Article card — fetch the most recent published post for a realistic preview
  // ---------------------------------------------------------------------------
  'article-card': async () => {
    const supabase = getSupabaseClient();

    const { data: postsRes } = await supabase
      .from('insight_posts')
      .select(
        'id,slug,title,subtitle,excerpt,badge,image_url,published_at,tier,insight_categories(name),insight_authors(name,avatar_url)',
      )
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    if (!postsRes) return {};

    type SinglePost = {
      id: number;
      slug: string;
      title: string | null;
      subtitle?: string | null;
      excerpt?: string | null;
      badge?: string | null;
      image_url?: string | null;
      published_at?: string | null;
      tier?: 'FREE' | 'PRO' | null;
      insight_categories?: { name?: string | null } | { name?: string | null }[] | null;
      insight_authors?:
        | { name?: string | null; avatar_url?: string | null }
        | { name?: string | null; avatar_url?: string | null }[]
        | null;
    };

    const p = postsRes as SinglePost;
    const categoryName = Array.isArray(p.insight_categories)
      ? p.insight_categories[0]?.name
      : p.insight_categories?.name;
    const authorSource = Array.isArray(p.insight_authors) ? p.insight_authors[0] : p.insight_authors;

    return {
      post: {
        id: p.id,
        title: p.title ?? '',
        subtitle: p.subtitle ?? undefined,
        excerpt: p.excerpt ?? undefined,
        category: categoryName ?? '',
        badge: p.badge ?? undefined,
        author: authorSource?.name ?? undefined,
        authorAvatar: authorSource?.avatar_url ?? undefined,
        date: formatDate(p.published_at ?? undefined),
        image: p.image_url ?? undefined,
        slug: p.slug,
        tier: (p.tier ?? undefined) as 'FREE' | 'PRO' | undefined,
      },
      category: categoryName ? { name: categoryName, isActive: true } : undefined,
    };
  },
};

/**
 * Fetch a real-data snapshot for a given component ID.
 * Returns null if no fetcher is registered for that ID, or if the fetch fails.
 */
export async function fetchPropsSnapshot(componentId: string): Promise<PropsSnapshot | null> {
  const fetcher = propsFetchers[componentId];
  if (!fetcher) return null;
  try {
    return await fetcher();
  } catch (err) {
    console.warn(`[props-fetchers] Snapshot fetch failed for "${componentId}":`, err);
    return null;
  }
}
