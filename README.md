

---

## Project Structure

```
src/
  api/         # Express routes/controllers
  app/         # Application services (sync, playlist, etc.)
  domain/      # Entities, value objects, domain logic
  infra/       # DB, Redis, HTTP, logging
  migrations/  # DB migration scripts (JS/SQL)
  config/      # Env/config
  utils/       # Helpers
  index.ts     # Entrypoint
scripts/       # Migration runner, etc.
tests/         # Jest/Supertest tests
docker/        # Dockerfile, docker-compose.yml
.env           # Environment variables
vod-api.db     # SQLite DB (local)

```


# VOD API

RESTful API for Video On Demand (VOD) data, with incremental sync, TMDB enrichment, rate limiting, and OpenAPI documentation.

---




## Quick Start (Manual/Local Setup)

1. **Clone the repository:**
   ```sh
   git clone <repo-url>
   cd vcodes-typescript
   ```
2. **Configure environment:**
   - Copy `.env.example` to `.env` and fill in your Xtream, TMDB, and Redis settings.
3. **Install dependencies:**
   ```sh
   npm install
   ```
4. **Start Redis:**
   - Make sure a Redis server is running and accessible as configured in your `.env`.
5. **Run database migrations:**
   ```sh
   npm run migrate
   ```
   > **Note:** If you are using the default DB path and running locally, make sure the `db` folder exists in your project root:
   > ```sh
   > mkdir db
   > ```
6. **Start the API server:**
   ```sh
   npm run dev
   ```
7. **Run tests locally:**
   ```sh
   npm test
   # or
   npx jest
   ```
   - Make sure Redis is running and accessible as configured in your `.env` file.
   - The test database will be created and cleaned up automatically.

---

### Docker/Compose Setup (Optional)

1. **Build and start all services (API + Redis) with Docker Compose:**
   ```sh
   cd docker
   docker compose build
   docker compose up
   ```
2. **Run database migrations inside the container:**
   ```sh
   docker compose run --rm app npm run migrate
   ```
   - The API will be available at `http://localhost:3000`.
   - Redis will be available at `localhost:6379` (inside Docker network).
   - The SQLite DB file is persisted on your host as `vod-api.db`.
   - Make sure your `.env` file is present in the project root before building.
3. **Run tests in Docker Compose:**
   ```sh
   docker compose -f docker/docker-compose.test.yml up --build
   ```
   - This will spin up a test database and Redis, then run all Jest tests in the container.
   - To clean up after tests:
     ```sh
     docker compose -f docker/docker-compose.test.yml down -v
     ```

## Build, Lint, Test, and Local CI

- **Build:**
  ```sh
  npm run build
  ```
- **Lint:**
  ```sh
  npm run lint
  ```
- **Test:**
  ```sh
  npm test
  ```
- **Run all (local CI):**
  ```sh
  ./scripts/ci.sh
  ```
  (Runs lint, build, migrate, and tests)

---


## Usage


### Sync data
Trigger a full sync (categories, movies, TMDB enrichment):
```sh
curl -X POST http://localhost:3000/v1/admin/sync
```
**Response:**
```json
{
  "status": "started",
  "inserted": 100,
  "updated": 5,
  "skipped": 2,
  "errors": []
}
```

### List categories
```sh
curl http://localhost:3000/v1/categories
```
**Response:**
```json
[
  { "id": 1, "name": "Ação", "xtream_category_id": "137" },
  { "id": 2, "name": "Comédia", "xtream_category_id": "138" }
]
```

### List movies (with filters)
```sh
curl "http://localhost:3000/v1/movies?category_id=137&year=2025&min_rating=7"
```
**Response:**
```json
{
  "items": [
    {
      "id": 123,
      "xtream_vod_id": 1259522,
      "title_original": "O Ultimo Combate",
      "category_id": 1,
      "stream_icon": "https://...",
      "added_at_xtream": "2024-05-09T00:00:00Z",
      "container_extension": "mp4",
      "tmdb": {
        "tmdb_id": 1115623,
        "overview": "Michael Rivers...",
        "poster_path": "/w8sNJnX5ZEUgFBRf3vx1spI9BsU.jpg",
        "release_date": "2024-05-09",
        "runtime": 105,
        "vote_average": 6.9,
        "genres": ["Ação", "Thriller"]
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### Get movie details
```sh
curl http://localhost:3000/v1/movies/123
```
**Response:**
```json
{
  "id": 123,
  "xtream_vod_id": 1259522,
  "title_original": "O Ultimo Combate",
  "category_id": 1,
  "stream_icon": "https://...",
  "added_at_xtream": "2024-05-09T00:00:00Z",
  "container_extension": "mp4",
  "tmdb": {
    "tmdb_id": 1115623,
    "overview": "Michael Rivers...",
    "poster_path": "/w8sNJnX5ZEUgFBRf3vx1spI9BsU.jpg",
    "release_date": "2024-05-09",
    "runtime": 105,
    "vote_average": 6.9,
    "genres": ["Ação", "Thriller"]
  }
}
```

### Export playlist (M3U)
```sh
curl http://localhost:3000/v1/playlist.m3u
```
**Response:**
```m3u
#EXTM3U
#EXTINF:-1 tvg-id="1259522" tvg-name="O Ultimo Combate" tvg-logo="https://..." group-title="Ação",O Ultimo Combate
http://localhost:3000/stream/1259522.mp4
```

### Metrics
```sh
curl http://localhost:3000/metrics
```
**Response:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/v1/movies"} 10
...etc
```

### Healthcheck
```sh
curl http://localhost:3000/health
```
**Response:**
```json
{ "status": "ok" }
```

### API docs
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Swagger UI:   `http://localhost:3000/docs`

---


## Testing

### Run tests locally (without Docker)
```sh
npm test
# or
npx jest
```

### Run tests in Docker Compose (recommended for CI)
```sh
docker compose -f docker/docker-compose.test.yml up --build
```
To clean up after tests:
```sh
docker compose -f docker/docker-compose.test.yml down -v
```

---

## API URLs to Test All Features

- Sync:           `POST   /v1/admin/sync`
- List categories: `GET    /v1/categories`
- List movies:     `GET    /v1/movies`
- Movie details:   `GET    /v1/movies/:id`
- Playlist export: `GET    /v1/playlist.m3u`
- Metrics:         `GET    /metrics`
- Healthcheck:     `GET    /health`
- OpenAPI:         `GET    /openapi.json`
- Swagger UI:      `GET    /docs`

---

---


## Notes
- Redis must be running for rate limiting and caching.
- Run migrations before starting the API.
- Discrepancies between Xtream and TMDB are logged and stored in the database.

---


## License
MIT
