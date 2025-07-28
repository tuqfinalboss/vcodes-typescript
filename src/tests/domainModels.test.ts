import { VodCategory } from '../domain/vodCategory';
import { VodItem } from '../domain/vodItem';
import { TmdbMovie } from '../domain/tmdbMovie';
import { SyncRun } from '../domain/syncRun';
import { TmdbCandidate } from '../domain/tmdbCandidate';

describe('Domain Models', () => {
  it('should create a valid VodCategory', () => {
    const cat: VodCategory = { id: 1, name: 'Action', xtreamCategoryId: '123' };
    expect(cat).toMatchObject({ id: 1, name: 'Action', xtreamCategoryId: '123' });
  });

  it('should create a valid VodItem', () => {
    const item: VodItem = {
      id: 1,
      xtreamVodId: 100,
      titleOriginal: 'Original',
      titleNormalized: 'original',
      categoryId: 1,
      streamIcon: 'icon.png',
      addedAtXtream: 1234567890,
      containerExtension: 'mp4',
    };
    expect(item.titleOriginal).toBe('Original');
  });

  it('should create a valid TmdbMovie', () => {
    const movie: TmdbMovie = {
      vodItemId: 1,
      tmdbId: 999,
      overview: 'A movie',
      genres: [{ id: 1, name: 'Action' }],
    };
    expect(movie.tmdbId).toBe(999);
  });

  it('should create a valid SyncRun', () => {
    const run: SyncRun = {
      id: 1,
      startedAt: new Date().toISOString(),
      status: 'running',
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
    expect(run.status).toBe('running');
  });

  it('should create a valid TmdbCandidate', () => {
    const candidate: TmdbCandidate = {
      vodItemId: 1,
      candidateJson: JSON.stringify([{ tmdbId: 1, title: 'Test' }]),
    };
    expect(candidate.candidateJson).toContain('Test');
  });
});
