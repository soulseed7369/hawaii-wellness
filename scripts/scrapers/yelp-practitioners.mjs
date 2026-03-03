import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const STUB_MODE = false;
const MAX_RESULTS = 100;
const DELAY_MS = 1500;

const SEARCH_URLS = [
  'https://www.yelp.com/search?find_desc=holistic+health&find_loc=Hilo%2C+HI',
  'https://www.yelp.com/search?find_desc=acupuncture&find_loc=Kailua-Kona%2C+HI',
  'https://www.yelp.com/search?find_desc=massage+therapy&find_loc=Hilo%2C+HI',
  'https://www.yelp.com/search?find_desc=yoga+studio&find_loc=Kailua-Kona%2C+HI',
  'https://www.yelp.com/search?find_desc=naturopathic+doctor&find_loc=Big+Island%2C+HI'
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractCity(address) {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[1].trim();
  }
  return null;
}

function getStubData() {
  const now = new Date().toISOString();
  return [
    {
      type: 'practitioner',
      name: 'Sample Holistic Health Center',
      island: 'big_island',
      city: 'Hilo',
      region: null,
      address: '123 Main St, Hilo, HI 96720',
      phone: '(808) 555-0100',
      email: null,
      website_url: 'https://example.com/holistic',
      modalities: ['Holistic Medicine', 'Wellness'],
      status: 'draft',
      owner_id: null,
      rating: 4.5,
      review_count: 42,
      yelp_url: 'https://www.yelp.com/biz/sample-holistic-health-center-hilo',
      _source_name: 'yelp',
      _source_url: SEARCH_URLS[0],
      _scraped_at: now
    },
    {
      type: 'practitioner',
      name: 'Kona Acupuncture Clinic',
      island: 'big_island',
      city: 'Kailua-Kona',
      region: null,
      address: '456 Ocean View Ave, Kailua-Kona, HI 96740',
      phone: '(808) 555-0101',
      email: null,
      website_url: 'https://example.com/acupuncture',
      modalities: ['Acupuncture', 'Traditional Chinese Medicine'],
      status: 'draft',
      owner_id: null,
      rating: 4.8,
      review_count: 67,
      yelp_url: 'https://www.yelp.com/biz/kona-acupuncture-clinic-kona',
      _source_name: 'yelp',
      _source_url: SEARCH_URLS[1],
      _scraped_at: now
    },
    {
      type: 'practitioner',
      name: 'Hilo Massage Therapy Studio',
      island: 'big_island',
      city: 'Hilo',
      region: null,
      address: '789 Wellness Blvd, Hilo, HI 96720',
      phone: '(808) 555-0102',
      email: null,
      website_url: 'https://example.com/massage',
      modalities: ['Massage Therapy', 'Deep Tissue Massage'],
      status: 'draft',
      owner_id: null,
      rating: 4.6,
      review_count: 53,
      yelp_url: 'https://www.yelp.com/biz/hilo-massage-therapy-studio-hilo',
      _source_name: 'yelp',
      _source_url: SEARCH_URLS[2],
      _scraped_at: now
    }
  ];
}

async function fetchAndParse(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Warning: HTTP ${response.status} for ${url}`);
      return null;
    }
    const html = await response.text();
    return cheerio.load(html);
  } catch (error) {
    console.warn(`Warning: Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

function parseListings($, searchUrl) {
  const results = [];
  const now = new Date().toISOString();
  const seenNames = new Set();

  $('[data-testid="search-result-list-item"]').each((idx, elem) => {
    try {
      const $item = $(elem);

      const nameElem = $item.find('[data-testid="listing-name"]');
      const name = nameElem.text().trim();
      if (!name || seenNames.has(name)) return;
      seenNames.add(name);

      const addressElem = $item.find('[data-testid="address-text"]');
      const address = addressElem.text().trim() || null;
      const city = extractCity(address);

      const phoneElem = $item.find('[data-testid="phone-number"]');
      const phone = phoneElem.text().trim() || null;

      const ratingElem = $item.find('[role="img"]').filter((i, el) => {
        const title = $(el).attr('aria-label');
        return title && title.includes('star');
      });
      let rating = null;
      if (ratingElem.length > 0) {
        const ratingText = ratingElem.first().attr('aria-label');
        const match = ratingText.match(/(\d+\.?\d*)\s+star/);
        if (match) {
          rating = parseFloat(match[1]);
        }
      }

      const reviewCountElem = $item.find('[data-testid="review-count"]');
      let reviewCount = null;
      const reviewText = reviewCountElem.text().match(/\d+/);
      if (reviewText) {
        reviewCount = parseInt(reviewText[0]);
      }

      const categoryElements = $item.find('[data-testid="business-category"]');
      const modalities = [];
      categoryElements.each((i, el) => {
        const cat = $(el).text().trim();
        if (cat) modalities.push(cat);
      });

      const linkElem = nameElem.closest('a');
      let yelpUrl = '';
      if (linkElem.length > 0) {
        const href = linkElem.attr('href');
        yelpUrl = href && !href.startsWith('http') ? `https://www.yelp.com${href}` : href || '';
      }

      const websiteElem = $item.find('[data-testid="business-website"]');
      const websiteUrl = websiteElem.attr('href') || null;

      const record = {
        type: 'practitioner',
        name,
        island: 'big_island',
        city,
        region: null,
        address,
        phone,
        email: null,
        website_url: websiteUrl,
        modalities,
        status: 'draft',
        owner_id: null,
        rating,
        review_count: reviewCount,
        yelp_url: yelpUrl,
        _source_name: 'yelp',
        _source_url: searchUrl,
        _scraped_at: now
      };

      results.push(record);
    } catch (error) {
      console.warn(`Warning: Error parsing listing: ${error.message}`);
    }
  });

  return results;
}

async function scrape() {
  if (STUB_MODE) {
    return getStubData();
  }

  const allResults = [];
  const seenNames = new Set();

  for (const searchUrl of SEARCH_URLS) {
    if (allResults.length >= MAX_RESULTS) break;

    console.error(`Fetching: ${searchUrl}`);
    const $ = await fetchAndParse(searchUrl);

    if ($) {
      const listings = parseListings($, searchUrl);
      for (const listing of listings) {
        if (allResults.length >= MAX_RESULTS) break;
        if (!seenNames.has(listing.name)) {
          seenNames.add(listing.name);
          allResults.push(listing);
        }
      }
    }

    await delay(DELAY_MS);
  }

  return allResults;
}

const results = await scrape();
console.log(JSON.stringify(results, null, 2));
