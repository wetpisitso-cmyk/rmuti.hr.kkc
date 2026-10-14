import { useQuery } from "@tanstack/react-query";
import { getJobs, rows } from "../services/api";
import type { Department, Round } from "../types/models";
export function useCatalog() {
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    staleTime: 60000,
  });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => rows<Department>("departments", "*", "name", 1000),
    staleTime: 60000,
  });
  const rounds = useQuery({
    queryKey: ["rounds"],
    queryFn: () => rows<Round>("recruitment_rounds", "*", "year_be", 1000),
    staleTime: 60000,
  });
  return { jobs, departments, rounds };
}
