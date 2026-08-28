import { Outlet } from "react-router-dom";
import { ViewAsToggle } from "./ViewAsToggle";

export function Layout() {
  return (
    <>
      <ViewAsToggle />
      <Outlet />
    </>
  );
}
