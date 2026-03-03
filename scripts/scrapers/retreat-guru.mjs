import { chromium } from 'playwright';
const STUB_MODE = false;
const MAX_RESULTS = 100;

async function scrapeRetreatGuru() {
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
        website_url: "https://www.retreat.guru",
        status: "draft",
        owner_id: null,
        venue_name: "Sample Venue 1",
        start_date: "2024-06-15",
        end_date: "2024-06-20",
        starting_price: 1299,
        registration_url: "https://www.retreat.guru/retreats/1",
        description: "This is a sample retreat description for testing purposes. It should be truncated to 300 characters maximum.",
        _source_name: "retreat.guru",
        _source_url: "https://www.retreat.guru/retreats?country=united-states&state=hawaii",
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
        website_url: "https://www.retreat.guru",
        status: "draft",
        owner_id: null,
        venue_name: "Sample Venue 2",
        start_date: "2024-07-10",
        end_date: "2024-07-15",
        starting_price: 999,
        registration_url: "https://www.retreat.guru/retreats/2",
        description: "Another sample retreat description for testing. This one is also truncated to 300 characters maximum.",
        _source_name: "retreat.guru",
        _source_url: "https://www.retreat.guru/retreats?country=united-states&state=hawaii",
        _scraped_at: new Date().toISOString()
      }
    ];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.retreat.guru/retreats?country=united-states&state=hawaii', {
      waitUntil: 'networkidle'
    });
    
    const results = [];
    const retreatCards = await page.$$('.retreat-card');
    
    for (const card of retreatCards.slice(0, MAX_RESULTS)) {
      try {
        const title = await card.$eval('.retreat-title', el => el.textContent.trim());
        const venueName = await card.$eval('.venue-name', el => el.textContent.trim()).catch(() => null);
        const city = await card.$eval('.city', el => el.textContent.trim()).catch(() => null);
        const startDate = await card.$eval('.start-date', el => el.textContent.trim()).catch(() => null);
        const endDate = await card.$eval('.end-date', el => el.textContent.trim()).catch(() => null);
        const startingPrice = await card.$eval('.starting-price', el => {
          const text = el.textContent.trim();
          const match = text.match(/\$(\d+)/);
          return match ? parseInt(match[1]) : null;
        }).catch(() => null);
        const registrationUrl = await card.$eval('a', el => el.href).catch(() => null);
        const description = await card.$eval('.description', el => {
          const text = el.textContent.trim();
          return text.length > 300 ? text.substring(0, 300) + '...' : text;
        }).catch(() => null);
        
        results.push({
          type: "retreat",
          name: title,
          title: title,
          island: "big_island",
          city: city || null,
          region: null,
          address: null,
          phone: null,
          email: null,
          website_url: "https://www.retreat.guru",
          status: "draft",
          owner_id: null,
          venue_name: venueName || null,
          start_date: startDate ? new Date(startDate).toISOString().split('T')[0] : null,
          end_date: endDate ? new Date(endDate).toISOString().split('T')[0] : null,
          starting_price: startingPrice,
          registration_url: registrationUrl,
          description: description || null,
          _source_name: "retreat.guru",
          _source_url: "https://www.retreat.guru/retreats?country=united-states&state=hawaii",
          _scraped_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error scraping card:', error.message);
        continue;
      }
    }
    
    await browser.close();
    return results;
  } catch (error) {
    console.error('Error during scraping:', error.message);
    await browser.close();
    process.exit(1);
  }
}

scrapeRetreatGuru().then(results => {
  console.log(JSON.stringify(results, null, 2));
});