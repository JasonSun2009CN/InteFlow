import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar, SIDEBAR_COMPACT_KEY } from "./AppSidebar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReset().mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockReset();
  });

  it("lists the workspace tabs", () => {
    renderAt("/");

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    for (const label of ["Exams", "Sessions", "Library", "Review", "Vocabulary", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href");
    }
  });

  it("marks the active tab from the current route", () => {
    renderAt("/library");

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Exams" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Review" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("matches nested routes to their tab, and exam sub-pages to none", () => {
    const { unmount } = renderAt("/library/anything");
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    unmount();

    renderAt("/doc/7/answers");
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("collapses to icons only and remembers the choice", () => {
    const { container } = renderAt("/library");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toHaveAttribute("data-compact", "false");
    expect(container.querySelector('img[src="/favicon.svg"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(nav).toHaveAttribute("data-compact", "true");
    expect(container.querySelector('img[src="/favicon.svg"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(window.localStorage.setItem).toHaveBeenLastCalledWith(
      SIDEBAR_COMPACT_KEY,
      "1",
    );
  });

  it("starts compact when the preference is stored", () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue("1");
    renderAt("/");

    expect(screen.getByRole("navigation", { name: "Main" })).toHaveAttribute(
      "data-compact",
      "true",
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
