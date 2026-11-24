import "dotenv/config";
import { prisma } from "../src/lib/db";
import { processTarget } from "../src/lib/publisher";

const POLL_MS = 10_000;
let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Toma UN destino vencido de forma atómica (FOR UPDATE SKIP LOCKED): varios workers no se pisan. */
async function claimNext(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "PostTarget"
    SET status = 'PUBLISHING',
        "lockedAt" = (now() at time zone 'utc'),
        attempts = attempts + 1,
        "updatedAt" = (now() at time zone 'utc')
    WHERE id = (
      SELECT id FROM "PostTarget"
      WHERE status IN ('PENDING', 'SCHEDULED')
        AND "nextAttemptAt" <= (now() at time zone 'utc')
      ORDER BY "nextAttemptAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/** Si el worker se cayó a mitad de una subida, no reintenta solo (evita duplicados): lo marca con error. */
async function recoverStale() {
  await prisma.postTarget.updateMany({
    where: { status: "PUBLISHING", lockedAt: { lt: new Date(Date.now() - 15 * 60_000) } },
    data: {
      status: "FAILED",
      lockedAt: null,
      errorMessage: "La publicación se interrumpió porque el worker se detuvo. Revisa la plataforma y usa Reintentar si no se publicó.",
    },
  });
}

async function main() {
  console.log("[worker] CreatorHub worker iniciado");
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  while (!stopping) {
    try {
      await recoverStale();
      const id = await claimNext();
      if (id) {
        console.log(`[worker] publicando ${id}`);
        await processTarget(id);
        continue;
      }
    } catch (e) {
      console.error("[worker] error:", e);
    }
    await sleep(POLL_MS);
  }
  await prisma.$disconnect();
}

main();
