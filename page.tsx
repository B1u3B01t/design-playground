import PlaygroundClient from './PlaygroundClient';

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; host?: string }>;
}) {
  const { room, host } = await searchParams;
  return <PlaygroundClient roomId={room} isHost={host === '1'} />;
}
