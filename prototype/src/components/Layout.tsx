import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AboutDemoModal } from "./AboutDemoModal";
import { ViewAsToggle } from "./ViewAsToggle";
import { getAboutDemoDismissed, setAboutDemoDismissed } from "../lib/storage";

export function Layout() {
  // Auto-open on every visit until the user has deliberately dismissed the
  // modal once (×, Escape, or clicking outside all count — onClose is the
  // only exit path). After that it still opens manually from the top bar.
  const [aboutOpen, setAboutOpen] = useState(() => !getAboutDemoDismissed());

  function handleClose() {
    setAboutDemoDismissed();
    setAboutOpen(false);
  }

  return (
    <>
      <ViewAsToggle onAboutClick={() => setAboutOpen(true)} />
      <Outlet />
      {aboutOpen && <AboutDemoModal onClose={handleClose} />}
    </>
  );
}
