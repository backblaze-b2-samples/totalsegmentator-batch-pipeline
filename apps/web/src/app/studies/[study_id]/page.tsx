import { StudyDetail } from "@/components/studies/study-detail";

export default async function StudyDetailPage({
  params,
}: {
  params: Promise<{ study_id: string }>;
}) {
  const { study_id } = await params;
  return <StudyDetail studyId={study_id} />;
}
