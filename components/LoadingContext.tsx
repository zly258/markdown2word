import { createContext, useContext } from 'react';

interface LoadingContextType {
  addLoading: () => void;
  removeLoading: () => void;
}

export const LoadingContext = createContext<LoadingContextType>({
  addLoading: () => {},
  removeLoading: () => {},
});

export const useLoading = () => useContext(LoadingContext);
