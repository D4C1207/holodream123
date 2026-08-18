import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LocaleProvider } from "./i18n/LocaleContext";
import "./styles.css";
import "./d4c.css";
import "./favorites.css";
import "./d4c-layout-v2.css";
import "./decision-tools.css";
import "./manual-deck-lab.css";
import "./roster-constraints.css";
import "./special-order.css";
import "./roster-bloom.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);