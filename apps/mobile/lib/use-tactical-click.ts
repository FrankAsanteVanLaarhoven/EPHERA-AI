import { useCallback, useEffect } from "react";
import { useSoundPrefs } from "./sound-prefs";
import {
  setTacticalClicksEnabled,
  tacticalClick,
  clickForRoute,
  type TacticalClick,
} from "./tactical-clicks";

/**
 * Hook: fire military clicks only when the client has them enabled.
 */
export function useTacticalClick() {
  const { tacticalClicks } = useSoundPrefs();

  useEffect(() => {
    setTacticalClicksEnabled(tacticalClicks);
  }, [tacticalClicks]);

  const click = useCallback(
    (kind: TacticalClick = "ui_tap") => {
      if (!tacticalClicks) return;
      void tacticalClick(kind);
    },
    [tacticalClicks],
  );

  const clickRoute = useCallback(
    (route: string) => {
      if (!tacticalClicks) return;
      void tacticalClick(clickForRoute(route));
    },
    [tacticalClicks],
  );

  return { click, clickRoute, enabled: tacticalClicks };
}
