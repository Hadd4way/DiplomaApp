import * as React from 'react';
import type { WishlistItem, WishlistSaveRequest } from '../../shared/ipc';

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

type WishlistState = {
  loading: boolean;
  error: string | null;
  items: WishlistItem[];
};

export function useWishlist(refreshKey?: string | number) {
  const [state, setState] = React.useState<WishlistState>({
    loading: true,
    error: null,
    items: []
  });

  const refresh = React.useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const result = await getRendererApi().wishlist.list();
      if (!result.ok) {
        setState({
          loading: false,
          error: result.error,
          items: []
        });
        return result;
      }

      setState({
        loading: false,
        error: null,
        items: result.items
      });
      return result;
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        items: []
      });
      throw error;
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const saveItem = React.useCallback(async (payload: WishlistSaveRequest) => {
    const result = await getRendererApi().wishlist.save(payload);
    if (!result.ok) {
      throw new Error(result.error);
    }

    setState((current) => {
      const hasExistingItem = current.items.some((item) => item.id === result.item.id);
      const nextItems = result.alreadySaved
        ? hasExistingItem
          ? current.items.map((item) => (item.id === result.item.id ? result.item : item))
          : [result.item, ...current.items]
        : [result.item, ...current.items];

      nextItems.sort((left, right) => {
        if (Number(right.readLater) !== Number(left.readLater)) {
          return Number(right.readLater) - Number(left.readLater);
        }
        return right.createdAt - left.createdAt;
      });

      return {
        ...current,
        items: nextItems
      };
    });

    return result;
  }, []);

  const removeItem = React.useCallback(async (itemId: string) => {
    const result = await getRendererApi().wishlist.remove({ itemId });
    if (!result.ok) {
      throw new Error(result.error);
    }

    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId)
    }));

    return result;
  }, []);

  const updateItem = React.useCallback(async (itemId: string, readLater: boolean) => {
    const result = await getRendererApi().wishlist.update({ itemId, readLater });
    if (!result.ok) {
      throw new Error(result.error);
    }

    setState((current) => {
      const nextItems = current.items.map((item) => (item.id === result.item.id ? result.item : item));
      nextItems.sort((left, right) => {
        if (Number(right.readLater) !== Number(left.readLater)) {
          return Number(right.readLater) - Number(left.readLater);
        }
        return right.createdAt - left.createdAt;
      });

      return {
        ...current,
        items: nextItems
      };
    });

    return result;
  }, []);

  return {
    ...state,
    refresh,
    saveItem,
    removeItem,
    updateItem
  };
}
