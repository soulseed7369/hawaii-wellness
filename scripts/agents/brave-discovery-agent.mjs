import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// CONFIG CONSTANTS
const MAX_URLS_TOTAL = 600;
const MAX_URLS_PER_QUERY = 15;
const MAX_QUERIES_PER_TYPE = 4;
const DELAY_BETWEEN_QUERIES_MS = 1200;
const OUTPUT_DIR = 'data/discovery';

// PRACTITIONER TYPES
const PRACTITIONER_TYPES = [
  'acupuncturist', 'somatic therapist', 'reiki', 'energy healer', 'massage therapist',
  'astrologer', 'rolfing', 'attachment repair', 'somatic experiencing', 'meditation teacher',
  'soul guide', 'psychologist', 'therapist LMFT LCSW', 'chiropractor', 'naturopathic doctor',
  'wellness center', 'integrative medicine'
];

// BIG ISLAND TOWNS
const BIG_ISLAND_TOWNS = [
  'Kailua-Kona', 'Kona', 'Kealakekua', 'Captain Cook', 'Waikoloa', 'Waikoloa Village',
  'Hilo', 'Pahoa', 'Keaau', 'Mountain View', 'Waimea', 'Honokaa', 'Ocean View', 'Naalehu'
];

// BIG ISLAND ZIP CODES
const BIG_ISLAND_ZIP_CODES = [
  96720, 96740, 96743, 96745, 96750, 96755, 96760, 96771, 96772, 96773, 96774, 96776, 96778, 96781
];

// QUERY GENERATION PATTERNS
const QUERY_PATTERNS = [
  '{type} \'{town}\' Hawaii',
  '{type} "Big Island" Hawaii',
  '{type} "Kona" Hawaii',
  '{type} "Hilo" Hawaii'
];

// HIGH PRIORITY TOWNS FOR QUERY GENERATION
const HIGH_PRIORITY_TOWNS = ['Kailua-Kona', 'Hilo', 'Waimea'];

// FILTERS
const EXCLUDE_DOMAINS = [
  /yelp\.com\/search/i,
  /google\.com\/maps/i,
  /facebook\.com/i,
  /instagram\.com/i,
  /twitter\.com/i,
  /linkedin\.com/i,
  /youtube\.com/i,
  /pinterest\.com/i
];

const EXCLUDE_PATHS = [
  /\/news$/i,
  /\/blog$/i,
  /\/article$/i
];

const EXCLUDE_CITIES = [
  'oahu', 'honolulu', 'maui', 'kauai', 'lahaina', 'waikiki'
];

// UTILITY FUNCTIONS
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadEnv() {
  try {
    const envContent = readFileSync('.env.local', 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        env[key.trim()] = value?.trim() || '';
      }
    });
    return env;
  } catch (err) {
    console.error('Failed to load .env.local:', err.message);
    return {};
  }
}

function townDetection(url, title, snippet) {
  const text = `${url} ${title} ${snippet}`.toLowerCase();
  for (const town of BIG_ISLAND_TOWNS) {
    if (text.includes(town.toLowerCase())) {
      return town;
    }
  }
  return null;
}

function scoreUrl(url, title, snippet, domain) {
  let score = 0.1;
  const text = `${url} ${title} ${snippet}`.toLowerCase();
  
  const townMatch = townDetection(url, title, snippet);
  if (townMatch) score += 0.4;
  
  if (text.includes('big island')) score += 0.3;
  
  const isGenericDomain = EXCLUDE_DOMAINS.some(pattern => pattern.test(domain));
  if (!isGenericDomain) score += 0.2;
  
  const urlPath = new URL(url).pathname.toLowerCase();
  if (BIG_ISLAND_TOWNS.some(town => urlPath.includes(town.toLowerCase()))) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

function shouldIncludeUrl(url, title, snippet) {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  
  // Exclude based on domain
  if (EXCLUDE_DOMAINS.some(pattern => pattern.test(url))) return false;
  
  // Exclude based on path
  if (EXCLUDE_PATHS.some(pattern => pattern.test(url))) return false;
  
  // Exclude based on city mentions
  if (EXCLUDE_CITIES.some(city => lowerUrl.includes(city) || lowerTitle.includes(city) || lowerSnippet.includes(city))) {
    // Allow if it's a Big Island town
    const townMatch = townDetection(url, title, snippet);
    if (!townMatch) return false;
  }
  
  // Include if it's a Big Island town or looks like a practitioner site
  const hasBigIslandTown = townDetection(url, title, snippet);
  const isGenericSite = EXCLUDE_DOMAINS.some(pattern => pattern.test(url));
  
  return hasBigIslandTown || !isGenericSite;
}

async function fetchBraveSearch(query, apiKey) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.append('q', query);
  url.searchParams.append('count', MAX_URLS_PER_QUERY);
  url.searchParams.append('result_filter', 'web');
  
  const headers = {
    Accept: 'application/json',
    'X-Subscription-Token': apiKey
  };
  
  try {
    const response = await fetch(url, { headers });
    if (response.status !== 200) {
      console.warn(`Brave API returned status ${response.status} for query: ${query}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`Error fetching Brave search for query "${query}":`, err.message);
    return null;
  }
}

async function saveResultsToFile(results, filename) {
  try {
    const filePath = path.join(OUTPUT_DIR, filename);
    let existingData = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist or is invalid, that's fine
    }
    
    const mergedData = [...existingData, ...results];
    await fs.writeFile(filePath, JSON.stringify(mergedData, null, 2));
  } catch (err) {
    console.error(`Failed to save results to ${filename}:`, err.message);
  }
}

async function generateReport(results) {
  const report = {
    total_urls: results.length,
    urls_by_type: {},
    urls_by_town: {},
    top_domains: [],
    weak_coverage_types: [],
    towns_with_low_coverage: [],
    recommended_next_queries: [],
    generated_at: new Date().toISOString()
  };
  
  // Group by type
  for (const result of results) {
    const type = result.practitioner_type;
    report.urls_by_type[type] = (report.urls_by_type[type] || 0) + 1;
  }
  
  // Group by town
  for (const result of results) {
    const town = result.town_detected;
    if (town) {
      report.urls_by_town[town] = (report.urls_by_town[town] || 0) + 1;
    }
  }
  
  // Top domains
  const domainCounts = {};
  for (const result of results) {
    const domain = result.domain;
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
  report.top_domains = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Weak coverage types
  report.weak_coverage_types = Object.entries(report.urls_by_type)
    .filter(([_, count]) => count < 3)
    .map(([type, _]) => type);
  
  // Towns with low coverage
  report.towns_with_low_coverage = Object.entries(report.urls_by_town)
    .filter(([_, count]) => count < 2)
    .map(([town, _]) => town);
  
  // Recommended next queries
  const typeCounts = {};
  for (const result of results) {
    const type = result.practitioner_type;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  
  const typesWithFewerThanMax = Object.entries(typeCounts)
    .filter(([_, count]) => count < MAX_QUERIES_PER_TYPE)
    .map(([type, _]) => type);
  
  const recommendedQueries = [];
  for (const type of typesWithFewerThanMax) {
    const patterns = QUERY_PATTERNS.slice(0, MAX_QUERIES_PER_TYPE);
    for (const pattern of patterns) {
      const town = HIGH_PRIORITY_TOWNS[0];
      recommendedQueries.push(pattern.replace('{type}', type).replace('{town}', town));
    }
  }
  report.recommended_next_queries = recommendedQueries.slice(0, 10);
  
  return report;
}

async function main() {
  const env = loadEnv();
  const BRAVE_API_KEY = env.BRAVE_API_KEY;
  
  if (!BRAVE_API_KEY) {
    console.error('BRAVE_API_KEY is required in .env.local');
    process.exit(1);
  }
  
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Load existing results if any
  let allResults = [];
  try {
    const fileContent = await fs.readFile(path.join(OUTPUT_DIR, 'brave_discovery_results_big_island.json'), 'utf8');
    allResults = JSON.parse(fileContent);
  } catch (err) {
    // File doesn't exist or is invalid, that's fine
  }
  
  const seenUrls = new Set(allResults.map(r => r.url));
  let totalUrls = allResults.length;
  
  // Process each practitioner type
  for (const type of PRACTITIONER_TYPES) {
    if (totalUrls >= MAX_URLS_TOTAL) break;
    
    // Skip if already have enough results for this type
    const typeResults = allResults.filter(r => r.practitioner_type === type);
    if (typeResults.length >= MAX_QUERIES_PER_TYPE) continue;
    
    const queries = [];
    let queryCount = 0;
    
    for (const pattern of QUERY_PATTERNS) {
      if (queryCount >= MAX_QUERIES_PER_TYPE) break;
      
      for (const town of HIGH_PRIORITY_TOWNS) {
        if (queryCount >= MAX_QUERIES_PER_TYPE) break;
        const query = pattern.replace('{type}', type).replace('{town}', town);
        queries.push(query);
        queryCount++;
      }
    }
    
    for (const query of queries) {
      if (totalUrls >= MAX_URLS_TOTAL) break;
      
      await delay(DELAY_BETWEEN_QUERIES_MS);
      const data = await fetchBraveSearch(query, BRAVE_API_KEY);
      if (!data || !data.web) continue;
      
      const results = data.web.results || [];
      for (const item of results) {
        if (totalUrls >= MAX_URLS_TOTAL) break;
        
        const url = item.url;
        const title = item.title || '';
        const snippet = item.description || '';
        
        // Skip if already seen
        if (seenUrls.has(url)) continue;
        
        // Filter
        if (!shouldIncludeUrl(url, title, snippet)) continue;
        
        // Score
        const domain = new URL(url).hostname;
        const confidenceScore = scoreUrl(url, title, snippet, domain);
        const townDetected = townDetection(url, title, snippet);
        
        // Add to results
        allResults.push({
          practitioner_type: type,
          query_used: query,
          url,
          domain,
          title,
          snippet,
          town_detected: townDetected,
          confidence_score: confidenceScore
        });
        
        seenUrls.add(url);
        totalUrls++;
      }
    }
    
    // Save checkpoint
    await saveResultsToFile(allResults.filter(r => r.practitioner_type === type), 'brave_discovery_results_big_island.json');
  }
  
  // Generate and save report
  const report = await generateReport(allResults);
  await saveResultsToFile([report], 'brave_discovery_report_big_island.json');
  
  // Print summary
  console.log(`\nDiscovery complete.`);
  console.log(`Total URLs found: ${report.total_urls}`);
  console.log(`Breakdown by type:`);
  for (const [type, count] of Object.entries(report.urls_by_type)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nOutput files:`);
  console.log(`  ${path.join(OUTPUT_DIR, 'brave_discovery_results_big_island.json')}`);
  console.log(`  ${path.join(OUTPUT_DIR, 'brave_discovery_report_big_island.json')}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
