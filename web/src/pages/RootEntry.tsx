import { Navigate } from "react-router";
import { useSettings } from "../components/SettingsProvider";
import { HomePage } from "./HomePage";

/** Site root: gallery, or redirect to the user's preferred default tool. */
export function RootEntry() {
  const { settings, hydrated } = useSettings();

  if (!hydrated) {
    return (
      <div className="tool-page container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const home = settings.defaultHome;
  if (home && home !== "/") {
    return <Navigate to={home} replace />;
  }
  return <HomePage />;
}
