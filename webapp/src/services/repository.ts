import { createContext, useContext } from "react";
import type { PlatformRepository } from "../types";

export const RepositoryContext = createContext<PlatformRepository | null>(null);

export function useRepository(): PlatformRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("Repository is not configured.");
  return repository;
}
