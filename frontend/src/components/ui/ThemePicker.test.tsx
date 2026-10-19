import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "../../theme";
import { ThemePicker } from "./ThemePicker";

const getItem = () => vi.mocked(window.localStorage.getItem);
const setItem = () => vi.mocked(window.localStorage.setItem);

beforeEach(() => {
  getItem().mockReset();
  setItem().mockReset();
});

describe("ThemePicker", () => {
  it("offers every theme and marks the stored one", () => {
    getItem().mockReturnValue("paper-ink");
    render(<ThemePicker />);

    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Paper & Ink/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Clear Blue/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("switches the theme and stores the choice", () => {
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole("radio", { name: /Midnight Navy/ }));

    expect(setItem()).toHaveBeenCalledWith(THEME_STORAGE_KEY, "midnight-navy");
    expect(screen.getByRole("radio", { name: /Midnight Navy/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement.dataset.theme).toBe("midnight-navy");
  });
});
