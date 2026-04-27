import {
  type ProviderRunStatus,
  type ProviderStatus,
  type RfpStage,
  type SignalType,
} from "@prisma/client";

import {
  PROVIDER_RUN_STATUS_LABELS,
  PROVIDER_STATUS_LABELS,
  SIGNAL_TYPE_LABELS,
  STAGE_LABELS,
} from "@/lib/constants";
import { formatConfidence } from "@/lib/utils";

import { Badge } from "@/components/ui";

export function StageBadge({ stage }: { stage: RfpStage }) {
  const className =
    stage === "ACTIVE_RFP"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : stage === "ACTIVE_EVALUATION"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : stage === "PRE_RFP"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : stage === "POST_DECISION"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return <Badge className={className}>{STAGE_LABELS[stage]}</Badge>;
}

export function SignalTypeBadge({ signalType }: { signalType: SignalType }) {
  const className =
    signalType === "DIRECT_PROCUREMENT" || signalType === "PUBLIC_TENDER"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : signalType === "TECHNOLOGY_CHANGE"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : signalType === "VENDOR_SIGNAL"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : signalType === "HIRING"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return <Badge className={className}>{SIGNAL_TYPE_LABELS[signalType]}</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const className =
    confidence >= 80
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : confidence >= 60
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <Badge className={className}>{formatConfidence(confidence)}</Badge>;
}

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const className =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "MOCK"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status === "PLANNED"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return <Badge className={className}>{PROVIDER_STATUS_LABELS[status]}</Badge>;
}

export function ProviderRunStatusBadge({ status }: { status: ProviderRunStatus }) {
  const className =
    status === "SUCCESS"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "PARTIAL"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return <Badge className={className}>{PROVIDER_RUN_STATUS_LABELS[status]}</Badge>;
}
