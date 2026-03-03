import fetch from 'node-fetch';
import { load } from 'cheerio';

const STUB_MODE = false;
const MAX_RESULTS = 100;

const SOURCES = [
  { name: "Big Island Now", url: "https://bigislandnow.com/category/health-wellness/", type: "practitioner" },
  { name: "Hawaii Life", url: "https://www.hawaiilife.com/articles/category/health-wellness", type: "practitioner" },
  { name: "Kona Coast Wellness", url: "https://www.konacoastwellness.com", type: "center" }
];

async function scrapeSource(source) {
  if (STUB_MODE) {
    return [
      {
        type: source.type,
        name: `${source.name} Sample`,
        island: "big_island",
        city: null,
        region: null,
        address: null,
        phone: null,
        email: null,
        website_url: source.url,
        modalities: [],
        status: "draft",
        owner_id: null,
        _source_name: source.name,
        _source_url: source.url,
        _scraped_at: new Date().toISOString()
      }
    ];
  }

  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    const results = [];
    
    // Generic scraping logic - would need to be customized per source
    if (source.type === "practitioner") {
      // Example for Big Island Now - adjust selectors as needed
      $('article h2 a').each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        const name = $(el).text().trim();
        if (name) {
          results.push({
            type: source.type,
            name,
            island: "big_island",
            city: null,
            region: null,
            address: null,
            phone: null,
            email: null,
            website_url: source.url,
            modalities: [],
            status: "draft",
            owner_id: null,
            _source_name: source.name,
            _source_url: source.url,
            _scraped_at: new Date().toISOString()
          });
        }
      });
    } else if (source.type === "center") {
      // Example for Kona Coast Wellness - adjust selectors as needed
      $('.center-listing h3').each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        const name = $(el).text().trim();
        if (name) {
          results.push({
            type: source.type,
            name,
            island: "big_island",
            city: null,
            region: null,
            address: null,
            phone: null,
            email: null,
            website_url: source.url,
            modalities: [],
            status: "draft",
            owner_id: null,
            _source_name: source.name,
            _source_url: source.url,
            _scraped_at: new Date().toISOString()
          });
        }
      });
    }
    
    return results;
  } catch (error) {
    console.warn(`Error scraping ${source.name}:`, error.message);
    return [];
  }
}

async function main() {
  const allResults = [];
  
  for (const source of SOURCES) {
    if (allResults.length >= MAX_RESULTS) break;
    
    const results = await scrapeSource(source);
    allResults.push(...results);
  }
  
  // Limit to MAX_RESULTS
  const finalResults = allResults.slice(0, MAX_RESULTS);
  
  console.log(JSON.stringify(finalResults, null, 2));
}

main();
