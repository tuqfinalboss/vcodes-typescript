// OpenAPI spec for VOD API
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'VOD API',
    version: '1.0.0',
    description: 'REST API for VOD (Xtream Codes + TMDB)'
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { 200: { description: 'OK' } }
      }
    },
    '/v1/categories': {
      get: {
        summary: 'List VOD categories',
        parameters: [],
        responses: { 200: { description: 'List of categories' } }
      }
    },
    '/v1/movies': {
      get: {
        summary: 'List VOD movies',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
          { name: 'category_id', in: 'query', schema: { type: 'string' }, description: 'Category ID' },
          { name: 'year', in: 'query', schema: { type: 'string' }, description: 'Year' },
          { name: 'min_rating', in: 'query', schema: { type: 'string' }, description: 'Minimum rating' },
          { name: 'page', in: 'query', schema: { type: 'string' }, description: 'Page number' },
          { name: 'page_size', in: 'query', schema: { type: 'string' }, description: 'Page size' }
        ],
        responses: { 200: { description: 'List of movies' } }
      }
    },
    '/v1/movies/{id}': {
      get: {
        summary: 'Get single movie by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Movie details' }, 404: { description: 'Not found' } }
      }
    },
    '/v1/playlist.m3u': {
      get: {
        summary: 'Export filtered playlist as M3U',
        parameters: [
          { name: 'genre', in: 'query', schema: { type: 'string' }, description: 'Genre filter' },
          { name: 'limit', in: 'query', schema: { type: 'string' }, description: 'Limit' }
        ],
        responses: { 200: { description: 'M3U playlist' } }
      }
    },
    '/v1/admin/sync': {
      post: {
        summary: 'Trigger VOD sync',
        responses: { 200: { description: 'Sync started or completed' }, 409: { description: 'Sync already in progress' } }
      }
    },
    '/v1/metrics': {
      get: {
        summary: 'Prometheus metrics',
        responses: { 200: { description: 'Prometheus metrics' } }
      }
    }
  }
};

export default openApiSpec;
