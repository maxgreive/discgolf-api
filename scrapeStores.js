import axios from "axios";
import cheerio from "cheerio";

const urls = {
  dgStore: 'https://www.discgolfstore.de/search/?qs={{query}}&af=96',
  thrownatur: 'https://thrownatur-discgolf.de/de/advanced_search_result.php?keywords={{query}}&listing_count=288',
  crosslap: 'https://www.discgolf-shop.de/advanced_search_result.php?keywords={{query}}&listing_count=1200',
  frisbeeshop: 'https://www.frisbeeshop.com/search?search={{query}}&order=topseller&limit=100',
}

export async function scrapeStores(type, query) {
  switch (type) {
    case 'discgolfstore':
      return scrapeDGStore(query);
    case 'thrownatur':
      return scrapeThrownatur(query);
    case 'crosslap':
      return scrapeCrosslap(query);
    case 'frisbeeshop':
      return scrapeFrisbeeshop(query);
    default:
      return scrapeAllStores(query);
  }
}

function sortProducts(products, query) {
  if (!products.length) return [];
  const queryWords = query.toLowerCase().split(' ');
  // remove products that don't contain not all of the query words
  products = products.filter((product) => queryWords.every((word) => product.title.toLowerCase().includes(word)));

  return products.sort((a, b) => {
    const aScore = queryWords.reduce((acc, word) => acc + (a.title.toLowerCase().includes(word) ? 1 : 0), 0);
    const bScore = queryWords.reduce((acc, word) => acc + (b.title.toLowerCase().includes(word) ? 1 : 0), 0);
    return bScore - aScore;
  });
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
      price: parseFloat($('meta[itemprop="price"]').attr('content')?.trim()),
      image: $('meta[itemprop="image"]').attr('content')?.trim(),
      store: 'https://www.discgolfstore.de/bilder/intern/shoplogo/DGS_logo_160.jpg',
      url: $('.breadcrumb-item.active a').attr('href')?.trim(),
      stockStatus: 'available'
    });
  } else {
    $('.product-wrapper').each((i, el) => {
      products.push({
        title: $(el).find('.productbox-title a').text()?.trim(),
        price: parseFloat($(el).find('meta[itemprop="price"]').attr('content')?.trim()),
        image: $(el).find('meta[itemprop="image"]').attr('content')?.trim(),
        store: 'https://www.discgolfstore.de/bilder/intern/shoplogo/DGS_logo_160.jpg',
        url: $(el).find('.productbox-title a').attr('href')?.trim(),
        stockStatus: 'available'
      });
    });
  }
  return sortProducts(products, query);
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
      price: parseFloat(price.toFixed(2)),
      image: 'https://thrownatur-discgolf.de/' + $(el).find('.product-image img').attr('src')?.trim(),
      store: 'https://thrownatur-discgolf.de/images/logos/thrownatur_logo_neuer_shop_logo.png',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      stockStatus: stockStatus
    });
  });
  return sortProducts(products, query);
}

async function scrapeCrosslap(query) {
  const url = urls.crosslap.replace('{{query}}', query);
  const html = await axios.get(url).then((res) => res.data);
  const $ = cheerio.load(html);
  const products = [];
  $('.product-container').each((i, el) => {
    const price = parseInt([...$(el).find('.current-price-container').text()?.trim()].filter(char => parseInt(char) > -1).join('')) / 100;
    const stockStatusIcon = $(el).find('.shipping-info-short img').attr('src');
    const stockStatus = stockStatusIcon?.includes('/status/1') ? 'available' : 'unavailable';
    products.push({
      title: $(el).find('.product-url ').text()?.trim(),
      price: parseFloat(price.toFixed(2)),
      image: 'https://discgolf-shop.de/' + $(el).find('.product-image img').attr('src')?.trim(),
      store: 'https://www.discgolf-shop.de/images/logos/banner_discgolf_de_logo.gif',
      url: $(el).find('a.product-url').attr('href')?.trim(),
      stockStatus: stockStatus
    });
  });
  return sortProducts(products, query);
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
      price: parseFloat(price.toFixed(2)),
      image: $(el).find('.product-image-wrapper img').attr('srcset')?.trim()?.split(' 400w')[0]?.split('800w, ')[1] || $(el).find('.product-image-wrapper img').attr('src')?.trim(),
      store: 'https://www.frisbeeshop.com/bundles/frisbeeshoptheme/assets/logo-dark.svg',
      url: $(el).find('a.product-name').attr('href')?.trim(),
      stockStatus: 'unknown'
    });
  });
  return sortProducts(products, query);
}