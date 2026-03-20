import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { articleRowToArticle } from '@/lib/adapters';
import type { Article } from '@/data/mockData';

/**
 * Fetch up to 3 published articles whose tags overlap with the given modalities.
 * Falls back to featured articles if no modality match found.
 */
export function useArticlesByModality(modalities: string[], enabled = true) {
  return useQuery<Article[]>({
    queryKey: ['articlesByModality', modalities],
    enabled: enabled && modalities.length > 0,
    queryFn: async () => {
      if (!supabase) return [];
      // Try overlap match first
      const { data: overlap } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .overlaps('tags', modalities)
        .order('published_at', { ascending: false })
        .limit(3);
      if (overlap && overlap.length > 0) return overlap.map(articleRowToArticle);
      // Fallback: featured articles
      const { data: featured } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .eq('featured', true)
        .order('published_at', { ascending: false })
        .limit(3);
      return (featured ?? []).map(articleRowToArticle);
    },
    staleTime: 1000 * 60 * 10,
  });
}
