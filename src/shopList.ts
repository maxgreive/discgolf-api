export default
  {
    dgStore: {
      url: 'https://www.discgolfstore.de/search/?qs={{query}}&af=96',
      feed: null,
      shopSystem: 'jtl'
    },
    thrownatur: {
      url: 'https://thrownatur-discgolf.de/de/advanced_search_result.php?keywords={{query}}&listing_count=288',
      feed: null,
      shopSystem: 'gambio'
    },
    crosslap: {
      url: 'https://www.discgolf-shop.de/advanced_search_result.php?keywords={{query}}&listing_count=1200',
      feed: null,
      shopSystem: 'gambio'
    },
    frisbeeshop: {
      url: 'https://www.frisbeeshop.com/search?search={{query}}&order=topseller&limit=100',
      feed: null,
      shopSystem: 'shopware'
    },
    insidethecircle: {
      url: 'https://www.inside-the-circle.de/search/suggest.json?q={{query}}',
      feed: 'https://www.inside-the-circle.de/collections/new-collection/products.json?limit=50',
      shopSystem: 'shopify'
    },
    chooseyourdisc: {
      url: 'https://www.chooseyourdisc.com/search/suggest.json?q={{query}}',
      feed: 'https://www.chooseyourdisc.com/collections/highlights/products.json?limit=50',
      shopSystem: 'shopify'
    },
    discwolf: {
      url: 'https://www.discwolf.com/search/suggest.json?q={{query}}',
      feed: 'https://discwolf.com/collections/new-in-store/products.json?limit=50',
      shopSystem: 'shopify'
    },
    birdieShop: {
      url: 'https://www.birdie-shop.com/search?q={{query}}',
      feed: null,
      shopSystem: 'squarespace'
    },
    discgolf4you: {
      url: 'https://discgolf4you.com/page/{{page}}/?s={{query}}&post_type=product',
      feed: null,
      shopSystem: 'woocommerce'
    },
    hyzerStore: {
      url: 'https://www.hyzer-store.de/page/{{page}}/?s={{query}}&post_type=product',
      feed: null,
      shopSystem: 'woocommerce'
    }
  }