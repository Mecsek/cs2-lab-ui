import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Lobby } from "./pages/Lobby";
import { LivePage } from "./pages/LivePage";
import { ReplayPage } from "./pages/ReplayPage";
import "./styles.css";

function NotFound() {
  return (
    <div className="lobby">
      <h1>Not found</h1>
      <Link to="/">Back to lobby</Link>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/live/:id" element={<LivePage />} />
        <Route path="/replay/:id" element={<ReplayPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
