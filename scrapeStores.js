import axios from "axios";
import cheerio from "cheerio";
import { getCache, setCache } from "./cache.js";
import dotenv from "dotenv";

dotenv.config();

const urls = {
  dgStore: 'https://www.discgolfstore.de/search/?qs={{query}}&af=96',
  thrownatur: 'https://thrownatur-discgolf.de/de/advanced_search_result.php?keywords={{query}}&listing_count=288',
  crosslap: 'https://www.discgolf-shop.de/advanced_search_result.php?keywords={{query}}&listing_count=1200',
  frisbeeshop: 'https://www.frisbeeshop.com/search?search={{query}}&order=topseller&limit=100',
  insidethecircle: 'https://www.inside-the-circle.de/search/suggest.json?q={{query}}',
  chooseyourdisc: 'https://www.chooseyourdisc.com/search/suggest.json?q={{query}}'
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
    default:
      return scrapeAllStores(query);
  }
}

function filterProducts(products, query) {
  if (!products.length) return [];
  const queryWords = query.toLowerCase().split(' ');
  // remove products that don't contain not all of the query words
  return products.filter((product) => queryWords.every((word) => product.title.toLowerCase().includes(word)));
}

async function scrapeDGStore(query) {
  const url = urls.dgStore.replace('{{query}}', query);
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products = [];
  const isPDP = $('.product-detail').length > 0;

  if (isPDP) {
    products.push({
      title: $('.product-title').text()?.trim(),
      price: $('meta[itemprop="price"]').attr('content')?.trim(),
      image: $('meta[itemprop="image"]').attr('content')?.trim(),
      store: 'https://www.discgolfstore.de/bilder/intern/shoplogo/DGS_logo_160.jpg',
      url: $('.breadcrumb-item.active a').attr('href')?.trim(),
      stockStatus: 'available',
      crawledAt: crawledAt
    });
  } else {
    $('.product-wrapper').each((i, el) => {
      products.push({
        title: $(el).find('.productbox-title a').text()?.trim(),
        price: $(el).find('meta[itemprop="price"]').attr('content')?.trim(),
        image: $(el).find('meta[itemprop="image"]').attr('content')?.trim(),
        store: 'https://www.discgolfstore.de/bilder/intern/shoplogo/DGS_logo_160.jpg',
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
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-container').each((i, el) => {
    const $price = $(el).find('.current-price-container').text()?.trim();
    const priceCleaned = $price.includes('Nur') ? $price.split('Nur')[1] : $price;
    const price = parseInt([...priceCleaned].filter(char => parseInt(char) > -1).join('')) / 100;
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src')
    const stockStatus = stockStatusIcon?.includes('bestellbar') ? 'available' : stockStatusIcon?.includes('gray') ? 'unknown' : 'unavailable';
    products.push({
      title: $(el).find('.product-url ').text()?.trim(),
      price: price.toFixed(2),
      image: 'https://thrownatur-discgolf.de/' + $(el).find('.product-image img').attr('src')?.trim(),
      store: 'https://thrownatur-discgolf.de/images/logos/thrownatur_logo_neuer_shop_logo.png',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      stockStatus: stockStatus,
      crawledAt: crawledAt
    });
  });
  return filterProducts(products, query);
}

async function scrapeCrosslap(query) {
  const url = urls.crosslap.replace('{{query}}', query);
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-container').each((i, el) => {
    const price = parseInt([...$(el).find('.current-price-container').text()?.trim()].filter(char => parseInt(char) > -1).join('')) / 100;
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus = stockStatusIcon?.includes('/status/1') && !$(el).find('.ribbon-sold-out').length ? 'available' : 'unavailable';
    products.push({
      title: $(el).find('.product-url ').text()?.trim(),
      price: price.toFixed(2),
      image: 'https://discgolf-shop.de/' + $(el).find('.product-image img').attr('src')?.trim(),
      store: 'https://www.discgolf-shop.de/images/logos/banner_discgolf_de_logo.gif',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      stockStatus: stockStatus,
      crawledAt: crawledAt
    });
  });
  return filterProducts(products, query);
}

async function scrapeFrisbeeshop(query) {
  const url = urls.frisbeeshop.replace('{{query}}', query);
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-box').each((i, el) => {
    const price = parseInt([...$(el).find('.product-price').text().split('€')[0]?.trim()].filter(char => parseInt(char) > -1).join('')) / 100;
    products.push({
      title: $(el).find('a.product-name').text()?.trim(),
      price: price.toFixed(2),
      image: $(el).find('.product-image-wrapper img').attr('srcset')?.trim()?.split(' 400w')[0]?.split('800w, ')[1] || $(el).find('.product-image-wrapper img').attr('src')?.trim(),
      store: 'https://www.frisbeeshop.com/bundles/frisbeeshoptheme/assets/logo-dark.svg',
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
      return {
        title: product.title,
        price: product.price,
        image: product.image.replace('.png', '_400x.png'),
        store: 'https://www.inside-the-circle.de/cdn/shop/files/logo_01_200x.png',
        url: 'https://www.inside-the-circle.de' + product.url,
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
      return {
        title: product.title,
        price: product.price,
        image: product.image.replace('.jpg', '_400x.jpg'),
        store: 'https://www.chooseyourdisc.com/cdn/shop/files/cyd_logo_s.png?v=1707920720&width=200',
        url: 'https://www.chooseyourdisc.com' + product.url,
        stockStatus: product.available ? 'available' : 'unavailable',
        crawledAt: crawledAt
      }
    });
  });
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