import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err) };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: "#e5e7eb", background: "#0f172a" }}>
          <h2 style={{ marginTop: 0 }}>Noe gikk galt i Admin-UI</h2>
          <p style={{ opacity: 0.8 }}>Feilmelding: {this.state.message}</p>
          <p>Se DevTools → Console for mer info.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
