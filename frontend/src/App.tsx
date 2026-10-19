import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/ui";
import ExamHomePage from "./pages/ExamHomePage";
import ImportPage from "./pages/ImportPage";
import MistakesPage from "./pages/MistakesPage";
import VocabularyPage from "./pages/VocabularyPage";
import AnswerKeyPage from "./pages/AnswerKeyPage";
import PracticePage from "./pages/PracticePage";
import ResultPage from "./pages/ResultPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          {/* Workspace tabs (left sidebar): Exams / Library / Mistakes / Vocabulary / Settings. */}
          <Route path="/" element={<ExamHomePage />} />
          <Route path="/library" element={<ImportPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Exam flow: answer entry and review keep the sidebar; practice is full-screen. */}
          <Route path="/doc/:id/answers" element={<AnswerKeyPage />} />
          <Route path="/doc/:id/practice" element={<PracticePage />} />
          <Route path="/session/:sid/result" element={<ResultPage />} />

          {/* Legacy management route. */}
          <Route path="/manage" element={<Navigate to="/library" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
