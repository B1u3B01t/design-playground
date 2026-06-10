import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

const PRESENCE_COLORS = [
  "#E11D48",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
];

function colorForUserId(userId: string): string {
  let index = 0;
  for (let i = 0; i < userId.length; i++) {
    index = (index + userId.charCodeAt(i)) % PRESENCE_COLORS.length;
  }
  return PRESENCE_COLORS[index]!;
}

function missingSecretResponse() {
  return NextResponse.json(
    {
      error: "missing_secret_key",
      message:
        "LIVEBLOCKS_SECRET_KEY is not set. Add it in Playground → Settings → Multiplayer, or set LIVEBLOCKS_SECRET_KEY in .env.local and restart the dev server.",
    },
    { status: 503 },
  );
}

/** Lightweight config probe — used client-side to show a setup toast before auth retries. */
export async function GET() {
  return NextResponse.json({
    configured: !!process.env.LIVEBLOCKS_SECRET_KEY?.trim(),
  });
}

export async function POST(request: Request) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
  if (!secret) return missingSecretResponse();

  let body: { room?: string; userId?: string; name?: string; isHost?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { room, userId, name, isHost } = body;
  if (!room || !userId) {
    return NextResponse.json({ error: "missing_room_or_user" }, { status: 400 });
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: name?.trim() || "Anonymous",
      color: colorForUserId(userId),
      isHost: !!isHost,
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { status, body: authBody } = await session.authorize();
  return new NextResponse(authBody, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
