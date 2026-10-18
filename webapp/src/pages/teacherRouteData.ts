import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { useRepository } from "../services/repository";
import type { Lecture, Submission } from "../types";

export function useOwnedLecture(lectureId: string | undefined) {
  const { profile } = useAuth();
  const repository = useRepository();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLecture(null); setLoading(true); setError("");
    if (!profile || !lectureId) { setLoading(false); return; }
    try {
      return repository.subscribeTeacherLectures(profile.uid, (lectures) => {
        setLecture(lectures.find((item) => item.id === lectureId) ?? null);
        setLoading(false);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this lecture.");
      setLoading(false);
    }
  }, [lectureId, profile, repository]);
  return { lecture, loading, error };
}

export function useLectureSubmissions(lectureId: string | undefined, enabled: boolean) {
  const repository = useRepository();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  useEffect(() => {
    setSubmissions([]); setLoading(enabled); setError("");
    if (!lectureId || !enabled) { setLoading(false); return; }
    try {
      return repository.subscribeToLectureSubmissions(lectureId, (items) => {
        setSubmissions(items); setLoading(false);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load submissions.");
      setLoading(false);
    }
  }, [enabled, lectureId, repository]);
  return { submissions, loading, error };
}
