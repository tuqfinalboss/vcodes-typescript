export interface TmdbMovie {
  vodItemId: number;
  tmdbId: number;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  runtime?: number;
  voteAverage?: number;
  genres?: Array<{ id: number; name: string }>;
  originalTitle?: string;
  originalLanguage?: string;
  spokenLanguages?: Array<{ iso_639_1: string; name: string }>;
  productionCompanies?: Array<{ id: number; name: string }>;
  productionCountries?: Array<{ iso_3166_1: string; name: string }>;
  budget?: number;
  revenue?: number;
  keywords?: Array<{ id: number; name: string }>;
  homepage?: string;
  status?: string;
}
