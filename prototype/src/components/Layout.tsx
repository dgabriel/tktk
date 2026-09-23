import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AboutDemoModal } from "./AboutDemoModal";
import { ViewAsToggle } from "./ViewAsToggle";

export function Layout() {
  const [aboutOpen, setAboutOpen] = useState(false);
  return (
    <>
      <ViewAsToggle onAboutClick={() => setAboutOpen(true)} />
      <Outlet />
      {aboutOpen && <AboutDemoModal onClose={() => setAboutOpen(false)} />}
    </>
  );
}
