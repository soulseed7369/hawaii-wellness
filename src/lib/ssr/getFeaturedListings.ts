import { createServerSupabaseClient } from '@/lib/supabase-server';
import { practitionerRowToProvider, centerRowToCenter } from '@/lib/adapters';
import { Provider, Center } from '@/data/mockData';

const DISPLAY_SLOTS = 4;

export async function getHomePractitioners(island: string) {
  const supabase = createServerSupabaseClient();
  
  if (!supabase) {
    return { data: [], totalCount: 0, claimedCount: 0 };
  }

  try {
    // Query 1: Get featured and premium practitioners
    const { data: practitioners, error } = await supabase
      .from('practitioners')
      .select(`*, business:centers!practitioners_business_id_fkey(id,name)`)
      .eq('island', island)
      .eq('status', 'published')
      .in('tier', ['featured', 'premium'])
      .order('name');

    if (error) {
      return { data: [], totalCount: 0, claimedCount: 0 };
    }

    const prioritized = practitioners
      .map((row: any) => practitionerRowToProvider(row))
      .filter(Boolean);

    // If we have enough featured/premium, skip free query
    if (prioritized.length >= DISPLAY_SLOTS) {
      const data = prioritized.slice(0, DISPLAY_SLOTS);
      
      // Count queries
      const { count: totalCount } = await supabase
        .from('practitioners')
        .select('id', { count: 'exact', head: true })
        .eq('island', island)
        .eq('status', 'published');
      
      const { count: claimedCount } = await supabase
        .from('practitioners')
        .select('id', { count: 'exact', head: true })
        .eq('island', island)
        .eq('status', 'published')
        .not('owner_id', 'is', null);

      return { data, totalCount, claimedCount };
    }

    // Query 2: Get free practitioners
    const { data: freePractitioners } = await supabase
      .from('practitioners')
      .select(`*, business:centers!practitioners_business_id_fkey(id,name)`)
      .eq('island', island)
      .eq('status', 'published')
      .or('tier.eq.free,tier.is.null')
      .limit(50);

    const freeMapped = freePractitioners
      .map((row: any) => practitionerRowToProvider(row))
      .filter(Boolean);

    // Shuffle and take remaining slots
    const shuffled = [...freeMapped].sort(() => 0.5 - Math.random());
    const remainingCount = DISPLAY_SLOTS - prioritized.length;
    const freeShuffled = shuffled.slice(0, remainingCount);

    const data = [...prioritized, ...freeShuffled];

    // Count queries
    const { count: totalCount } = await supabase
      .from('practitioners')
      .select('id', { count: 'exact', head: true })
      .eq('island', island)
      .eq('status', 'published');
    
    const { count: claimedCount } = await supabase
      .from('practitioners')
      .select('id', { count: 'exact', head: true })
      .eq('island', island)
      .eq('status', 'published')
      .not('owner_id', 'is', null);

    return { data, totalCount, claimedCount };
  } catch (error) {
    return { data: [], totalCount: 0, claimedCount: 0 };
  }
}

export async function getHomeCenters(island: string) {
  const supabase = createServerSupabaseClient();
  
  if (!supabase) {
    return { data: [], totalCount: 0 };
  }

  try {
    // Query 1: Get featured and premium centers
    const { data: centers, error } = await supabase
      .from('centers')
      .select('*')
      .eq('island', island)
      .eq('status', 'published')
      .in('tier', ['featured', 'premium'])
      .order('name');

    if (error) {
      return { data: [], totalCount: 0 };
    }

    const prioritized = centers
      .map((row: any) => centerRowToCenter(row))
      .filter(Boolean);

    // If we have enough featured/premium, skip free query
    if (prioritized.length >= DISPLAY_SLOTS) {
      const data = prioritized.slice(0, DISPLAY_SLOTS);
      
      // Count query
      const { count: totalCount } = await supabase
        .from('centers')
        .select('id', { count: 'exact', head: true })
        .eq('island', island)
        .eq('status', 'published');

      return { data, totalCount };
    }

    // Query 2: Get free centers
    const { data: freeCenters } = await supabase
      .from('centers')
      .select('*')
      .eq('island', island)
      .eq('status', 'published')
      .or('tier.eq.free,tier.is.null')
      .limit(50);

    const freeMapped = freeCenters
      .map((row: any) => centerRowToCenter(row))
      .filter(Boolean);

    // Shuffle and take remaining slots
    const shuffled = [...freeMapped].sort(() => 0.5 - Math.random());
    const remainingCount = DISPLAY_SLOTS - prioritized.length;
    const freeShuffled = shuffled.slice(0, remainingCount);

    const data = [...prioritized, ...freeShuffled];

    // Count query
    const { count: totalCount } = await supabase
      .from('centers')
      .select('id', { count: 'exact', head: true })
      .eq('island', island)
      .eq('status', 'published');

    return { data, totalCount };
  } catch (error) {
    return { data: [], totalCount: 0 };
  }
}