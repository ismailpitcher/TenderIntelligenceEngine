import { getAccountIntelligenceById } from "@/lib/account-service";
import { renderAccountMarkdown } from "@/lib/export-service";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const account = await getAccountIntelligenceById(id);
  if (!account) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(renderAccountMarkdown(account), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${account.account.name.toLowerCase().replace(/\s+/g, "-")}.md"`,
    },
  });
}
