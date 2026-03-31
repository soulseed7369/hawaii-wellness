import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { ArticleRow } from '@/types/database'
import { articleRowToArticle } from '@/lib/adapters'
import type { Article } from '@/data/mockData'

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data ? articleRowToArticle(data) : null
}

export async function getArticles(): Promise<Article[]> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(articleRowToArticle)
}
