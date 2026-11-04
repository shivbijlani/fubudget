export type Income = {
  label: string;
  amount: number;
  /** Groups sources by earner or kind, such as "Cash" or "Rental". Sources in a group share a color. */
  group?: string;
  color?: string;
  note?: string;
};

/** A right-side Sankey node. When a plan has none, the buckets are used. */
export type Flow = {
  name: string;
  amount: number;
  color?: string;
  note?: string;
};

export type IncomeDetailRow = {
  source: string;
  ytd?: number;
  projected?: number;
  basis?: string;
};

export type IncomeDetailGroup = {
  label: string;
  rows: IncomeDetailRow[];
};

export type Bucket = {
  id: string;
  label: string;
  /** null means the bucket has no IWT target, such as cash not yet assigned. */
  targetMin: number | null;
  targetMax: number | null;
  color: string;
  /** Explicit $/mo. When omitted, the sum of this bucket's envelopes is used. */
  amount?: number;
  /** Free-text comparison note. When omitted, one is generated from the target band. */
  note?: string;
};

export type Envelope = {
  bucket: string;
  name: string;
  amount: number;
};

export type InvestmentRow = {
  component: string;
  perYear?: number;
  perMonth?: number;
  note?: string;
  total?: boolean;
};

export type AppendixRow = {
  source: string;
  location?: string;
  usedFor?: string;
  version?: string;
};

export type PlanParams = {
  title: string;
  subtitle: string;
  updated: string;
  baseNote: string;
  headline: string;
  numbersNote: string;
  sankeyNote: string;
  investmentsNote: string;
  incomeNote: string;
  incomes: Income[];
  incomeDetail: IncomeDetailGroup[];
  /** Label for the center Sankey node. */
  sankeyCenterLabel: string;
  /** Center node value. Defaults to the larger of total income and total outflow. */
  sankeyCenterTotal?: number;
  /** Right-side Sankey nodes. Empty means use the buckets. */
  sankeyFlows: Flow[];
  /** Money in that is not planned anywhere yet, shown as its own right-side node. */
  sankeyUnallocated?: number;
  buckets: Bucket[];
  envelopes: Envelope[];
  investments: InvestmentRow[];
  appendix: AppendixRow[];
  sources: string[];
};

export type PlanPayload = {
  version: number;
  params?: Partial<PlanParams>;
};

export const PLAN_VERSION = 1;

export const STANDARD_BUCKETS: Bucket[] = [
  { id: "fixed", label: "Fixed costs", targetMin: 50, targetMax: 60, color: "#2c6eb4" },
  { id: "investments", label: "Investments", targetMin: 10, targetMax: 10, color: "#2a7f62" },
  { id: "savings", label: "Savings", targetMin: 5, targetMax: 10, color: "#b48c1e" },
  { id: "guilt", label: "Guilt-free spending", targetMin: 20, targetMax: 35, color: "#a050a0" },
];

/** The empty shell a shared plan is merged over. Contains no household data at all. */
export function blankPlan(): PlanParams {
  return {
    title: "Your Conscious Spending Plan",
    subtitle: "",
    updated: "",
    baseNote: "",
    headline: "",
    numbersNote: "",
    sankeyNote: "",
    investmentsNote: "",
    incomeNote: "",
    incomes: [],
    incomeDetail: [],
    sankeyCenterLabel: "All income",
    sankeyFlows: [],
    buckets: STANDARD_BUCKETS.map((bucket) => ({ ...bucket })),
    envelopes: [],
    investments: [],
    appendix: [],
    sources: [],
  };
}

/** Fictional demo household shown when no plan arrives in the URL. */
export function demoPlan(): PlanParams {
  return {
    ...blankPlan(),
    title: "Demo Conscious Spending Plan",
    subtitle: "Fictional example household. Every name and number on this page is made up.",
    baseNote:
      "Two take-home paychecks plus a side gig bring in $5,950/mo of cash, and paycheck investments add $1,350/mo, for a $7,300/mo base. Monthly figures are annual averages.",
    headline:
      "This demo household sits close to the IWT bands: fixed costs are in range, investments are above the 10% starting point, and guilt-free spending has room to grow.",
    numbersNote: "Investments here include a small employer match. Swap in your own plan with the Edit data panel.",
    investmentsNote: "Demo numbers only.",
    incomeNote: "Every income source flows into one total, which then splits into the four IWT buckets.",
    sankeyCenterLabel: "All income after tax",
    incomes: [
      { label: "Partner A take-home pay", amount: 3400, group: "Partner A", note: "Salary after tax and payroll deductions" },
      { label: "Partner B take-home pay", amount: 2250, group: "Partner B", note: "Salary after tax and payroll deductions" },
      { label: "Weekend tutoring", amount: 300, group: "Side income", note: "Averaged over the year" },
      { label: "Partner A 401(k)", amount: 900, group: "Partner A", note: "Paycheck deduction" },
      { label: "Partner A employer match", amount: 250, group: "Partner A", note: "Employer money" },
      { label: "Partner B Roth IRA", amount: 200, group: "Partner B", note: "Monthly auto transfer" },
    ],
    envelopes: [
      { bucket: "fixed", name: "Rent", amount: 2300 },
      { bucket: "fixed", name: "Groceries", amount: 700 },
      { bucket: "fixed", name: "Utilities", amount: 180 },
      { bucket: "fixed", name: "Phone and internet", amount: 120 },
      { bucket: "fixed", name: "Insurance", amount: 210 },
      { bucket: "fixed", name: "Transit", amount: 140 },
      { bucket: "fixed", name: "Student loan minimum", amount: 250 },
      { bucket: "investments", name: "401(k) employee", amount: 900 },
      { bucket: "investments", name: "Employer match", amount: 250 },
      { bucket: "investments", name: "Roth IRA", amount: 200 },
      { bucket: "savings", name: "Emergency fund", amount: 300 },
      { bucket: "savings", name: "Car repairs", amount: 100 },
      { bucket: "savings", name: "Gifts", amount: 80 },
      { bucket: "savings", name: "Annual subscriptions", amount: 40 },
      { bucket: "guilt", name: "Dining out", amount: 500 },
      { bucket: "guilt", name: "Travel", amount: 450 },
      { bucket: "guilt", name: "Hobbies", amount: 250 },
      { bucket: "guilt", name: "Clothing", amount: 150 },
      { bucket: "guilt", name: "Fun money", amount: 180 },
    ],
    investments: [
      { component: "401(k) employee", perYear: 10800, perMonth: 900, note: "Paycheck deduction" },
      { component: "Employer match", perYear: 3000, perMonth: 250, note: "Employer money" },
      { component: "Roth IRA", perYear: 2400, perMonth: 200, note: "Monthly auto transfer" },
      { component: "Total investments", perYear: 16200, perMonth: 1350, total: true },
    ],
    appendix: [
      { source: "Demo data", location: "Built into fubudget", usedFor: "Every number on this page", version: "Fictional" },
    ],
    sources: [
      "This is fictional demo data. Load your own plan by opening a fubudget share link, or paste JSON into the Edit data panel.",
    ],
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function num(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function arr(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

function sanitizeBuckets(input: unknown, base: Bucket[]): Bucket[] {
  const items = arr(input);
  if (!items) return base;
  const result = base.map((bucket) => ({ ...bucket }));
  for (const item of items) {
    const id = str(item.id).trim();
    if (!id) continue;
    const existing = result.find((bucket) => bucket.id === id);
    const target: Bucket = existing ?? { id, label: id, targetMin: null, targetMax: null, color: "#64748b" };
    if (typeof item.label === "string" && item.label.trim()) target.label = item.label;
    for (const key of ["targetMin", "targetMax"] as const) {
      if (item[key] === null) target[key] = null;
      const value = num(item[key]);
      if (value !== undefined) target[key] = value;
    }
    if (typeof item.color === "string" && HEX_COLOR.test(item.color)) target.color = item.color;
    const amount = num(item.amount);
    if (amount !== undefined) target.amount = amount;
    if (typeof item.note === "string") target.note = item.note;
    if (!existing) result.push(target);
  }
  return result;
}

/** Validates an untrusted object and merges it over the blank plan. Unknown keys are dropped. */
export function sanitizePlan(input: unknown, base: PlanParams = blankPlan()): PlanParams {
  if (!input || typeof input !== "object") return base;
  const rec = input as Record<string, unknown>;
  const plan: PlanParams = { ...base };
  for (const key of [
    "title",
    "subtitle",
    "updated",
    "baseNote",
    "headline",
    "numbersNote",
    "sankeyNote",
    "investmentsNote",
    "incomeNote",
    "sankeyCenterLabel",
  ] as const) {
    if (rec[key] !== undefined) plan[key] = str(rec[key], base[key]);
  }
  plan.sankeyCenterTotal = num(rec.sankeyCenterTotal) ?? base.sankeyCenterTotal;
  plan.sankeyUnallocated = num(rec.sankeyUnallocated) ?? base.sankeyUnallocated;
  plan.buckets = sanitizeBuckets(rec.buckets, base.buckets);
  const color = (value: unknown) => (typeof value === "string" && HEX_COLOR.test(value) ? value : undefined);
  const optional = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);
  const incomes = arr(rec.incomes);
  if (incomes) {
    plan.incomes = incomes
      .map((item) => ({
        label: str(item.label).trim(),
        amount: num(item.amount) ?? 0,
        group: optional(item.group),
        color: color(item.color),
        note: optional(item.note),
      }))
      .filter((item) => item.label);
  }
  const flows = arr(rec.sankeyFlows);
  if (flows) {
    plan.sankeyFlows = flows
      .map((item) => ({
        name: str(item.name).trim(),
        amount: num(item.amount) ?? 0,
        color: color(item.color),
        note: optional(item.note),
      }))
      .filter((item) => item.name);
  }
  const incomeDetail = arr(rec.incomeDetail);
  if (incomeDetail) {
    plan.incomeDetail = incomeDetail
      .map((group) => ({
        label: str(group.label).trim(),
        rows: (arr(group.rows) ?? [])
          .map((row) => ({
            source: str(row.source).trim(),
            ytd: num(row.ytd),
            projected: num(row.projected),
            basis: optional(row.basis),
          }))
          .filter((row) => row.source),
      }))
      .filter((group) => group.label && group.rows.length);
  }
  const envelopes = arr(rec.envelopes);
  if (envelopes) {
    plan.envelopes = envelopes
      .map((item) => ({ bucket: str(item.bucket).trim(), name: str(item.name).trim(), amount: num(item.amount) ?? 0 }))
      .filter((item) => item.bucket && item.name);
  }
  const investments = arr(rec.investments);
  if (investments) {
    plan.investments = investments
      .map((item) => ({
        component: str(item.component).trim(),
        perYear: num(item.perYear),
        perMonth: num(item.perMonth),
        note: str(item.note),
        total: item.total === true,
      }))
      .filter((item) => item.component);
  }
  const appendix = arr(rec.appendix);
  if (appendix) {
    plan.appendix = appendix
      .map((item) => ({
        source: str(item.source).trim(),
        location: str(item.location),
        usedFor: str(item.usedFor),
        version: str(item.version),
      }))
      .filter((item) => item.source);
  }
  if (Array.isArray(rec.sources)) {
    plan.sources = rec.sources.filter((s): s is string => typeof s === "string" && s.trim() !== "");
  }
  return plan;
}

/**
 * Accepts either a versioned payload ({ version: 1, params }) or a bare params object,
 * and returns a sanitized plan, or null when the payload is unusable.
 */
export function planFromPayload(candidate: unknown): PlanParams | null {
  if (!candidate || typeof candidate !== "object") return null;
  const rec = candidate as Record<string, unknown>;
  if (typeof rec.version === "number") {
    if (rec.version !== PLAN_VERSION) {
      console.warn(`Unsupported plan payload version: ${rec.version}`);
      return null;
    }
    if (!rec.params || typeof rec.params !== "object") return null;
    return sanitizePlan(rec.params);
  }
  return sanitizePlan(rec);
}

export type BucketSummary = Bucket & {
  value: number;
  share: number;
  targetLabel: string;
  status: string;
  envelopes: Envelope[];
};

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

export function targetLabel(bucket: Pick<Bucket, "targetMin" | "targetMax">): string {
  if (bucket.targetMin === null || bucket.targetMax === null) return "None";
  return bucket.targetMin === bucket.targetMax ? `${bucket.targetMin}%` : `${bucket.targetMin} to ${bucket.targetMax}%`;
}

function statusFor(share: number, bucket: Bucket): string {
  if (bucket.targetMin === null || bucket.targetMax === null) return "";
  const pct = share * 100;
  if (pct < bucket.targetMin) return `${(bucket.targetMin - pct).toFixed(1)} points below the band`;
  if (pct > bucket.targetMax) return `${(pct - bucket.targetMax).toFixed(1)} points above the band`;
  return "Inside the band";
}

export function summarize(plan: PlanParams) {
  const raw = plan.buckets.map((bucket) => {
    const envelopes = plan.envelopes.filter((envelope) => envelope.bucket === bucket.id);
    const value = bucket.amount ?? envelopes.reduce((sum, envelope) => sum + envelope.amount, 0);
    return { bucket, envelopes, value };
  });
  const total = raw.reduce((sum, item) => sum + item.value, 0);
  const buckets: BucketSummary[] = raw.map(({ bucket, envelopes, value }) => {
    const share = total > 0 ? value / total : 0;
    return {
      ...bucket,
      value,
      share,
      targetLabel: targetLabel(bucket),
      status: bucket.note || statusFor(share, bucket),
      envelopes,
    };
  });
  const incomeTotal = plan.incomes.reduce((sum, income) => sum + income.amount, 0);
  const orphanEnvelopes = plan.envelopes.filter((envelope) => !plan.buckets.some((bucket) => bucket.id === envelope.bucket));
  return { total, buckets, incomeTotal, orphanEnvelopes };
}

export function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}
