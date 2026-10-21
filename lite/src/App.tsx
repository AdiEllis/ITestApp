import { useRoute } from "./lib/router";
import { useStore } from "./lib/use-store";
import { submissions } from "./lib/store";
import { TeacherShell } from "./ui/shell";
import { Landing } from "./Landing";
import { Dashboard } from "./teacher/Dashboard";
import { ExamsPage } from "./teacher/Exams";
import { NewExam } from "./teacher/NewExam";
import { Builder } from "./teacher/Builder";
import { Inbox } from "./teacher/Inbox";
import { Review } from "./teacher/Review";
import { Students } from "./teacher/Students";
import { Settings } from "./teacher/Settings";
import { TakeExam } from "./student/TakeExam";
import { FeedbackView } from "./student/FeedbackView";
import { MicCheckPage } from "./student/MicCheckPage";

export function App() {
  const route = useRoute();
  const pending = useStore(async () => (await submissions.list()).filter((s) => s.grading?.status !== "done").length) ?? 0;
  const [area, a, b] = route;

  if (area === "x" && a) return <TakeExam data={a} />;
  if (area === "f" && a) return <FeedbackView data={a} />;
  if (area === "mic") return <MicCheckPage />;
  if (area !== "t") return <Landing />;

  let page: React.ReactNode;
  if (!a) page = <Dashboard />;
  else if (a === "exams" && b === "new") page = <NewExam />;
  else if (a === "exams" && b) page = <Builder id={b} key={b} />;
  else if (a === "exams") page = <ExamsPage />;
  else if (a === "inbox") page = <Inbox />;
  else if (a === "review" && b) page = <Review id={decodeURIComponent(b)} key={b} />;
  else if (a === "students") page = <Students selected={b ? decodeURIComponent(b) : undefined} />;
  else if (a === "settings") page = <Settings />;
  else page = <Dashboard />;
  return (
    <TeacherShell route={route} pending={pending}>
      {page}
    </TeacherShell>
  );
}
