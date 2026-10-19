import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "./AppSidebar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  it("lists the workspace tabs", () => {
    renderAt("/");

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    for (const label of ["Exams", "Sessions", "Library", "Mistakes", "Vocabulary", "Settings"]) {
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
    expect(screen.getByRole("link", { name: "Mistakes" })).not.toHaveAttribute(
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
});
