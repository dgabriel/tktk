import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LessonEditor } from "./pages/LessonEditor";
import { PoemFeedback } from "./pages/PoemFeedback";
import { WorkshopHome } from "./pages/WorkshopHome";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkshopHome />} />
        <Route path="/poems/:poemId" element={<PoemFeedback />} />
        <Route path="/lessons/:classNumber" element={<LessonEditor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
