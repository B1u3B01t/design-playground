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
import { toValueSlug } from '@/lib/utils';

type PropsSnapshot = Record<string, unknown>;

const propsFetchers: Record<string, () => Promise<PropsSnapshot>> = {
  // ---------------------------------------------------------------------------
  // Add project-specific fetchers here.
  // Each key should match the component ID used in registry.tsx.
  // ---------------------------------------------------------------------------
  'collection-grid-client': async () => {
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('interactions')
      .select('*')
      .limit(10);

    if (error || !data) return { items: [], interactions: [], overlayBasePath: '/apps/example' };

    const interactions = data as Array<Record<string, unknown> & { id: number | string; slug: string; published_at?: string | null }>;

    const items = interactions.map((i) => ({
      id: i.id,
      videoId: (i as Record<string, unknown>).video_id ?? null,
      poster: (i as Record<string, unknown>).thumbnail_url ?? null,
      title: (i as Record<string, unknown>).title ?? undefined,
      macro: (i as Record<string, unknown>).macro ?? undefined,
      logo: (i as Record<string, unknown>).logo ?? null,
      publishedAt: i.published_at ?? null,
      slug: i.slug ?? null,
    }));

    const appName = (interactions[0] as Record<string, unknown>).app_name;
    const overlayBasePath = appName ? `/apps/${toValueSlug(appName as string)}` : '/apps/example';

    return { items, interactions, overlayBasePath };
  },
  'bites-client': async () => {
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('interactions')
      .select('id, slug, created_at, published_at, title, app_name, industry, macro, patterns, phases, flows, sub_categories, platform, website_url, logo, video_id, screenshots, thumbnail_url, feature_name')
      .order('published_at', { ascending: false })
      .eq('draft', false)
      .limit(10);

    if (error || !data) return { items: [], totalCount: 0, filters: {}, modes: [], platforms: [], limit: 30, limited: false, patternGroups: {}, livePatternNames: [] };

    type Row = Record<string, unknown> & { id: number | string; slug: string; published_at?: string | null; macro?: string | null; patterns?: string[] | null; phases?: string[] | null; flows?: string[] | null; industry?: string | null; app_name?: string | null };
    const rows = data as Row[];
    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      created_at: row.created_at ?? undefined,
      published_at: row.published_at ?? undefined,
      title: row.title ?? undefined,
      type: row.macro ?? undefined,
      patterns: row.patterns ?? undefined,
      phases: row.phases ?? undefined,
      flows: row.flows ?? undefined,
      platform: row.platform ?? undefined,
      industry: row.industry ?? undefined,
      logo: row.logo ?? null,
      videoId: row.video_id ?? null,
      screenshots: row.screenshots ?? [],
      thumbnail_url: row.thumbnail_url ?? null,
      app_name: row.app_name ?? null,
      website_url: row.website_url ?? null,
    }));

    const industrySet = new Set<string>();
    const patternSet = new Set<string>();
    const macroSet = new Set<string>();
    const flowSet = new Set<string>();
    const productSet = new Set<string>();
    for (const row of rows) {
      if (row.industry) industrySet.add(row.industry);
      for (const p of row.patterns ?? []) if (p) patternSet.add(p);
      for (const f of row.flows ?? []) if (f) flowSet.add(f);
      if (row.macro) macroSet.add(row.macro);
      if (row.app_name) productSet.add(row.app_name);
    }

    return {
      items,
      totalCount: items.length,
      filters: {
        Industry: Array.from(industrySet).sort(),
        'AI Pattern': Array.from(patternSet).sort(),
        Flows: Array.from(flowSet).sort(),
        Products: Array.from(productSet).sort(),
      },
      modes: Array.from(macroSet).sort(),
      platforms: [],
      limit: 30,
      limited: false,
      patternGroups: {},
      livePatternNames: [],
    };
  },
  'bite-slug-client': async () => {
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('interactions')
      .select('id, slug, created_at, published_at, title, app_name, industry, macro, media_source, patterns, phases, flows, sub_categories, platform, website_url, logo, video_id, screenshots, thumbnail_url, feature_name')
      .eq('draft', false)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        initialItem: { id: 0, slug: 'example', title: 'Example' },
        filters: { Industry: [], 'AI Pattern': [], Flows: [], Phases: [] },
        modes: [],
        platforms: [],
      };
    }

    const r = data as Record<string, unknown>;
    const initialItem = {
      id: r.id,
      slug: r.slug,
      created_at: r.created_at ?? undefined,
      published_at: r.published_at ?? undefined,
      title: r.title ?? undefined,
      type: r.macro ?? undefined,
      pattern: Array.isArray(r.patterns) && r.patterns.length > 0 ? r.patterns[0] : undefined,
      patterns: r.patterns ?? undefined,
      phases: r.phases ?? undefined,
      flows: r.flows ?? undefined,
      platform: r.platform ?? undefined,
      sub_categories: r.sub_categories ?? [],
      industry: r.industry ?? undefined,
      logo: r.logo ?? undefined,
      videoId: r.video_id ?? undefined,
      screenshots: r.screenshots ?? [],
      thumbnail_url: r.thumbnail_url ?? undefined,
      app_name: r.app_name ?? undefined,
      website_url: r.website_url ?? undefined,
      media_source: r.media_source ?? undefined,
      feature_name: r.feature_name ?? undefined,
    };

    return {
      initialItem,
      filters: { Industry: [], 'AI Pattern': [], Flows: [], Phases: [] },
      modes: [],
      platforms: [],
    };
  },
  'category-links': async () => {
    const svc = getSupabaseClient();
    const { data } = await svc.from('interactions').select('industry');
    const rows = (data ?? []) as Array<{ industry?: string | null }>;

    const industrySet = new Set<string>();
    for (const r of rows) {
      if (r.industry) industrySet.add(r.industry);
    }

    return {
      label: 'Industry',
      values: Array.from(industrySet).sort().slice(0, 10),
    };
  },
  'community-client': async () => {
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('community_blogs')
      .select('id,slug,title,content,author_name,author_image_url,category,image_url,published_at')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(10);

    if (error || !data) return { data: { blogs: [], categories: [{ name: 'All', count: 0 }] } };

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

    const blogs = (data as BlogRow[]).map((b) => ({
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
  'apps-page': async () => {
    const svc = getSupabaseClient();
    const { data } = await svc.from('interactions').select('app_name');
    const rows = (data ?? []) as Array<{ app_name?: string | null }>;

    const productSet = new Set<string>();
    for (const r of rows) {
      if (r.app_name) productSet.add(r.app_name);
    }

    const products = Array.from(productSet).sort((a, b) => a.localeCompare(b)).slice(0, 10);
    return { products };
  },
  'community-blog-client': async () => {
    const svc = getSupabaseClient();

    // Fetch the most recent published blog post
    const { data: blogRes } = await svc
      .from('community_blogs')
      .select('id,slug,title,content,author_name,author_image_url,author_social,author_designation,category,image_url,published_at')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!blogRes) return { blog: null, relatedBlogs: [] };

    const blog = {
      id: blogRes.id,
      slug: blogRes.slug,
      title: blogRes.title ?? '',
      content: blogRes.content ?? '',
      authorName: blogRes.author_name ?? '',
      authorImageUrl: blogRes.author_image_url ?? undefined,
      authorSocial: blogRes.author_social ?? undefined,
      authorDesignation: blogRes.author_designation ?? undefined,
      category: blogRes.category ?? '',
      imageUrl: blogRes.image_url ?? undefined,
      publishedAt: blogRes.published_at ?? undefined,
    };

    // Fetch related blogs (excluding current)
    const { data: relatedBlogsRes } = await svc
      .from('community_blogs')
      .select('id,slug,title,published_at')
      .eq('is_draft', false)
      .neq('slug', blog.slug)
      .order('published_at', { ascending: false })
      .limit(6);

    const formatDate = (dateStr?: string | null): string | undefined => {
      if (!dateStr) return undefined;
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const relatedBlogs = (relatedBlogsRes ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as number,
      slug: b.slug as string,
      title: (b.title as string) ?? '',
      publishedAt: formatDate(b.published_at as string | null),
    }));

    return { blog, relatedBlogs };
  },
  'pattern-content-client': async () => {
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('patterns_page')
      .select('slug,title,description,overview,markdown_body,is_paid,created_at,updated_at')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        slug: 'example-pattern',
        initialPattern: null,
        proviewData: null,
      };
    }

    const r = data as Record<string, unknown>;
    return {
      slug: r.slug as string,
      initialPattern: {
        slug: r.slug as string,
        title: (r.title as string) ?? '',
        description: (r.description as string) ?? '',
        overview: (r.overview as string | null) ?? undefined,
        markdownBody: (r.markdown_body as string) ?? '',
        isPaid: Boolean(r.is_paid),
        isFree: !r.is_paid,
        createdAt: (r.created_at as string) ?? new Date().toISOString(),
        updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
      },
      proviewData: null,
    };
  },
  'blog-post-client': async () => {
    const svc = getSupabaseClient();

    // Categories for icon rendering
    const { data: categoriesRes } = await svc
      .from('insight_categories')
      .select('name,image_url,position')
      .order('position', { ascending: true });
    const categories = (categoriesRes ?? []).map((c: Record<string, unknown>) => ({
      name: c.name as string,
      image: (c.image_url as string | null) ?? undefined,
    }));

    // Most recent published post
    const { data: postRes } = await svc
      .from('insight_posts')
      .select('id,slug,title,subtitle,content_html,hero_image_url,image_url,excerpt,published_at,read_time_minutes,is_draft,tier,insight_categories(name),insight_authors(name,title,avatar_url),related_post_ids')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!postRes) return { post: null, categories, relatedInsights: [] };

    const r = postRes as Record<string, unknown>;
    const formatDate = (dateStr?: string | null): string | undefined => {
      if (!dateStr) return undefined;
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const insightCats = r.insight_categories as { name?: string | null } | null;
    const insightAuthor = r.insight_authors as { name?: string | null; title?: string | null; avatar_url?: string | null } | null;

    const post = {
      id: String(r.id),
      title: (r.title as string) ?? '',
      subtitle: (r.subtitle as string | null) ?? undefined,
      date: formatDate(r.published_at as string | null),
      readTime: r.read_time_minutes ? `${r.read_time_minutes} min read` : undefined,
      category: insightCats?.name ?? '',
      author: {
        name: insightAuthor?.name ?? '',
        title: insightAuthor?.title ?? undefined,
        avatar: insightAuthor?.avatar_url ?? undefined,
        description: undefined,
      },
      heroImage: (r.hero_image_url as string | null) ?? (r.image_url as string | null) ?? undefined,
      contentHtml: (r.content_html as string) ?? '',
      excerptHtml: (r.excerpt as string | null) ?? undefined,
      tags: undefined,
      tier: ((r.tier as string | null) ?? undefined) as 'FREE' | 'PRO' | undefined,
    };

    // Related insights
    const { data: relRes } = await svc
      .from('insight_posts')
      .select('id,slug,title,subtitle,image_url,is_draft,published_at,insight_categories(name)')
      .eq('is_draft', false)
      .neq('slug', r.slug as string)
      .order('published_at', { ascending: false })
      .limit(3);

    type RelRow = { id: number; slug: string; title: string | null; subtitle?: string | null; image_url?: string | null; insight_categories?: { name?: string | null }[] | null };
    const relatedInsights = (relRes ?? []).map((ri: RelRow) => ({
      id: String(ri.id),
      title: ri.title ?? '',
      slug: ri.slug,
      category: ri.insight_categories?.[0]?.name ?? '',
      image: ri.image_url ?? undefined,
      subtitle: ri.subtitle ?? undefined,
    }));

    return { post, categories, relatedInsights };
  },
  'insights-client': async () => {
    const svc = getSupabaseClient();

    const { data: categoriesRes } = await svc
      .from('insight_categories')
      .select('name,image_url,position,is_active')
      .order('position', { ascending: true });

    const categories = [
      { name: 'All Insights', image: undefined as string | undefined },
      ...((categoriesRes ?? []) as Array<{ name: string; image_url?: string | null }>).map((c) => ({
        name: c.name,
        image: c.image_url ?? undefined,
      })),
    ];

    const { data: postsRes } = await svc
      .from('insight_posts')
      .select('id,slug,title,subtitle,badge,image_url,published_at,is_draft,tier,insight_categories(name),insight_authors(name,avatar_url)')
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(10);

    const formatDate = (dateStr?: string | null): string | undefined => {
      if (!dateStr) return undefined;
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

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

    const posts = ((postsRes ?? []) as PostRow[]).map((p) => {
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
        date: formatDate(p.published_at),
        image: p.image_url ?? undefined,
        slug: p.slug,
        tier: (p.tier ?? undefined) as 'FREE' | 'PRO' | undefined,
      };
    });

    const recentEssays = posts.slice(0, 4);

    return { data: { categories, posts, recentEssays } };
  },
  'aiux-patterns-client': async () => {
    // Stages come from static JSON — import it directly
    const stagesData = (await import('@/data/aiux_stages.json')).default as unknown as Array<Record<string, unknown>>;
    const stages = stagesData.map((stage: Record<string, unknown>) => ({
      ...stage,
      principles: ((stage.principles as Array<Record<string, unknown>>) ?? []).map((principle: Record<string, unknown>) => ({
        ...principle,
        patterns: ((principle.patterns as Array<Record<string, unknown>>) ?? []).map((pattern: Record<string, unknown>) => ({
          ...pattern,
          isLive: (pattern.isLive as boolean | undefined) ?? false,
          isNew: (pattern.isNew as boolean | undefined) ?? false,
          isFree: (pattern.isFree as boolean | undefined) ?? false,
        })),
      })),
    }));

    // Pattern example counts come from DB
    const svc = getSupabaseClient();
    const { data, error } = await svc
      .from('patterns_page')
      .select('slug,title,number_of_examples')
      .limit(50);

    const patternExamples: Record<string, { title: string; numberOfExamples: number }> = {};
    if (!error && data) {
      for (const item of data as Array<Record<string, unknown>>) {
        const slug = item.slug as string | null;
        if (!slug) continue;
        patternExamples[slug.toLowerCase()] = {
          title: (item.title as string) ?? '',
          numberOfExamples: typeof item.number_of_examples === 'number' ? item.number_of_examples : 0,
        };
      }
    }

    return { stages, patternExamples };
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
