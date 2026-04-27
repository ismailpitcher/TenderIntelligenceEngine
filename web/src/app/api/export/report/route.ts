import { getDashboardSnapshot } from "@/lib/account-service";
import { renderFullReport } from "@/lib/export-service";

export async function GET() {
  const snapshot = await getDashboardSnapshot();
  return new Response(renderFullReport(snapshot), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pitcher-signal-radar-report.md"',
    },
  });
}
