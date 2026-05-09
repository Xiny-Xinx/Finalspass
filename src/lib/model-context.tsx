"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { DEFAULT_MODEL, MODELS, type ModelId } from "@/lib/claude";

const STORAGE_KEY = "finalspass-model";

interface ModelContextValue {
  model: ModelId;
  setModel: (m: ModelId) => void;
}

const ModelContext = createContext<ModelContextValue>({
  model: DEFAULT_MODEL,
  setModel: () => {},
});

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<ModelId>(DEFAULT_MODEL);

  // 初始化时从 localStorage 恢复
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODELS.some((m) => m.id === stored)) {
        setModelState(stored as ModelId);
      }
    } catch { /* ignore */ }
  }, []);

  const setModel = useCallback((m: ModelId) => {
    setModelState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch { /* ignore */ }
  }, []);

  return (
    <ModelContext.Provider value={{ model, setModel }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel(): ModelContextValue {
  return useContext(ModelContext);
}
