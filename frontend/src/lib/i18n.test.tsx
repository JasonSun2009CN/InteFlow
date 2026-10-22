import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguagePicker } from "../components/ui/LanguagePicker";
import { I18nProvider, LANGUAGE_STORAGE_KEY, useI18n } from "./i18n";

function Probe() {
  const { t, language } = useI18n();
  return (
    <div>
      <p data-testid="translated">{t("Select an exam")}</p>
      <p data-testid="language">{language}</p>
    </div>
  );
}

describe("Chinese UI mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches the whole UI between English and Chinese from Settings", () => {
    render(
      <I18nProvider>
        <Probe />
        <LanguagePicker />
      </I18nProvider>,
    );

    expect(screen.getByTestId("translated")).toHaveTextContent("Select an exam");
    expect(screen.getByTestId("language")).toHaveTextContent("en");

    fireEvent.click(screen.getByRole("radio", { name: /中文/ }));

    expect(screen.getByTestId("translated")).toHaveTextContent("选择一套考试");
    expect(screen.getByTestId("language")).toHaveTextContent("zh");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      LANGUAGE_STORAGE_KEY,
      "zh",
    );
    expect(document.documentElement.lang).toBe("zh-CN");

    fireEvent.click(screen.getByRole("radio", { name: /English/ }));

    expect(screen.getByTestId("translated")).toHaveTextContent("Select an exam");
    expect(document.documentElement.lang).toBe("en");
  });
});
