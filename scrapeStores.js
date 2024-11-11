import axios from 'axios';
import * as cheerio from 'cheerio';
import { getCache, setCache } from './cache.js';
import dotenv from 'dotenv';

dotenv.config();

const urls = {
  dgStore: 'https://www.discgolfstore.de/search/?qs={{query}}&af=96',
  thrownatur: 'https://thrownatur-discgolf.de/de/advanced_search_result.php?keywords={{query}}&listing_count=288',
  crosslap: 'https://www.discgolf-shop.de/advanced_search_result.php?keywords={{query}}&listing_count=1200',
  frisbeeshop: 'https://www.frisbeeshop.com/search?search={{query}}&order=topseller&limit=100',
  insidethecircle: 'https://www.inside-the-circle.de/search/suggest.json?q={{query}}',
  chooseyourdisc: 'https://www.chooseyourdisc.com/search/suggest.json?q={{query}}',
  discwolf: 'https://www.discwolf.com/search/suggest.json?q={{query}}',
  birdieShop: 'https://www.birdie-shop.com/search?q={{query}}',
  discgolf4you: 'https://discgolf4you.com/page/{{page}}/?s={{query}}&post_type=product',
  hyzerStore: 'https://www.hyzer-store.de/page/{{page}}/?s={{query}}&post_type=product'
}

const crawledAt = new Date().toISOString();

async function scrapeStores(type, query) {
  switch (type) {
    case 'discgolfstore':
      return scrapeDGStore(query);
    case 'thrownatur':
      return scrapeThrownatur(query);
    case 'crosslap':
      return scrapeCrosslap(query);
    case 'frisbeeshop':
      return scrapeFrisbeeshop(query);
    case 'insidethecircle':
      return scrapeInsideTheCircle(query);
    case 'chooseyourdisc':
      return scrapeChooseYourDisc(query);
    case 'discwolf':
      return scrapeDiscWolf(query);
    case 'birdieshop':
      return scrapeBirdieShop(query);
    case 'discgolf4you':
      return scrapeDiscgolf4You(query);
    case 'hyzerstore':
      return scrapeHyzerStore(query);
    default:
      return `Invalid Store Identifier. Try one of the following: ${Object.keys(urls).join(', ').toLowerCase()}.`;
  }
}

function filterProducts(products, query) {
  if (!products.length) return [];
  const queryWords = query.toLowerCase().split(' ');
  // remove products that don't contain not all of the query words
  return products.filter(product => {
    const title = (product.title + (product.vendor ? ' ' + product.vendor : '')).toLowerCase();
    return queryWords.every(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      return regex.test(title);
    });
  });
}

async function scrapeDGStore(query) {
  const url = urls.dgStore.replace('{{query}}', query);
  const html = await axios.get(url).then(res => res.data);
  const $ = cheerio.load(html);
  const products = [];
  const isPDP = $('.product-detail').length > 0;

  if (isPDP) {
    products.push({
      title: $('.product-title').text()?.trim(),
      price: formatPrice($('meta[itemprop="price"]').attr('content')),
      image: $('meta[itemprop="image"]').attr('content')?.trim(),
      store: 'discgolfstore',
      url: $('.breadcrumb-item.active a').attr('href')?.trim(),
      stockStatus: 'available',
      crawledAt: crawledAt
    });
  } else {
    $('.product-wrapper').each((i, el) => {
      products.push({
        title: $(el).find('.productbox-title a').text()?.trim(),
        price: formatPrice($(el).find('meta[itemprop="price"]').attr('content')),
        image: $(el).find('meta[itemprop="image"]').attr('content')?.trim(),
        store: 'discgolfstore',
        url: $(el).find('.productbox-title a').attr('href')?.trim(),
        stockStatus: 'available',
        crawledAt: crawledAt
      });
    });
  }
  return filterProducts(products, query);
}

async function scrapeThrownatur(query) {
  const url = urls.thrownatur.replace('{{query}}', query);
  const html = await axios.get(url).then(res => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-container').each((i, el) => {
    const $price = $(el).find('.current-price-container').text()?.toLowerCase().trim();
    const priceCleaned = $price.includes('nur') ? $price.split('nur')[1] : $price;
    const price = parseInt([...priceCleaned].filter(char => parseInt(char) > -1).join(''));
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus = stockStatusIcon?.includes('bestellbar') ? 'available' : stockStatusIcon?.includes('gray') ? 'unknown' : 'unavailable';
    products.push({
      title: $(el).find('.product-url').text()?.trim(),
      price: price,
      image: 'https://thrownatur-discgolf.de/' + $(el).find('.product-image img').attr('src')?.replace('thumbnail_images', 'info_images').trim(),
      store: 'thrownatur',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      flightNumbers: {
        speed: $(el).find('.title-description .disc-guide-display-speed').text() || null,
        glide: $(el).find('.title-description .disc-guide-display-glide').text() || null,
        turn: $(el).find('.title-description .disc-guide-display-turn').text() || null,
        fade: $(el).find('.title-description .disc-guide-display-fade').text() || null,
      },
      stockStatus: stockStatus,
      crawledAt: crawledAt
    });
  });
  return filterProducts(products, query);
}

async function scrapeCrosslap(query) {
  const url = urls.crosslap.replace('{{query}}', query);
  const html = await axios.get(url).then(res => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-container').each((i, el) => {
    $(el).find('.productOldPrice').remove();
    const price = parseInt([...$(el).find('.current-price-container').text()?.trim()].filter(char => parseInt(char) > -1).join(''));
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus = stockStatusIcon?.includes('/status/1') && !$(el).find('.ribbon-sold-out').length ? 'available' : 'unavailable';

    const flightString = $(el).find('.description').text().trim();
    const flightRegex = /Speed (-?\d+), Glide (-?\d+), Turn (-?\d+), Fade (-?\d+)/;
    const flightMatch = flightString?.match(flightRegex);
    products.push({
      title: $(el).find('.product-url ').text()?.trim(),
      price: price,
      image: 'https://discgolf-shop.de/' + $(el).find('.product-image img').attr('src')?.trim(),
      store: 'crosslap',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      flightNumbers: flightMatch ? {
        speed: flightMatch[1],
        glide: flightMatch[2],
        turn: flightMatch[3],
        fade: flightMatch[4],
      } : {},
      stockStatus: stockStatus,
      crawledAt: crawledAt
    });
  });
  return filterProducts(products, query);
}

async function scrapeFrisbeeshop(query) {
  const url = urls.frisbeeshop.replace('{{query}}', query);
  const html = await axios.get(url).then(res => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-box').each((i, el) => {
    const price = parseInt([...$(el).find('.product-price').text().split('€')[0]?.trim()].filter(char => parseInt(char) > -1).join(''));
    products.push({
      title: $(el).find('a.product-name').text()?.trim(),
      price: price,
      image: $(el).find('.product-image-wrapper img').attr('srcset')?.trim()?.split(' 400w')[0]?.split('800w, ')[1] || $(el).find('.product-image-wrapper img').attr('src')?.trim(),
      store: 'frisbeeshop',
      url: $(el).find('a.product-name').attr('href')?.trim(),
      stockStatus: 'unknown',
      crawledAt: crawledAt
    });
  });
  return filterProducts(products, query);
}

async function scrapeInsideTheCircle(query) {
  const url = urls.insidethecircle.replace('{{query}}', query);
  const products = await fetch(url).then(response => response.json()).then(searchData => {
    return searchData.resources.results.products.map(product => {
      const flightRegex = /\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|/;
      const flightMatch = product?.body.match(flightRegex);
      const flightNumbers = flightMatch ? {
        speed: flightMatch[1],
        glide: flightMatch[2],
        turn: flightMatch[3],
        fade: flightMatch[4],
      } : {};
      return {
        title: product.title,
        price: formatPrice(product.price),
        image: product.image.replace('.png', '_400x.png'),
        store: 'inside-the-circle',
        url: 'https://www.inside-the-circle.de' + product.url,
        flightNumbers,
        vendor: product.vendor,
        stockStatus: product.available ? 'available' : 'unavailable',
        crawledAt: crawledAt
      }
    });
  });
  return filterProducts(products, query);
}

async function scrapeChooseYourDisc(query) {
  const url = urls.chooseyourdisc.replace('{{query}}', query);
  const products = await fetch(url).then(response => response.json()).then(searchData => {
    return searchData.resources.results.products.map(product => {
      const flightNumbers = {
        speed: product.tags.find(tag => tag.includes('Speed '))?.replace('Speed ', '') || null,
        glide: product.tags.find(tag => tag.includes('Glide '))?.replace('Glide ', '') || null,
        turn: product.tags.find(tag => tag.includes('Turn '))?.replace('Turn ', '') || null,
        fade: product.tags.find(tag => tag.includes('Fade '))?.replace('Fade ', '') || null,
      };
      return {
        title: product.title,
        price: formatPrice(product.price),
        image: product.image.replace('.jpg', '_400x.jpg'),
        store: 'choose-your-disc',
        url: 'https://www.chooseyourdisc.com' + product.url,
        vendor: product.vendor,
        flightNumbers,
        stockStatus: product.available ? 'available' : 'unavailable',
        crawledAt: crawledAt
      }
    });
  });
  return filterProducts(products, query);
}

async function scrapeDiscWolf(query) {
  const url = urls.discwolf.replace('{{query}}', query);
  const products = await fetch(url).then(response => response.json()).then(searchData => {
    return searchData.resources.results.products.map(product => {
      const flightRegex = /Speed ([\d\.,]+) \/ Glide ([\d\.,]+) \/ Turn (-?[\d\.,]+) \/ Fade (-?[\d\.,]+)/;
      const flightMatch = product.body.match(flightRegex);
      const flightNumbers = flightMatch ? {
        speed: flightMatch[1],
        glide: flightMatch[2],
        turn: flightMatch[3],
        fade: flightMatch[4],
      } : {};
      return {
        title: product.title,
        price: formatPrice(product.price),
        image: product.image.replace('.png', '_400x.png'),
        store: 'discwolf',
        url: 'https://www.discwolf.com' + product.url,
        flightNumbers,
        vendor: product.vendor,
        stockStatus: product.available ? 'available' : 'unavailable',
        crawledAt: crawledAt
      }
    });
  });
  return filterProducts(products, query);
}

async function scrapeBirdieShop(query) {
  const url = urls.birdieShop.replace('{{query}}', query);
  const html = await axios.get(url).then(res => res.data);
  const $ = cheerio.load(html);
  const productItems = Array.from($('.search-result'));
  const products = await Promise.all(productItems.map(async (el) => {
    const url = 'https://www.birdie-shop.com' + $(el).attr('data-url');
    try {
      const productHtml = await axios.get(url).then(res => res.data);
      const $product = cheerio.load(productHtml);
      $product('.original-price').remove();
      const price = parseInt([...$product('.product-price').text().trim()].filter(char => parseInt(char) > -1).join(''));
      const image = $product('.ProductItem-gallery-slides-item-image').first().attr('data-src');
      const list = $product('.product-details ul').text();
      const flightRegex = /Speed: (-?\d+)Glide: (-?\d+)Turn: (-?\d+)Fade: (-?\d+)/;
      const flightMatch = list?.match(flightRegex);
      const flightNumbers = flightMatch ? {
        speed: flightMatch[1],
        glide: flightMatch[2],
        turn: flightMatch[3],
        fade: flightMatch[4],
      } : {};
      return {
        title: $(el).find('.sqs-title').text()?.trim(),
        price: price,
        image: image + '?format=500w',
        store: 'birdieshop',
        url: url,
        flightNumbers,
        stockStatus: 'unknown',
        crawledAt: crawledAt
      };
    } catch (err) {
      console.log('Error fetching product page', err);
    }
  }));
  return filterProducts(products.filter(Boolean), query);
}

async function scrapeDiscgolf4You(query) {
  const url = urls.discgolf4you.replace('{{query}}', query).replace('{{page}}', '1');
  const html = await axios.get(url).then(res => res.data)
  const $ = cheerio.load(html);
  let pagesLength = parseInt([...$('#pagination-container a.page-link:not(.next)').last().text().trim()].filter(char => Number(char)).join('')) || 1;
  const products = [];
  for (let i = 1; i <= pagesLength; i++) {
    const nextPageUrl = urls.discgolf4you.replace('{{query}}', query).replace('{{page}}', i)
    try {
      const nextPageHtml = await axios.get(nextPageUrl).then(res => res.data);
      const $nextPage = cheerio.load(nextPageHtml);
      const productItems = Array.from($nextPage('.product'));
      productItems.forEach(async el => {
        const price = parseInt([...$nextPage(el).find('.price span :not(del) span bdi, .price span > span bdi').text().trim()].filter(char => parseInt(char) > -1).join(''));
        const flightNumbers = {
          speed: $nextPage(el).find('.flight-attribute-speed b').text() || null,
          glide: $nextPage(el).find('.flight-attribute-glide b').text() || null,
          turn: $nextPage(el).find('.flight-attribute-turn b').text() || null,
          fade: $nextPage(el).find('.flight-attribute-fade b').text() || null,
        }
        products.push({
          title: $nextPage(el).find('.woocommerce-loop-product__title').text(),
          price: price,
          image: $nextPage(el).find('img').attr('data-src'),
          store: 'discgolf4you',
          url: $nextPage(el).find('a').attr('href'),
          flightNumbers,
          stockStatus: 'unknown',
          crawledAt: crawledAt
        });
      });
    } catch (err) {
      console.log('Error fetching product page', err);
    }
  }

  return filterProducts(products, query);
}

async function scrapeHyzerStore(query) {
  const url = urls.hyzerStore.replace('{{query}}', query).replace('{{page}}', '1');
  const html = await axios.get(url).then(res => res.data)
  const $ = cheerio.load(html);
  let pagesLength = parseInt([...$('.woocommerce-pagination').find('li .page-numbers:not(.next)').last().text().trim()].filter(char => Number(char)).join('')) || 1;
  const products = [];
  for (let i = 1; i <= pagesLength; i++) {
    const nextPageUrl = urls.hyzerStore.replace('{{query}}', query).replace('{{page}}', i)
    try {
      const nextPageHtml = await axios.get(nextPageUrl).then(res => res.data);
      const $nextPage = cheerio.load(nextPageHtml);
      const productItems = Array.from($nextPage('.product'));
      productItems.forEach(async el => {
        const price = parseInt([...$nextPage(el).find('.price span bdi').text().trim()].filter(char => parseInt(char) > -1).join(''));
        const flightNumbers = {
          speed: $nextPage(el).find('.btn-speed').text() || null,
          glide: $nextPage(el).find('.btn-glide').text() || null,
          turn: $nextPage(el).find('.btn-turn').text() || null,
          fade: $nextPage(el).find('.btn-fade').text() || null,
        }
        products.push({
          title: $nextPage(el).find('.woocommerce-loop-product__title').text(),
          price: price,
          image: $nextPage(el).find('img').attr('src'),
          store: 'hyzerstore',
          url: $nextPage(el).find('a').attr('href'),
          flightNumbers,
          stockStatus: 'unknown',
          crawledAt: crawledAt
        });
      });
    } catch (err) {
      console.log('Error fetching product page', err);
    }
  }

  return filterProducts(products, query);
}

export async function handleCache(type, query) {
  if (process.env.NODE_ENV === 'production') {
    const cacheKey = `${type}-${query}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) return cachedData;
    const data = await scrapeStores(type, query);
    await setCache(cacheKey, data);
    return data;
  }
  return scrapeStores(type, query);
}

function formatPrice(str) {
  if (!str || typeof str !== 'string') return null;
  const dotNotation = str.trim().replace(',', '.');
  const euro = new Number(dotNotation);
  const cents = euro * 100;
  return parseInt(cents);
}
