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
        .order('featured', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(articleRowToArticle);
    },
    staleTime: 1000 * 60 * 5,
  });
}
