import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  clearStrokeComment,
  clearStrokesForPoem,
  getStrokesForPoem,
  replaceStrokesForPoem,
  saveStroke,
  setStrokeComment,
} from "../lib/storage";
import type { OverlayPoint, OverlayStroke } from "../types";

export type OverlayTool = "draw" | "erase" | "comment";

// Fraction of the container's width/height a stylus/finger must be within
// to erase a point. Fraction-based (not pixels) so it scales sensibly
// across phone/tablet/desktop, matching how strokes themselves are stored.
const ERASER_RADIUS = 0.02;

// Slightly larger than ERASER_RADIUS — tapping precisely on a thin line
// with a fingertip is harder than sweeping an eraser across it, so give
// "tap to comment" a more forgiving hit target.
const COMMENT_HIT_RADIUS = 0.03;

function distance(a: OverlayPoint, b: OverlayPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestStrokeId(strokes: OverlayStroke[], point: OverlayPoint, maxDist: number): string | null {
  let closestId: string | null = null;
  let closestDist = maxDist;
  for (const stroke of strokes) {
    for (const p of stroke.points) {
      const d = distance(p, point);
      if (d < closestDist) {
        closestDist = d;
        closestId = stroke.id;
      }
    }
  }
  return closestId;
}

// `enabled` is owned by the caller — it reflects both the page's top-level
// Highlight/Markup mode switch *and* whether the currently-viewed author is
// the current user (you can look at a classmate's marks, but not draw,
// erase, or comment on them — see `viewAuthorId` below). There's no "off"
// tool: within markup mode you're always drawing, erasing, or commenting.
//
// `strokes` returned here is *every* author's strokes for the poem — the
// page uses it unfiltered for the sidebar comment list ("show all the
// markup comments" regardless of who you're currently viewing) and filters
// it itself for what actually gets drawn on the poem. Interaction
// (`eraseAt`, the comment tool's hit-test, and new-stroke authorship) is
// scoped to `viewAuthorId` internally, though, so you can never affect a
// mark that isn't the one you're currently looking at/editing.
export function useMarkupOverlay(poemId: string, enabled: boolean, viewAuthorId: string) {
  const [tool, setToolState] = useState<OverlayTool>("draw");
  const [strokes, setStrokes] = useState<OverlayStroke[]>(() => getStrokesForPoem(poemId));
  const [liveStroke, setLiveStroke] = useState<OverlayPoint[] | null>(null);
  const [activeCommentStrokeId, setActiveCommentStrokeId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  useEffect(() => {
    setStrokes(getStrokesForPoem(poemId));
    setToolState("draw");
    setLiveStroke(null);
    setActiveCommentStrokeId(null);
    setCommentDraft("");
  }, [poemId]);

  useEffect(() => {
    if (!enabled) {
      isDrawingRef.current = false;
      setLiveStroke(null);
      setActiveCommentStrokeId(null);
      setCommentDraft("");
    }
  }, [enabled]);

  // Switching away from the comment tool closes any open note popover.
  const setTool = useCallback((next: OverlayTool) => {
    setToolState(next);
    if (next !== "comment") {
      setActiveCommentStrokeId(null);
      setCommentDraft("");
    }
  }, []);

  const toPoint = useCallback((event: ReactPointerEvent): OverlayPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  // Splits every stroke around any point within ERASER_RADIUS of `point`,
  // dropping the erased points and turning the surviving runs on either
  // side into their own strokes — a real (partial) eraser, not
  // delete-the-whole-stroke. Strokes belonging to a different author than
  // `viewAuthorId` are left untouched entirely — even though they're not
  // visible right now, they must never be affected by an erase gesture.
  const eraseAt = useCallback(
    (point: OverlayPoint) => {
      setStrokes((prev) => {
        const next: OverlayStroke[] = [];
        for (const stroke of prev) {
          if (stroke.authorId !== viewAuthorId) {
            next.push(stroke);
            continue;
          }
          let anyHit = false;
          let run: OverlayPoint[] = [];
          let splitIndex = 0;
          const pieces: OverlayStroke[] = [];
          const flush = () => {
            if (run.length > 1) {
              pieces.push({ ...stroke, id: `${stroke.id}-${splitIndex++}`, points: run });
            }
            run = [];
          };
          for (const p of stroke.points) {
            if (distance(p, point) < ERASER_RADIUS) {
              anyHit = true;
              flush();
            } else {
              run.push(p);
            }
          }
          flush();
          if (anyHit) next.push(...pieces);
          else next.push(stroke);
        }
        return next;
      });
    },
    [viewAuthorId],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!enabled) return;
      event.preventDefault();
      const point = toPoint(event);
      if (!point) return;

      if (tool === "comment") {
        // A tap, not a drag — select the nearest stroke (among the
        // currently-viewed author's strokes only) and open its note
        // popover. No pointer capture / move tracking needed for this tool.
        const viewableStrokes = strokesRef.current.filter((stroke) => stroke.authorId === viewAuthorId);
        const hitId = findNearestStrokeId(viewableStrokes, point, COMMENT_HIT_RADIUS);
        if (hitId) {
          const stroke = strokesRef.current.find((candidate) => candidate.id === hitId);
          setActiveCommentStrokeId(hitId);
          setCommentDraft(stroke?.comment ?? "");
        }
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;
      if (tool === "draw") setLiveStroke([point]);
      else eraseAt(point);
    },
    [enabled, tool, toPoint, eraseAt, viewAuthorId],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!isDrawingRef.current || !enabled || tool === "comment") return;
      event.preventDefault();
      const point = toPoint(event);
      if (!point) return;
      if (tool === "draw") setLiveStroke((prev) => (prev ? [...prev, point] : [point]));
      else eraseAt(point);
    },
    [enabled, tool, toPoint, eraseAt],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (tool === "draw") {
      // Side effects (saveStroke writes to localStorage) must not live
      // inside a setState updater — React StrictMode double-invokes
      // updaters in dev to catch impurities like this, which was
      // duplicating every saved stroke. Read `liveStroke` directly instead.
      if (liveStroke && liveStroke.length > 1) {
        const saved = saveStroke({ poemId, authorId: viewAuthorId, points: liveStroke });
        setStrokes((prev) => [...prev, saved]);
      }
      setLiveStroke(null);
    } else if (tool === "erase") {
      replaceStrokesForPoem(poemId, strokesRef.current);
    }
  }, [tool, poemId, liveStroke, viewAuthorId]);

  const clearAll = useCallback(() => {
    clearStrokesForPoem(poemId, viewAuthorId);
    setStrokes((prev) => prev.filter((stroke) => stroke.authorId !== viewAuthorId));
  }, [poemId, viewAuthorId]);

  const saveStrokeCommentText = useCallback(() => {
    if (!activeCommentStrokeId) return;
    const text = commentDraft.trim();
    if (text) {
      const updated = setStrokeComment(activeCommentStrokeId, text);
      if (updated) {
        setStrokes((prev) => prev.map((stroke) => (stroke.id === updated.id ? updated : stroke)));
      }
    }
    setActiveCommentStrokeId(null);
    setCommentDraft("");
  }, [activeCommentStrokeId, commentDraft]);

  const cancelStrokeComment = useCallback(() => {
    setActiveCommentStrokeId(null);
    setCommentDraft("");
  }, []);

  // Callable for any stroke, not just the one currently open in the
  // composer — this is what the sidebar list's "Delete comment" button
  // uses, since it can target a stroke whose composer isn't open at all,
  // and belonging to any author (an instructor can remove any note).
  const removeStrokeComment = useCallback(
    (strokeId: string) => {
      const updated = clearStrokeComment(strokeId);
      if (updated) {
        setStrokes((prev) => prev.map((stroke) => (stroke.id === updated.id ? updated : stroke)));
      }
      if (activeCommentStrokeId === strokeId) {
        setActiveCommentStrokeId(null);
        setCommentDraft("");
      }
    },
    [activeCommentStrokeId],
  );

  const deleteStrokeComment = useCallback(() => {
    if (!activeCommentStrokeId) return;
    removeStrokeComment(activeCommentStrokeId);
  }, [activeCommentStrokeId, removeStrokeComment]);

  return {
    tool,
    setTool,
    strokes,
    liveStroke,
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearAll,
    activeCommentStrokeId,
    commentDraft,
    setCommentDraft,
    saveStrokeComment: saveStrokeCommentText,
    cancelStrokeComment,
    deleteStrokeComment,
    removeStrokeComment,
  };
}
