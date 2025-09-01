import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

const el = document.getElementById("root");
if (!el) throw new Error("Fant ikke #root i index.html");

createRoot(el).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
