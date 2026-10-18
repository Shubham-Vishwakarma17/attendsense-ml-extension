import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginForm, RegistrationForm } from "../components/AuthForms";
import { LectureForm } from "../components/LectureForm";
import { DemoRepository } from "../services/demoRepository";
import { RepositoryContext } from "../services/repository";
import type { Lecture, Unsubscribe, UserProfile } from "../types";
import { App } from "../App";

function withRepository(component: React.ReactNode, repository = new DemoRepository()) {
  return render(<RepositoryContext.Provider value={repository}><MemoryRouter>{component}</MemoryRouter></RepositoryContext.Provider>);
}

describe("authentication forms", () => {
  it("routes a demo teacher to the teacher dashboard", async () => {
    const user = userEvent.setup({ applyAccept: false });
    withRepository(<Routes><Route path="/" element={<LoginForm />} /><Route path="/teacher" element={<h1>Teacher destination</h1>} /></Routes>);
    await user.type(screen.getByLabelText("Email"), "teacher@demo.local");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Teacher destination" })).toBeInTheDocument();
  });

  it("makes the public-registration student role explicit", () => {
    withRepository(<RegistrationForm />);
    expect(screen.getByText(/always creates a student account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register as student/i })).toBeInTheDocument();
  });
});

describe("lecture creation", () => {
  it("normalizes assigned emails and submits a Meet-only lecture", async () => {
    const user = userEvent.setup(); const onCreate = vi.fn().mockResolvedValue(undefined);
    const profile: UserProfile = { uid: "teacher", name: "Teacher", normalizedEmail: "teacher@example.com", role: "teacher", createdAt: 1 };
    render(<LectureForm profile={profile} onCreate={onCreate} />);
    await user.type(screen.getByLabelText("Lecture title"), "ML Lecture");
    await user.type(screen.getByLabelText("Google Meet URL"), "https://meet.google.com/abc-defg-hij");
    await user.type(screen.getByLabelText("Scheduled date and time"), "2026-10-18T10:00");
    await user.type(screen.getByLabelText("Student emails"), "Student@Example.com, student@example.com");
    await user.click(screen.getByRole("button", { name: "Create lecture" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate.mock.calls[0][0].studentEmails).toEqual(["student@example.com"]);
    expect(screen.getByRole("status")).toHaveTextContent("Lecture created");
  });
});

describe("student dashboard", () => {
  it("shows the assigned lecture, explicit extension boundary, and compact prediction method", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/login");
    render(<App repository={new DemoRepository()} />);
    await user.type(await screen.findByLabelText("Email"), "student@demo.local");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Machine Learning Foundations" })).toBeInTheDocument();
    expect(screen.getByText(/website cannot start the extension automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO MODE/)).toBeInTheDocument();
    expect(screen.queryByText("Synthetic demo model. Results demonstrate the software workflow and are not evidence of real-world accuracy.")).not.toBeInTheDocument();
    await user.click(screen.getByText("How predictions work", { selector: "summary" }));
    expect(screen.getByText(/does not measure thoughts, comprehension, learning, or guaranteed attendance/i)).toBeVisible();
  });

  it("shows an upload validation message for a non-JSON file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    window.history.pushState({}, "", "/login");
    render(<App repository={new DemoRepository()} />);
    await user.type(screen.getByLabelText("Email"), "student@demo.local");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    const input = await screen.findByLabelText(/Upload session for Machine Learning Foundations/);
    await user.upload(input, new File(["text"], "session.txt", { type: "text/plain" }));
    expect(await screen.findByText(/Choose an AttendSense \.json export/)).toBeInTheDocument();
  });
});

describe("teacher results presentation", () => {
  it("shows readable prediction labels, status badges, metrics, and accessible probabilities", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/login");
    render(<App repository={new DemoRepository()} />);
    await user.type(screen.getByLabelText("Email"), "teacher@demo.local");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await user.click(await screen.findByRole("link", { name: "View results" }));
    expect((await screen.findAllByText("Submitted")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Passive listening").length).toBeGreaterThan(0);
    expect(screen.queryByText("passive_listening")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("link", { name: "Inspect submission" })[0]);
    expect(await screen.findByRole("heading", { name: "Class probabilities" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Passive listening probability/)).toBeInTheDocument();
    expect(screen.getByText(/2 recorded states/)).toBeInTheDocument();
    expect(screen.getByText("Scientific boundary:")).toBeInTheDocument();
  });
});

describe("lecture deletion dialog", () => {
  async function renderTeacher() {
    const repository = new DemoRepository();
    await repository.login("teacher@demo.local");
    window.history.pushState({}, "", "/teacher");
    render(<App repository={repository} />);
    await screen.findByRole("heading", { name: "Lecture overview" });
  }

  it("cancels safely and restores focus", async () => {
    const user = userEvent.setup(); await renderTeacher();
    const button = screen.getByRole("button", { name: "Delete" });
    await user.click(button);
    const dialog = screen.getByRole("dialog", { name: /Delete “Machine Learning Foundations”/ });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toBeInTheDocument();
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("closes with Escape and restores focus", async () => {
    const user = userEvent.setup(); await renderTeacher();
    const button = screen.getByRole("button", { name: "Delete" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("deletes only after confirmation in demo mode", async () => {
    const user = userEvent.setup(); await renderTeacher();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete lecture" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Machine Learning Foundations" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "No lectures yet" })).toBeInTheDocument();
  });
});

describe("dashboard states", () => {
  it("announces the teacher loading state", async () => {
    class LoadingRepository extends DemoRepository {
      override subscribeTeacherLectures(_teacherId: string, _callback: (lectures: Lecture[]) => void): Unsubscribe { return () => undefined; }
    }
    const repository = new LoadingRepository(); await repository.login("teacher@demo.local");
    window.history.pushState({}, "", "/teacher"); render(<App repository={repository} />);
    expect(await screen.findByText("Loading your lectures…")).toHaveAttribute("role", "status");
  });

  it("shows a concise repository error without exposing internals", async () => {
    class ErrorRepository extends DemoRepository {
      override subscribeTeacherLectures(_teacherId: string, _callback: (lectures: Lecture[]) => void, onError?: () => void): Unsubscribe {
        queueMicrotask(() => onError?.()); return () => undefined;
      }
    }
    const repository = new ErrorRepository(); await repository.login("teacher@demo.local");
    window.history.pushState({}, "", "/teacher"); render(<App repository={repository} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your lectures. Please try again.");
  });

  it("shows a useful empty state when the teacher has no lectures", async () => {
    const repository = new DemoRepository(); await repository.login("teacher@demo.local"); await repository.deleteLecture("demo-lecture");
    window.history.pushState({}, "", "/teacher"); render(<App repository={repository} />);
    expect(await screen.findByRole("heading", { name: "No lectures yet" })).toBeInTheDocument();
  });
});

describe("teacher result routes", () => {
  async function renderAsTeacher(path = "/teacher") {
    const repository = new DemoRepository();
    await repository.login("teacher@demo.local");
    window.history.pushState({}, "", path);
    render(<App repository={repository} />);
    return repository;
  }

  it("navigates from a lecture to its dedicated results route and back", async () => {
    const user = userEvent.setup();
    await renderAsTeacher();
    await user.click(await screen.findByRole("link", { name: "View results" }));
    expect(window.location.pathname).toBe("/teacher/lectures/demo-lecture/results");
    expect(await screen.findByRole("heading", { name: "Machine Learning Foundations", level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to dashboard" }));
    expect(await screen.findByRole("heading", { name: "Lecture overview" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/teacher");
  });

  it("keeps results isolated to the selected lecture", async () => {
    const repository = new DemoRepository();
    const second = await repository.createLecture({
      title: "Second Lecture", description: "Separate result set", meetUrl: "https://meet.google.com/second-demo-room",
      teacherId: "demo-teacher", teacherName: "Dr. Asha Mehta", studentEmails: ["unique@example.com"],
      scheduledAt: Date.now(), status: "scheduled"
    });
    await repository.login("teacher@demo.local");
    window.history.pushState({}, "", `/teacher/lectures/${second.id}/results`);
    render(<App repository={repository} />);
    expect((await screen.findAllByText("unique@example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByText("mira@demo.local")).not.toBeInTheDocument();
    expect(screen.queryByText("Machine Learning Foundations")).not.toBeInTheDocument();
  });

  it("navigates to the correct student submission and exposes mobile result cards", async () => {
    const user = userEvent.setup();
    await renderAsTeacher("/teacher/lectures/demo-lecture/results");
    expect(await screen.findByTestId("mobile-result-cards")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Inspect submission" })).toHaveLength(2);
    await user.click(screen.getAllByRole("link", { name: "Inspect submission" })[0]);
    expect(window.location.pathname).toBe("/teacher/lectures/demo-lecture/results/demo-student-2");
    expect(await screen.findByRole("heading", { name: "Mira Student", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/mira@demo\.local · Machine Learning Foundations/)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to results" }));
    expect(await screen.findByRole("heading", { name: "Machine Learning Foundations", level: 1 })).toBeInTheDocument();
  });

  it("shows safe unavailable states for unknown lectures and submissions", async () => {
    await renderAsTeacher("/teacher/lectures/unknown/results");
    expect(await screen.findByRole("heading", { name: "Lecture unavailable" })).toBeInTheDocument();
  });

  it("shows pending or unknown student detail routes as unavailable", async () => {
    await renderAsTeacher("/teacher/lectures/demo-lecture/results/demo-student-1");
    expect(await screen.findByRole("heading", { name: "Submission unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/unavailable, pending, or unrelated/)).toBeInTheDocument();
  });
});
