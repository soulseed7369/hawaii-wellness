import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { articleRowToArticle } from '@/lib/adapters';
import { mockArticles, type Article } from '@/data/mockData';

/**
 * Returns published articles, featured first, then by published_at desc.
 * Falls back to mockArticles when Supabase is not configured.
 */
export function useArticles() {
  return useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: async () => {
      if (!supabase) return mockArticles;

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .order('featured', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(articleRowToArticle);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Returns a single published article by slug.
 * Falls back to mockArticles when Supabase is not configured.
 */
export function useArticleBySlug(slug: string) {
  return useQuery<Article | null>({
    queryKey: ['article', slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!supabase) {
        return mockArticles.find(a => a.slug === slug) ?? null;
      }

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw error;
      }
      return data ? articleRowToArticle(data) : null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
