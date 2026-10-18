import type { LectureStatus } from "../types";

const statusLabels: Record<LectureStatus, string> = {
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed"
};

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function statusLabel(status: LectureStatus) {
  return statusLabels[status];
}
