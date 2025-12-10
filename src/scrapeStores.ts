import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { getCache, setCache } from './cache';
import shops from './shopList';

dotenv.config();

const crawledAt = new Date().toISOString();
const NEW_PRODUCT_DAYS = Number(process.env.NEW_PRODUCT_DAYS || '14');

interface ShopifyProduct {
  title: string;
  created_at: string;
  variants: { price: string; available: boolean }[];
  images: { src: string }[];
  image?: string;
  handle: string;
  vendor: string;
  tags: string[];
  price: string;
  body: string;
  url: string;
  available: boolean;
}

interface DefaultProduct {
  title: string;
  price: number | null;
  image?: string | null;
  store: string;
  vendor?: string;
  url: string | null;
  flightNumbers?: {
    speed: string | null;
    glide: string | null;
    turn: string | null;
    fade: string | null;
  };
  stockStatus: 'available' | 'unavailable' | 'unknown';
  crawledAt: string;
  createdAt?: string;
}

async function scrapeStores(type: string, query: string) {
  switch (type) {
    case 'product-feed':
      return getShopifyProductFeeds();
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
      return `Invalid Store Identifier. Try one of the following: ${Object.keys(shops).join(', ').toLowerCase()}.`;
  }
}

async function getShopifyProductFeeds() {
  const feedShops = Object.values(shops).filter(
    (shop) => shop.shopSystem === 'shopify' && shop.feed,
  );

  const allProducts = [];
  for (const shop of feedShops) {
    const shopFeed = shop.feed;
    if (!shop || !shopFeed) continue;
    try {
      const baseURL = new URL(shopFeed).origin;
      const products = await fetch(shopFeed)
        .then((response) => response.json())
        .then((data) => {
          return data.products
            .filter((product: ShopifyProduct) => {
              const createdAt = new Date(product.created_at);
              const newProductTime = new Date();
              newProductTime.setDate(newProductTime.getDate() - NEW_PRODUCT_DAYS);
              return createdAt >= newProductTime;
            })
            .map(
              (product: ShopifyProduct): DefaultProduct => ({
                title: product.title,
                price: formatPrice(product.variants[0].price),
                image: product.images[0]?.src.replace('.png', '_400x.png') || null,
                store: shop.title || 'unknown',
                url: product.handle ? cleanURL(`${baseURL}/products/${product.handle}`) : null,
                vendor: product.vendor,
                stockStatus: product.variants.some((variant) => variant.available)
                  ? 'available'
                  : 'unavailable',
                crawledAt: crawledAt,
                createdAt: product.created_at,
              }),
            );
        });

      allProducts.push(...products);
    } catch (err) {
      console.log('Error fetching product feed', err);
    }
  }
  return allProducts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function filterProducts(products: DefaultProduct[], query: string) {
  if (!products.length) return [];
  // strip 'innova' from query because DGStore does not include it in titles
  const queryWords = query
    .toLowerCase()
    .split(' ')
    .filter((word) => word !== 'innova');
  // remove products that don't contain not all of the query words
  return products.filter((product) => {
    const title = (product.title + (product.vendor ? ` ${product.vendor}` : '')).toLowerCase();
    return queryWords.every((word) => {
      const regex = new RegExp(`\\b${word}\\b`);
      return regex.test(title);
    });
  });
}

async function scrapeDGStore(query: string) {
  const shop = shops.find((s) => s.title === 'discgolfstore');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products: DefaultProduct[] = [];
  const isPDP = $('.product-detail').length > 0;

  if (isPDP) {
    products.push({
      title: $('.product-title').text()?.trim(),
      price: formatPrice($('meta[itemprop="price"]').attr('content')),
      image: $('meta[itemprop="image"]').attr('content')?.trim(),
      store: 'discgolfstore',
      url: cleanURL($('.breadcrumb-item.active a').attr('href')),
      stockStatus: 'available',
      crawledAt: crawledAt,
    });
  } else {
    $('.product-wrapper').each((_, el) => {
      products.push({
        title: $(el).find('.productbox-title a').text()?.trim(),
        price: formatPrice($(el).find('meta[itemprop="price"]').attr('content')),
        image: $(el).find('meta[itemprop="image"]').attr('content')?.trim(),
        store: 'discgolfstore',
        url: cleanURL($(el).find('.productbox-title a').attr('href')),
        stockStatus: 'available',
        crawledAt: crawledAt,
      });
    });
  }
  return filterProducts(products, query);
}

async function scrapeThrownatur(query: string) {
  const shop = shops.find((s) => s.title === 'thrownatur');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products: DefaultProduct[] = [];
  $('.product-container').each((_, el) => {
    const $price = $(el).find('.current-price-container').text()?.toLowerCase().trim();
    const priceCleaned = $price.includes('nur') ? $price.split('nur')[1] : $price;
    const price = Number([...priceCleaned].filter((char) => Number(char) > -1).join(''));
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus = stockStatusIcon?.includes('bestellbar')
      ? 'available'
      : stockStatusIcon?.includes('gray')
        ? 'unknown'
        : 'unavailable';
    products.push({
      title: $(el).find('.product-url').text()?.trim(),
      price: price,
      image:
        'https://thrownatur-discgolf.de/' +
        $(el)
          .find('.product-image img')
          .attr('src')
          ?.replace('thumbnail_images', 'info_images')
          .trim(),
      store: 'thrownatur',
      url: cleanURL($(el).find('a.product-url').attr('href')),
      flightNumbers: {
        speed: $(el).find('.title-description .disc-guide-display-speed').text() || null,
        glide: $(el).find('.title-description .disc-guide-display-glide').text() || null,
        turn: $(el).find('.title-description .disc-guide-display-turn').text() || null,
        fade: $(el).find('.title-description .disc-guide-display-fade').text() || null,
      },
      stockStatus: stockStatus,
      crawledAt: crawledAt,
    });
  });
  return filterProducts(products, query);
}

async function scrapeCrosslap(query: string) {
  const shop = shops.find((s) => s.title === 'crosslap');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products: DefaultProduct[] = [];

  $('.product-container').each((_, el) => {
    $(el).find('.productOldPrice').remove();
    const price = Number(
      [...($(el).find('.current-price-container').text()?.trim() ?? '')]
        .filter((char) => Number(char) > -1)
        .join(''),
    );
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus =
      stockStatusIcon?.includes('/status/1') && !$(el).find('.ribbon-sold-out').length
        ? 'available'
        : 'unavailable';

    const flightString = $(el).find('.description').text().trim();
    const flightRegex = /Speed (-?\d+), Glide (-?\d+), Turn (-?\d+), Fade (-?\d+)/;
    const flightMatch = flightString?.match(flightRegex);
    products.push({
      title: $(el).find('.product-url ').text()?.trim(),
      price: price,
      image: `https://discgolf-shop.de/${$(el).find('.product-image img').attr('src')?.trim()}`,
      store: 'crosslap',
      url: cleanURL($(el).find('a.product-url').attr('href')),
      flightNumbers: flightMatch
        ? {
            speed: flightMatch[1],
            glide: flightMatch[2],
            turn: flightMatch[3],
            fade: flightMatch[4],
          }
        : undefined,
      stockStatus: stockStatus,
      crawledAt: crawledAt,
    });
  });
  return filterProducts(products, query);
}

async function scrapeFrisbeeshop(query: string) {
  const shop = shops.find((s) => s.title === 'frisbeeshop');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products: DefaultProduct[] = [];

  $('.product-box').each((_, el) => {
    const price = Number(
      [...($(el).find('.product-price').text().split('€')[0]?.trim() ?? '')]
        .filter((char) => Number(char) > -1)
        .join(''),
    );
    products.push({
      title: $(el).find('a.product-name').text()?.trim(),
      price: price,
      image:
        $(el)
          .find('.product-image-wrapper img')
          .attr('srcset')
          ?.trim()
          ?.split(' 400w')[0]
          ?.split('800w, ')[1] || $(el).find('.product-image-wrapper img').attr('src')?.trim(),
      store: 'frisbeeshop',
      url: cleanURL($(el).find('a.product-name').attr('href')),
      stockStatus: 'unknown',
      crawledAt: crawledAt,
    });
  });
  return filterProducts(products, query);
}

async function scrapeInsideTheCircle(query: string) {
  const shop = shops.find((s) => s.title === 'insidethecircle');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const products: DefaultProduct[] = await fetch(url)
    .then((response) => response.json())
    .then((searchData) => {
      return searchData.resources.results.products.map((product: ShopifyProduct) => {
        const flightRegex = /\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|\s*(-?\d+)\s*\|/;
        const flightMatch = product?.body.match(flightRegex);
        const flightNumbers = flightMatch
          ? {
              speed: flightMatch[1],
              glide: flightMatch[2],
              turn: flightMatch[3],
              fade: flightMatch[4],
            }
          : {};
        return {
          title: product.title,
          price: formatPrice(product.price),
          image: product.image?.replace('.png', '_400x.png'),
          store: 'insidethecircle',
          url: cleanURL(`https://www.inside-the-circle.de${product.url}`),
          flightNumbers,
          vendor: product.vendor,
          stockStatus: product.available ? 'available' : 'unavailable',
          crawledAt: crawledAt,
        };
      });
    });
  return filterProducts(products, query);
}

async function scrapeChooseYourDisc(query: string) {
  const shop = shops.find((s) => s.title === 'chooseyourdisc');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const products: DefaultProduct[] = await fetch(url)
    .then((response) => response.json())
    .then((searchData) => {
      return searchData.resources.results.products.map((product: ShopifyProduct) => {
        const flightNumbers = {
          speed: product.tags.find((tag) => tag.includes('Speed '))?.replace('Speed ', '') || null,
          glide: product.tags.find((tag) => tag.includes('Glide '))?.replace('Glide ', '') || null,
          turn: product.tags.find((tag) => tag.includes('Turn '))?.replace('Turn ', '') || null,
          fade: product.tags.find((tag) => tag.includes('Fade '))?.replace('Fade ', '') || null,
        };
        return {
          title: product.title,
          price: formatPrice(product.price),
          image: product.image?.replace('.jpg', '_400x.jpg'),
          store: 'chooseyourdisc',
          url: cleanURL(`https://www.chooseyourdisc.com${product.url}`),
          vendor: product.vendor,
          flightNumbers,
          stockStatus: product.available ? 'available' : 'unavailable',
          crawledAt: crawledAt,
        };
      });
    });
  return filterProducts(products, query);
}

async function scrapeDiscWolf(query: string) {
  const shop = shops.find((s) => s.title === 'discwolf');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const products: DefaultProduct[] = await fetch(url)
    .then((response) => response.json())
    .then((searchData) => {
      return searchData.resources.results.products.map((product: ShopifyProduct) => {
        const flightRegex =
          /Speed ([\d.,]+) \/ Glide ([\d.,]+) \/ Turn (-?[\d.,]+) \/ Fade (-?[\d.,]+)/;
        const flightMatch = product.body.match(flightRegex);
        const flightNumbers = flightMatch
          ? {
              speed: flightMatch[1],
              glide: flightMatch[2],
              turn: flightMatch[3],
              fade: flightMatch[4],
            }
          : {};
        return {
          title: product.title,
          price: formatPrice(product.price),
          image: product.image?.replace('.png', '_400x.png'),
          store: 'discwolf',
          url: cleanURL(`https://www.discwolf.com${product.url}`),
          flightNumbers,
          vendor: product.vendor,
          stockStatus: product.available ? 'available' : 'unavailable',
          crawledAt: crawledAt,
        };
      });
    });
  return filterProducts(products, query);
}

async function scrapeBirdieShop(query: string) {
  const shop = shops.find((s) => s.title === 'birdieShop');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query);
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const productItems = Array.from($('.search-result'));
  if (productItems.length === 0) return [];
  const products = (await Promise.all(
    productItems.map(async (el): Promise<DefaultProduct | null> => {
      const url = `https://www.birdie-shop.com${$(el).attr('data-url')}`;
      if (!url.includes('/p/')) return null;
      try {
        const productHtml = await axios.get<string>(url).then((res) => res.data);
        const $product = cheerio.load(productHtml);
        $product('.original-price').remove();
        const price = Number(
          [...$product('.product-price').text().trim()]
            .filter((char) => Number(char) > -1)
            .join(''),
        );
        const image = $product('.product-gallery-slides-item-image')?.first()?.attr('data-src');
        const stockStatus = $product('.product-status .sold-out').length
          ? 'unavailable'
          : 'unknown';
        const list = $product('.product-details ul').text();
        const flightRegex = /Speed: (-?\d+)Glide: (-?\d+)Turn: (-?\d+)Fade: (-?\d+)/;
        const flightMatch = list?.match(flightRegex);
        const flightNumbers = flightMatch
          ? {
              speed: flightMatch[1],
              glide: flightMatch[2],
              turn: flightMatch[3],
              fade: flightMatch[4],
            }
          : {};
        return {
          title: $(el).find('.sqs-title').text()?.trim(),
          price: price,
          image: `${image}?format=500w`,
          store: 'birdieshop',
          url: cleanURL(url),
          flightNumbers,
          stockStatus,
          crawledAt: crawledAt,
        } as DefaultProduct;
      } catch (err) {
        console.log('Error fetching product page', err);
        return null;
      }
    }),
  )) as DefaultProduct[];
  return filterProducts(products.filter(Boolean), query);
}

async function scrapeDiscgolf4You(query: string) {
  const shop = shops.find((s) => s.title === 'discgolf4you');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query).replace('{{page}}', '1');
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const pagesLength =
    Number(
      [...$('#pagination-container a.page-link:not(.next)').last().text().trim()]
        .filter((char) => Number(char))
        .join(''),
    ) || 1;
  const products: DefaultProduct[] = [];

  for (let i = 1; i <= pagesLength; i++) {
    const nextPageUrl = shop.url.replace('{{query}}', query).replace('{{page}}', i.toString());
    try {
      const nextPageHtml = await axios.get<string>(nextPageUrl).then((res) => res.data);
      const $nextPage = cheerio.load(nextPageHtml);
      const productItems = Array.from($nextPage('.product'));
      productItems.forEach(async (el) => {
        const price = Number(
          [
            ...$nextPage(el)
              .find('.price span :not(del) span bdi, .price span > span bdi')
              .text()
              .trim(),
          ]
            .filter((char) => Number(char) > -1)
            .join(''),
        );
        const flightNumbers = {
          speed: $nextPage(el).find('.flight-attribute-speed b').text() || null,
          glide: $nextPage(el).find('.flight-attribute-glide b').text() || null,
          turn: $nextPage(el).find('.flight-attribute-turn b').text() || null,
          fade: $nextPage(el).find('.flight-attribute-fade b').text() || null,
        };
        products.push({
          title: $nextPage(el).find('.woocommerce-loop-product__title').text(),
          price: price,
          image: $nextPage(el).find('img').attr('data-src'),
          store: 'discgolf4you',
          url: cleanURL($nextPage(el).find('a').attr('href')),
          flightNumbers,
          stockStatus: 'unknown',
          crawledAt: crawledAt,
        });
      });
    } catch (err) {
      console.log('Error fetching product page', err);
    }
  }

  return filterProducts(products, query);
}

async function scrapeHyzerStore(query: string) {
  const shop = shops.find((s) => s.title === 'hyzerStore');
  if (!shop) return null;
  const url = shop.url.replace('{{query}}', query).replace('{{page}}', '1');
  const html = await axios.get<string>(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const pagesLength =
    Number(
      [...$('.woocommerce-pagination').find('li .page-numbers:not(.next)').last().text().trim()]
        .filter((char) => Number(char))
        .join(''),
    ) || 1;
  const products: DefaultProduct[] = [];

  for (let i = 1; i <= pagesLength; i++) {
    const nextPageUrl = shop.url.replace('{{query}}', query).replace('{{page}}', i.toString());
    try {
      const nextPageHtml =
        i === 1 ? html : await axios.get<string>(nextPageUrl).then((res) => res.data);
      const $nextPage = cheerio.load(nextPageHtml);
      const productItems = Array.from($nextPage('.product'));
      productItems.forEach(async (el) => {
        $nextPage(el).find('.price del bdi').remove();
        const price = Number(
          [...$nextPage(el).find('.price span bdi').text().trim()]
            .filter((char) => Number(char) > -1)
            .join(''),
        );
        const flightNumbers = {
          speed: $nextPage(el).find('.btn-speed').text() || null,
          glide: $nextPage(el).find('.btn-glide').text() || null,
          turn: $nextPage(el).find('.btn-turn').text() || null,
          fade: $nextPage(el).find('.btn-fade').text() || null,
        };
        products.push({
          title: $nextPage(el).find('.woocommerce-loop-product__title').text(),
          price: price,
          image: $nextPage(el).find('img').attr('src'),
          store: 'hyzerstore',
          url: cleanURL($nextPage(el).find('a').attr('href')),
          flightNumbers,
          stockStatus: 'unknown',
          crawledAt: crawledAt,
        });
      });
    } catch (err) {
      console.log('Error fetching product page', err);
    }
  }

  return filterProducts(products, query);
}

export async function handleCache(type: string, query: string) {
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

function formatPrice(str: string | undefined): number | null {
  if (!str) return null;
  const dotNotation = str.trim().replace(',', '.');
  const euro = parseFloat(dotNotation);
  return Math.round(euro * 100);
}

function cleanURL(string: string | undefined): string {
  if (!string) return '';
  try {
    const parsedURL = new URL(string.trim());
    parsedURL.search = '';
    parsedURL.hash = '';
    return parsedURL.toString();
  } catch {
    return string.trim();
  }
}
