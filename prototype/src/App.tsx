import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ViewAsProvider } from "./lib/viewAs";
import { LessonEditor } from "./pages/LessonEditor";
import { PoemFeedback } from "./pages/PoemFeedback";
import { ReadingFeedback } from "./pages/ReadingFeedback";
import { StudentProfile } from "./pages/StudentProfile";
import { Syllabus } from "./pages/Syllabus";
import { WorkshopHome } from "./pages/WorkshopHome";

function App() {
  return (
    <ViewAsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<WorkshopHome />} />
            <Route path="/poems/:poemId" element={<PoemFeedback />} />
            <Route path="/lessons/:classNumber" element={<LessonEditor />} />
            <Route path="/readings/:readingId" element={<ReadingFeedback />} />
            <Route path="/students/:studentId" element={<StudentProfile />} />
            <Route path="/syllabus" element={<Syllabus />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ViewAsProvider>
  );
}

export default App;
