export default [
  {
    url: 'https://www.discgolfstore.de/search/?qs={{query}}&af=96',
    feed: null,
    shopSystem: 'jtl',
    title: 'discgolfstore',
  },
  {
    url: 'https://thrownatur-discgolf.de/de/advanced_search_result.php?keywords={{query}}&listing_count=288',
    feed: null,
    shopSystem: 'gambio',
    title: 'thrownatur',
  },
  {
    url: 'https://www.discgolf-shop.de/advanced_search_result.php?keywords={{query}}&listing_count=1200',
    feed: null,
    shopSystem: 'gambio',
    title: 'crosslap',
  },
  {
    url: 'https://www.frisbeeshop.com/search?search={{query}}&order=topseller&limit=100',
    feed: null,
    shopSystem: 'shopware',
    title: 'frisbeeshop',
  },
  {
    url: 'https://www.inside-the-circle.de/search/suggest.json?q={{query}}',
    feed: 'https://www.inside-the-circle.de/collections/new-collection/products.json?limit=50',
    shopSystem: 'shopify',
    title: 'insidethecircle',
  },
  {
    url: 'https://www.chooseyourdisc.com/search/suggest.json?q={{query}}',
    feed: 'https://www.chooseyourdisc.com/collections/highlights/products.json?limit=50',
    shopSystem: 'shopify',
    title: 'chooseyourdisc',
  },
  {
    url: 'https://www.discwolf.com/search/suggest.json?q={{query}}',
    feed: 'https://discwolf.com/collections/new-in-store/products.json?limit=50',
    shopSystem: 'shopify',
    title: 'discwolf',
  },
  {
    url: 'https://www.birdie-shop.com/search?q={{query}}',
    feed: null,
    shopSystem: 'squarespace',
    title: 'birdieshop',
  },
  {
    url: 'https://discgolf4you.com/page/{{page}}/?s={{query}}&post_type=product',
    feed: null,
    shopSystem: 'woocommerce',
    title: 'discgolf4you',
  },
  {
    url: 'https://www.hyzer-store.de/page/{{page}}/?s={{query}}&post_type=product',
    feed: null,
    shopSystem: 'woocommerce',
    title: 'hyzerstore',
  },
];
