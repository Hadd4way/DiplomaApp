import * as React from 'react';
import type {
  RecommendationEntry,
  RecommendationProfileSummary,
  RecommendationsForBookResult,
  RecommendationsHomeResult
} from '../../shared/ipc';

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

type HomeState = {
  loading: boolean;
  error: string | null;
  recommendations: RecommendationEntry[];
  profile: RecommendationProfileSummary | null;
};

type BookState = {
  loading: boolean;
  error: string | null;
  similarBooks: RecommendationEntry[];
  moreByAuthor: RecommendationEntry[];
};

function toHomeState(result: RecommendationsHomeResult): HomeState {
  if (!result.ok) {
    return {
      loading: false,
      error: result.error,
      recommendations: [],
      profile: null
    };
  }

  return {
    loading: false,
    error: null,
    recommendations: result.recommendations,
    profile: result.profile
  };
}

function toBookState(result: RecommendationsForBookResult): BookState {
  if (!result.ok) {
    return {
      loading: false,
      error: result.error,
      similarBooks: [],
      moreByAuthor: []
    };
  }

  return {
    loading: false,
    error: null,
    similarBooks: result.similarBooks,
    moreByAuthor: result.moreByAuthor
  };
}

export function useHomeRecommendations(refreshKey?: string | number) {
  const [state, setState] = React.useState<HomeState>({
    loading: true,
    error: null,
    recommendations: [],
    profile: null
  });

  React.useEffect(() => {
    let canceled = false;

    setState((current) => ({ ...current, loading: true, error: null }));

    void getRendererApi()
      .recommendations.getHome()
      .then((result) => {
        if (!canceled) {
          setState(toHomeState(result));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
            recommendations: [],
            profile: null
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [refreshKey]);

  return state;
}

export function useBookRecommendations(bookId: string | null | undefined, refreshKey?: string | number) {
  const [state, setState] = React.useState<BookState>({
    loading: false,
    error: null,
    similarBooks: [],
    moreByAuthor: []
  });

  React.useEffect(() => {
    let canceled = false;

    if (!bookId) {
      setState({
        loading: false,
        error: null,
        similarBooks: [],
        moreByAuthor: []
      });
      return () => {
        canceled = true;
      };
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    void getRendererApi()
      .recommendations.getForBook({ bookId })
      .then((result) => {
        if (!canceled) {
          setState(toBookState(result));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
            similarBooks: [],
            moreByAuthor: []
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [bookId, refreshKey]);

  return state;
}
