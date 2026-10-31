import { API_URL } from "../config";
import type {
  MatchDetail,
  MatchStatus,
  MatchSummary,
  ReplayData,
  StatsResponse,
  TeamInfo,
} from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} for ${path}`);
  return (await res.json()) as T;
}

export const api = {
  matches: (status?: MatchStatus, limit = 50, signal?: AbortSignal) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (status) q.set("status", status);
    return getJson<MatchSummary[]>(`/api/matches?${q}`, signal);
  },
  match: (id: string, signal?: AbortSignal) =>
    getJson<MatchDetail>(`/api/matches/${encodeURIComponent(id)}`, signal),
  teams: (signal?: AbortSignal) => getJson<TeamInfo[]>("/api/teams", signal),
  stats: (signal?: AbortSignal) => getJson<StatsResponse>("/api/stats", signal),
  /** 404 (HttpError.status) if the demo has not been processed yet. */
  replay: (id: string, signal?: AbortSignal) =>
    getJson<ReplayData>(`/api/matches/${encodeURIComponent(id)}/replay`, signal),
};
