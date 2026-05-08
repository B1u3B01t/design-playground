/**
 * Server-side props fetchers for discovered components.
 *
 * Each entry maps a discovery component ID to an async function that fetches
 * real data once — during the "Add to Playground" analysis flow. The result is
 * passed to the Cursor agent as a data snapshot so it can write realistic,
 * live-data-based mock props into the discovered wrapper file.
 *
 * NEVER call these at render time. They are only safe to run in server-side
 * route handlers.
 *
 * Example entry:
 *
 *   'my-component': async () => {
 *     const data = await fetchMyData();
 *     return { items: data };
 *   },
 */

import 'server-only';
import { getSupabaseClient } from '@/lib/supabase';

type PropsSnapshot = Record<string, unknown>;

const propsFetchers: Record<string, () => Promise<PropsSnapshot>> = {
  // ---------------------------------------------------------------------------
  // Add project-specific fetchers here.
  // Each key should match the component ID used in registry.tsx.
  // ---------------------------------------------------------------------------
  'edit-insight-client': async () => {
    const supabase = getSupabaseClient();

    const { data: post } = await supabase
      .from('insight_posts')
      .select('id,slug,title,subtitle,excerpt,content_html,hero_image_url,image_url,published_at,read_time_minutes,is_draft,tier,tags,category_id,author_id')
      .limit(1)
      .maybeSingle();

    const { data: categories } = await supabase
      .from('insight_categories')
      .select('id,name,slug,image_url')
      .order('position', { ascending: true })
      .limit(10);

    const { data: authors } = await supabase
      .from('insight_authors')
      .select('id,name,title,avatar_url')
      .order('name', { ascending: true })
      .limit(10);

    return {
      post: post
        ? {
            id: post.id,
            slug: post.slug,
            title: post.title ?? '',
            subtitle: post.subtitle ?? '',
            excerpt: post.excerpt ?? '',
            contentHtml: post.content_html ?? '',
            heroImageUrl: post.hero_image_url ?? '',
            imageUrl: post.image_url ?? '',
            publishedAt: post.published_at ?? '',
            readTimeMinutes: post.read_time_minutes ?? 0,
            isDraft: post.is_draft ?? true,
            tier: post.tier ?? 'FREE',
            tags: post.tags ?? [],
            categoryId: post.category_id,
            authorId: post.author_id,
          }
        : null,
      categories: categories ?? [],
      authors: authors ?? [],
    };
  },
  'insights-client': async () => {
    const supabase = getSupabaseClient();

    const { data: categoriesRes } = await supabase
      .from('insight_categories')
      .select('name,image_url,position,is_active')
      .order('position', { ascending: true });

    type CategoryRow = { name: string; image_url?: string | null };
    const categories = [
      { name: 'All Insights', image: undefined as string | undefined },
      ...((categoriesRes ?? []).map((c: CategoryRow) => ({ name: c.name, image: c.image_url ?? undefined }))),
    ];

    const { data: postsRes } = await supabase
      .from('insight_posts')
      .select('id,slug,title,subtitle,badge,image_url,published_at,is_draft,tier,insight_categories(name),insight_authors(name,avatar_url)')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(10);

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
      insight_authors?: { name?: string | null; avatar_url?: string | null } | { name?: string | null; avatar_url?: string | null }[] | null;
    };

    const formatDate = (dateStr?: string | null): string | undefined => {
      if (!dateStr) return undefined;
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

    const recentEssays = posts.slice(0, 4);

    return { data: { categories, posts, recentEssays } };
  },
  'bites-client': async () => {
    const supabase = getSupabaseClient();

    const { data: rows } = await supabase
      .from('interactions')
      .select('id, slug, created_at, published_at, title, app_name, industry, macro, patterns, phases, flows, sub_categories, platform, website_url, logo, video_id, screenshots, thumbnail_url, feature_name')
      .order('published_at', { ascending: false })
      .eq('draft', false)
      .limit(8);

    const items = (rows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      slug: row.slug,
      created_at: row.created_at ?? undefined,
      published_at: row.published_at ?? undefined,
      title: row.title ?? undefined,
      type: row.macro ?? undefined,
      pattern: Array.isArray(row.patterns) ? row.patterns[0] ?? null : null,
      patterns: row.patterns ?? undefined,
      phases: row.phases ?? undefined,
      flows: row.flows ?? undefined,
      platform: row.platform ?? undefined,
      sub_categories: row.sub_categories ?? [],
      industry: row.industry ?? undefined,
      logo: row.logo ?? null,
      videoId: row.video_id ?? null,
      screenshots: row.screenshots ?? [],
      thumbnail_url: row.thumbnail_url ?? null,
      app_name: row.app_name ?? null,
      website_url: row.website_url ?? null,
    }));

    // Build filters from the fetched rows
    const industrySet = new Set<string>();
    const patternSet = new Set<string>();
    const phaseSet = new Set<string>();
    const flowSet = new Set<string>();
    const productSet = new Set<string>();
    for (const row of rows ?? []) {
      const r = row as Record<string, unknown>;
      if (r.industry) industrySet.add(r.industry as string);
      for (const p of (r.patterns as string[] | null) ?? []) if (p) patternSet.add(p);
      for (const p of (r.phases as string[] | null) ?? []) if (p) phaseSet.add(p);
      for (const f of (r.flows as string[] | null) ?? []) if (f) flowSet.add(f);
      if (r.app_name) productSet.add(r.app_name as string);
    }

    return {
      items,
      totalCount: items.length,
      filters: {
        Industry: Array.from(industrySet).sort(),
        Phases: Array.from(phaseSet).sort(),
        'AI Pattern': Array.from(patternSet).sort(),
        Flows: Array.from(flowSet).sort(),
        Products: Array.from(productSet).sort(),
      },
      modes: [] as string[],
      platforms: [] as string[],
      limit: 30,
      stickyFilters: true,
      hideHeader: false,
      limited: false,
      overlayBasePath: '/browse',
      patternGroups: {},
      livePatternNames: [] as string[],
    };
  },
  'community-client': async () => {
    const supabase = getSupabaseClient();

    const { data: blogsRes } = await supabase
      .from('community_blogs')
      .select('id,slug,title,content,author_name,author_image_url,category,image_url,published_at')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(10);

    type BlogRow = {
      id: number;
      slug: string;
      title: string | null;
      content?: string | null;
      author_name: string | null;
      author_image_url?: string | null;
      category: string | null;
      image_url?: string | null;
      published_at?: string | null;
    };

    const blogs = (blogsRes ?? []).map((b: BlogRow) => ({
      id: b.id,
      slug: b.slug,
      title: b.title ?? '',
      content: b.content ?? undefined,
      authorName: b.author_name ?? '',
      authorImageUrl: b.author_image_url ?? undefined,
      category: b.category ?? '',
      imageUrl: b.image_url ?? undefined,
      publishedAt: b.published_at ?? undefined,
    }));

    const categoryCounts: Record<string, number> = {};
    blogs.forEach((blog) => {
      if (blog.category) {
        categoryCounts[blog.category] = (categoryCounts[blog.category] || 0) + 1;
      }
    });

    const categories = [
      { name: 'All', count: blogs.length },
      { name: 'AI Experiments', count: categoryCounts['AI Experiments'] || 0 },
      { name: 'Product Launches', count: categoryCounts['Product Launches'] || 0 },
      { name: 'Listicles', count: categoryCounts['Listicles'] || 0 },
      { name: 'Educational', count: categoryCounts['Educational'] || 0 },
    ].filter((cat) => cat.count > 0 || cat.name === 'All');

    return { data: { blogs, categories } };
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
