import { RunBoardClient } from "@/components/coord/RunBoardClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RunPage({ params }: Props) {
  const { id } = await params;
  return <RunBoardClient runId={id} />;
}
