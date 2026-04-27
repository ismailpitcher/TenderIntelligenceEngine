import { prisma } from "@/lib/prisma";
import type { SettingsSnapshot } from "@/lib/types";

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const [keywords, competitors, scoringWeights, targetSettings, providerConfigs] = await Promise.all([
    prisma.searchKeyword.findMany({
      where: { active: true },
      orderBy: [{ groupName: "asc" }, { term: "asc" }],
    }),
    prisma.competitor.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.scoringWeight.findMany({
      orderBy: { label: "asc" },
    }),
    prisma.targetProfileSetting.findMany({
      orderBy: [{ type: "asc" }, { label: "asc" }],
    }),
    prisma.providerConfig.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    keywords,
    competitors,
    scoringWeights,
    targetSettings,
    providerConfigs,
  };
}
