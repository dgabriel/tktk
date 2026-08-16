import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { resolveAuthor } from "./authors";
import { getState, setViewingAsStudentId as persistViewingAsStudentId } from "./storage";

interface ViewAsContextValue {
  viewingAsStudentId: string | null;
  isStudentView: boolean;
  effectiveUserId: string;
  effectiveUserName: string;
  setViewingAsStudentId: (studentId: string | null) => void;
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

// App-wide "who's acting right now" — the PoC student-view toggle. Comment/
// reply/vote attribution and which admin-only controls render all key off
// this, not off `currentUser` directly, so switching the toggle takes
// effect immediately across every mounted page without a reload (unlike
// most state in this app, which is read fresh from storage per-render —
// this one specifically needs to be reactive since sibling components,
// e.g. the toggle itself and PollsList's create-poll form, both depend on
// it changing live).
export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewingAsStudentId, setViewingAsStudentIdState] = useState<string | null>(
    () => getState().viewingAsStudentId ?? null,
  );

  const setViewingAsStudentId = useCallback((studentId: string | null) => {
    persistViewingAsStudentId(studentId);
    setViewingAsStudentIdState(studentId);
  }, []);

  const { currentUser } = getState();
  const effectiveUserId = viewingAsStudentId ?? currentUser.username;
  const effectiveAuthor = resolveAuthor(effectiveUserId);

  return (
    <ViewAsContext.Provider
      value={{
        viewingAsStudentId,
        isStudentView: viewingAsStudentId !== null,
        effectiveUserId,
        effectiveUserName: effectiveAuthor.name,
        setViewingAsStudentId,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs(): ViewAsContextValue {
  const context = useContext(ViewAsContext);
  if (!context) throw new Error("useViewAs must be used within ViewAsProvider");
  return context;
}
