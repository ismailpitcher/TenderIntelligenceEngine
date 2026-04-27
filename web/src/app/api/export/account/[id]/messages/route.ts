import { getAccountIntelligenceById } from "@/lib/account-service";
import { renderMessages } from "@/lib/export-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const account = await getAccountIntelligenceById(id);
  if (!account) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "md";

  return new Response(renderMessages(account, format), {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${account.account.name.toLowerCase().replace(/\s+/g, "-")}-messages.${format === "txt" ? "txt" : "md"}"`,
    },
  });
}
