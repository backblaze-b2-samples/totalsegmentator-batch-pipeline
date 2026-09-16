import { StudyList } from "@/components/studies/study-list";
import { NewStudyDialog } from "@/components/studies/study-form";

export default function StudiesPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="page-title">Studies</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Create, segment and manage CT/MRI studies. Each study and its derived
            mask + stats live under the <code>studies/</code> prefix in Backblaze B2.
          </p>
        </div>
        <NewStudyDialog />
      </div>
      <div className="animate-fade-in-up stagger-2">
        <StudyList />
      </div>
    </div>
  );
}
