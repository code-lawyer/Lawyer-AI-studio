import { CaseWorkspace } from "@/components/case-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

// For static export: revalidate=0 bypasses the generateStaticParams requirement.
// Dynamic case pages are resolved at runtime in the Tauri shell.
export const revalidate = 0;

export default async function CasePage({ params }: PageProps) {
  const { id } = await params;

  return <CaseWorkspace caseId={id} />;
}
