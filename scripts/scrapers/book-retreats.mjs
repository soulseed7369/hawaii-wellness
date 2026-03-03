import fetch from 'node-fetch';
import { load } from 'cheerio';

const STUB_MODE = false;
const MAX_RESULTS = 100;

async function scrapeBookRetreats() {
  if (STUB_MODE) {
    return [
      {
        type: "retreat",
        name: "Sample Retreat 1",
        title: "Sample Retreat 1",
        island: "big_island",
        city: "Hilo",
        region: null,
        address: null,
        phone: null,
        email: null,
        website_url: "https://bookretreats.com",
        status: "draft",
        owner_id: null,
        venue_name: "Sample Venue 1",
        start_date: null,
        end_date: null,
        starting_price: 499,
        registration_url: "https://bookretreats.com/sample1",
        description: "This is a sample retreat description for testing purposes. It should be limited to about 300 characters to test the truncation logic.",
        _source_name: "bookretreats.com",
        _source_url: "https://bookretreats.com/s/hawaii-retreats",
        _scraped_at: new Date().toISOString()
      },
      {
        type: "retreat",
        name: "Sample Retreat 2",
        title: "Sample Retreat 2",
        island: "big_island",
        city: "Kailua-Kona",
        region: null,
        address: null,
        phone: null,
        email: null,
        website_url: "https://bookretreats.com",
        status: "draft",
        owner_id: null,
        venue_name: "Sample Venue 2",
        start_date: null,
        end_date: null,
        starting_price: 399,
        registration_url: "https://bookretreats.com/sample2",
        description: "Another sample retreat description to ensure the scraper handles multiple entries correctly and maintains proper data structure.",
        _source_name: "bookretreats.com",
        _source_url: "https://bookretreats.com/s/hawaii-retreats",
        _scraped_at: new Date().toISOString()
      }
    ];
  }

  const url = 'https://bookretreats.com/s/hawaii-retreats';
  const results = [];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    $('.retreat-listing').each((index, element) => {
      if (results.length >= MAX_RESULTS) return false;

      const title = $(element).find('.retreat-title').text().trim();
      const venueName = $(element).find('.venue-name').text().trim() || null;
      const city = $(element).find('.city').text().trim() || null;
      const priceText = $(element).find('.price').text().trim();
      const startingPrice = priceText ? parseFloat(priceText.replace(/[^0-9.-]/g, '')) : null;
      const registrationUrl = $(element).find('.register-button').attr('href') || '';
      const description = $(element).find('.description').text().trim() || null;
      
      // Truncate description to 300 characters if needed
      const truncatedDescription = description ? 
        (description.length > 300 ? description.substring(0, 300) : description) : 
        null;

      results.push({
        type: "retreat",
        name: title,
        title: title,
        island: "big_island",
        city: city,
        region: null,
        address: null,
        phone: null,
        email: null,
        website_url: "https://bookretreats.com",
        status: "draft",
        owner_id: null,
        venue_name: venueName,
        start_date: null,
        end_date: null,
        starting_price: startingPrice,
        registration_url: registrationUrl,
        description: truncatedDescription,
        _source_name: "bookretreats.com",
        _source_url: url,
        _scraped_at: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Error scraping bookretreats.com:', error);
    process.exit(1);
  }

  return results;
}

scrapeBookRetreats().then(results => {
  console.log(JSON.stringify(results, null, 2));
});
