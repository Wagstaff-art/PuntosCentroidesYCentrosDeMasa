import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { createModelState, modelReducer, type ModelAction, type ModelSnapshot, type ModelState } from './model';

const ModelStateContext = createContext<ModelState | null>(null);
const ModelDispatchContext = createContext<Dispatch<ModelAction> | null>(null);

export function ModelProvider({ children, initial }: { children: ReactNode; initial?: ModelSnapshot }) {
  const [state, dispatch] = useReducer(modelReducer, initial, (s) => createModelState(s));
  return (
    <ModelDispatchContext.Provider value={dispatch}>
      <ModelStateContext.Provider value={state}>{children}</ModelStateContext.Provider>
    </ModelDispatchContext.Provider>
  );
}

export function useModel(): ModelState {
  const ctx = useContext(ModelStateContext);
  if (!ctx) throw new Error('useModel debe usarse dentro de <ModelProvider>');
  return ctx;
}

export function useModelDispatch(): Dispatch<ModelAction> {
  const ctx = useContext(ModelDispatchContext);
  if (!ctx) throw new Error('useModelDispatch debe usarse dentro de <ModelProvider>');
  return ctx;
}
