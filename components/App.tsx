"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sankey, incomeColors } from "@/components/Sankey";
import {
  demoPlan,
  formatMoney,
  formatShare,
  planFromPayload,
  summarize,
  type Flow,
  type PlanParams,
} from "@/lib/plan";
import { buildShareUrl, decodePlan, rawPlanFromQuery } from "@/lib/share";

type Source = "demo" | "url" | "edited";

const SECTIONS = ["numbers", "sankey", "income", "investments", "envelopes", "explainer", "sources", "appendix", "data"] as const;
const DEFAULT_OPEN = SECTIONS.filter((section) => section !== "data");

function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted text-left">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const th = "border-b px-3 py-2 font-semibold";
const td = "border-b px-3 py-2 align-top";
const num = "text-right whitespace-nowrap tabular-nums";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export default function App() {
  const searchParams = useSearchParams();
  const raw = rawPlanFromQuery(searchParams);
  const [plan, setPlan] = useState<PlanParams | null>(() => (raw ? null : demoPlan()));
  const [source, setSource] = useState<Source>(raw ? "url" : "demo");
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<string[]>(DEFAULT_OPEN);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!raw) {
      setPlan(demoPlan());
      setSource("demo");
      return;
    }
    decodePlan(raw).then((decoded) => {
      if (cancelled) return;
      if (decoded) {
        setPlan(decoded);
        setSource("url");
        setLoadError(false);
      } else {
        setPlan(demoPlan());
        setSource("demo");
        setLoadError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  useEffect(() => {
    if (plan) setDraft(JSON.stringify(plan, null, 2));
  }, [plan]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const summary = useMemo(() => (plan ? summarize(plan) : null), [plan]);

  const handleShare = useCallback(async () => {
    if (!plan) return;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await copyText(await buildShareUrl(plan));
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy plan link", error);
      setCopyStatus("error");
    }
    copyTimer.current = setTimeout(() => setCopyStatus("idle"), 3000);
  }, [plan]);

  const applyDraft = () => {
    try {
      const next = planFromPayload(JSON.parse(draft));
      if (!next) throw new Error("Unsupported payload version");
      setPlan(next);
      setSource("edited");
      setDraftError(null);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Could not read that JSON");
    }
  };

  if (!plan || !summary) {
    return <div className="mx-auto max-w-5xl p-6 text-muted-foreground">Loading plan...</div>;
  }

  const { total, buckets, incomeTotal, orphanEnvelopes } = summary;
  const envelopeCount = plan.envelopes.length;
  const sourceColors = incomeColors(plan.incomes);
  const flows: Flow[] = plan.sankeyFlows.length
    ? plan.sankeyFlows
    : buckets.map((bucket) => ({ name: bucket.label, amount: bucket.value, color: bucket.color }));

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-8">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">fubudget</p>
        <h1 className="text-3xl font-bold leading-tight">{plan.title}</h1>
        {(plan.subtitle || plan.updated) && (
          <p className="mt-1 text-muted-foreground">
            {plan.subtitle}
            {plan.subtitle && plan.updated ? " · " : ""}
            {plan.updated && `Updated ${plan.updated}`}
          </p>
        )}
      </header>

      {source === "demo" && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          {loadError
            ? "The plan in this link could not be read, so fictional demo data is shown instead."
            : "You are looking at fictional demo data. Open a fubudget share link, or paste your plan into the Edit data section, to see your own numbers."}
        </div>
      )}
      {source === "edited" && (
        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm">
          Showing your edited data. Copy a share link to keep it; nothing is stored on this device or any server.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button onClick={handleShare}>
          {copyStatus === "copied" ? "Link copied" : copyStatus === "error" ? "Copy failed, try again" : "Copy share link"}
        </Button>
        <Button variant="outline" onClick={() => setOpen([...SECTIONS])}>
          Expand all
        </Button>
        <Button variant="outline" onClick={() => setOpen([])}>
          Collapse all
        </Button>
      </div>

      {plan.headline && (
        <div className="my-5 rounded-md border border-green-200 bg-green-50 p-4">
          <strong>The headline, in one sentence:</strong> {plan.headline}
        </div>
      )}

      {incomeTotal > 0 && Math.abs(incomeTotal - total) > 1 && (
        <div className="my-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          Income sources add up to {formatMoney(incomeTotal)}/mo and the buckets add up to {formatMoney(total)}/mo,{" "}
          {incomeTotal > total
            ? `so ${formatMoney(incomeTotal - total)}/mo comes in that the plan does not spend.`
            : `so the plan spends ${formatMoney(total - incomeTotal)}/mo more than comes in.`}
        </div>
      )}
      {orphanEnvelopes.length > 0 && (
        <div className="my-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          {orphanEnvelopes.length} envelope(s) point at a bucket that does not exist:{" "}
          {orphanEnvelopes.map((envelope) => envelope.name).join(", ")}.
        </div>
      )}

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-3">
        <Panel value="numbers" title="Your numbers">
          {plan.baseNote && <p>{plan.baseNote}</p>}
          <Table
            head={
              <tr>
                <th className={th}>Bucket</th>
                <th className={`${th} ${num}`}>$/mo</th>
                <th className={`${th} ${num}`}>Share</th>
                <th className={th}>IWT target</th>
                <th className={th}>vs. target</th>
              </tr>
            }
          >
            {buckets.map((bucket) => (
              <tr key={bucket.id}>
                <td className={td}>{bucket.label}</td>
                <td className={`${td} ${num}`}>{formatMoney(bucket.value)}</td>
                <td className={`${td} ${num}`}>{formatShare(bucket.share)}</td>
                <td className={td}>{bucket.targetLabel}</td>
                <td className={td}>{bucket.status}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={`${td} border-t-2 border-t-slate-700`}>Total</td>
              <td className={`${td} ${num} border-t-2 border-t-slate-700`}>{formatMoney(total)}</td>
              <td className={`${td} ${num} border-t-2 border-t-slate-700`}>100%</td>
              <td className={`${td} border-t-2 border-t-slate-700`} />
              <td className={`${td} border-t-2 border-t-slate-700`} />
            </tr>
          </Table>
          {plan.numbersNote && <p className="text-xs text-muted-foreground">{plan.numbersNote}</p>}
        </Panel>

        <Panel value="sankey" title="Sankey: money flow">
          <p>
            Read left to right: <strong>each income source, the total, then where the money goes</strong>. Hover any
            flow for its exact $/mo value.
          </p>
          {plan.sankeyNote && <p className="text-xs text-muted-foreground">{plan.sankeyNote}</p>}
          {open.includes("sankey") && (
            <Sankey
              incomes={plan.incomes}
              flows={flows}
              centerLabel={plan.sankeyCenterLabel}
              centerTotal={plan.sankeyCenterTotal}
              unallocated={plan.sankeyUnallocated}
              base={total}
            />
          )}
        </Panel>

        {(plan.incomes.length > 0 || plan.incomeDetail.length > 0) && (
          <Panel value="income" title="Income: money coming in">
            {plan.incomeNote && <p>{plan.incomeNote}</p>}
            {plan.incomes.length > 0 && (
              <Table
                head={
                  <tr>
                    <th className={th}>Source</th>
                    <th className={th}>Group</th>
                    <th className={`${th} ${num}`}>$/mo</th>
                    <th className={th}>Note</th>
                  </tr>
                }
              >
                {plan.incomes.map((income, i) => (
                  <tr key={`${income.label}-${i}`}>
                    <td className={td}>
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                        style={{ backgroundColor: sourceColors[i] }}
                        aria-hidden
                      />
                      {income.label}
                    </td>
                    <td className={td}>{income.group}</td>
                    <td className={`${td} ${num}`}>{formatMoney(income.amount)}</td>
                    <td className={td}>{income.note}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={`${td} border-t-2 border-t-slate-700`}>Total</td>
                  <td className={`${td} border-t-2 border-t-slate-700`} />
                  <td className={`${td} ${num} border-t-2 border-t-slate-700`}>{formatMoney(incomeTotal)}</td>
                  <td className={`${td} border-t-2 border-t-slate-700`} />
                </tr>
              </Table>
            )}
            {plan.incomeDetail.map((group) => (
              <div key={group.label} className="mb-4">
                <h3 className="mt-2 text-base font-semibold">{group.label}</h3>
                <Table
                  head={
                    <tr>
                      <th className={th}>Item</th>
                      <th className={`${th} ${num}`}>Year to date</th>
                      <th className={`${th} ${num}`}>Full year</th>
                      <th className={th}>Basis</th>
                    </tr>
                  }
                >
                  {group.rows.map((row, i) => (
                    <tr key={`${row.source}-${i}`}>
                      <td className={td}>{row.source}</td>
                      <td className={`${td} ${num}`}>{row.ytd !== undefined ? formatMoney(row.ytd) : ""}</td>
                      <td className={`${td} ${num}`}>{row.projected !== undefined ? formatMoney(row.projected) : ""}</td>
                      <td className={td}>{row.basis}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))}
          </Panel>
        )}

        {plan.investments.length > 0 && (
          <Panel value="investments" title="Investments: detailed breakdown">
            <Table
              head={
                <tr>
                  <th className={th}>Component</th>
                  <th className={`${th} ${num}`}>$/year</th>
                  <th className={`${th} ${num}`}>$/mo</th>
                  <th className={th}>Note</th>
                </tr>
              }
            >
              {plan.investments.map((row, i) => (
                <tr key={`${row.component}-${i}`} className={row.total ? "font-bold" : undefined}>
                  <td className={`${td} ${row.total ? "border-t-2 border-t-slate-700" : ""}`}>{row.component}</td>
                  <td className={`${td} ${num} ${row.total ? "border-t-2 border-t-slate-700" : ""}`}>
                    {row.perYear !== undefined ? formatMoney(row.perYear) : ""}
                  </td>
                  <td className={`${td} ${num} ${row.total ? "border-t-2 border-t-slate-700" : ""}`}>
                    {row.perMonth !== undefined
                      ? formatMoney(row.perMonth)
                      : row.perYear !== undefined
                        ? formatMoney(row.perYear / 12)
                        : ""}
                  </td>
                  <td className={`${td} ${row.total ? "border-t-2 border-t-slate-700" : ""}`}>{row.note}</td>
                </tr>
              ))}
            </Table>
            {plan.investmentsNote && <p className="text-xs text-muted-foreground">{plan.investmentsNote}</p>}
          </Panel>
        )}

        <Panel value="envelopes" title={`Envelope mapping: all ${envelopeCount} envelopes`}>
          {buckets.map((bucket) => (
            <div key={bucket.id} className="mb-4">
              <h3 className="mt-2 text-base font-semibold">
                {bucket.label}: {formatMoney(bucket.value)}/mo
              </h3>
              {bucket.envelopes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No envelopes mapped to this bucket.</p>
              ) : (
                <Table
                  head={
                    <tr>
                      <th className={th}>Envelope</th>
                      <th className={`${th} ${num}`}>$/mo</th>
                    </tr>
                  }
                >
                  {bucket.envelopes.map((envelope, i) => (
                    <tr key={`${envelope.name}-${i}`}>
                      <td className={td}>{envelope.name}</td>
                      <td className={`${td} ${num}`}>{formatMoney(envelope.amount)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          ))}
        </Panel>

        <Panel value="explainer" title="The four buckets">
          <div className="leading-relaxed">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Fixed costs (50 to 60%):</strong> must-pay, roughly the same each month: housing, utilities,
                insurance, groceries, phone, internet, minimum debt payments, and recurring commitments.
              </li>
              <li>
                <strong>Investments (10%):</strong> long-term wealth building: 401(k), 403(b), IRA, brokerage, ESPP, HSA,
                employer match. 10% is a starting point, not a ceiling.
              </li>
              <li>
                <strong>Savings (5 to 10%):</strong> money set aside this month for a future, non-regular expense or
                goal, such as an emergency fund or sinking funds. This measures monthly funding, not account balances.
              </li>
              <li>
                <strong>Guilt-free spending (20 to 35%):</strong> money you spend now purely because you enjoy it:
                dining out, entertainment, shopping, hobbies, travel.
              </li>
            </ul>
          </div>
        </Panel>

        {plan.sources.length > 0 && (
          <Panel value="sources" title="Sources and caveats">
            <ul className="list-disc space-y-1 pl-6">
              {plan.sources.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              This dashboard describes a current allocation. It is not a recommendation to change any bucket.
            </p>
          </Panel>
        )}

        {plan.appendix.length > 0 && (
          <Panel value="appendix" title="Appendix: source files">
            <Table
              head={
                <tr>
                  <th className={th}>Source</th>
                  <th className={th}>Location</th>
                  <th className={th}>What was used</th>
                  <th className={th}>Version / date</th>
                </tr>
              }
            >
              {plan.appendix.map((row, i) => (
                <tr key={`${row.source}-${i}`}>
                  <td className={`${td} font-semibold`}>{row.source}</td>
                  <td className={`${td} break-words`}>{row.location}</td>
                  <td className={td}>{row.usedFor}</td>
                  <td className={td}>{row.version}</td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}

        <Panel value="data" title="Edit data">
          <p className="text-sm text-muted-foreground">
            This JSON is the single source of truth for the page. Edit it and apply to re-render the tables and
            Sankey, then copy a share link. Your data lives only in the link; fubudget stores nothing.
          </p>
          <textarea
            aria-label="Plan JSON"
            className="mt-3 h-96 w-full rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {draftError && <p className="mt-2 text-sm text-destructive">Could not apply: {draftError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={applyDraft}>Apply</Button>
            <Button
              variant="outline"
              onClick={() => {
                setPlan(demoPlan());
                setSource("demo");
                setLoadError(false);
              }}
            >
              Load demo data
            </Button>
          </div>
        </Panel>
      </Accordion>
    </div>
  );
}

function Panel({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-lg border bg-card">
      <AccordionTrigger className="bg-muted px-4 text-lg font-bold hover:no-underline">{title}</AccordionTrigger>
      <AccordionContent className="px-4 pt-3 text-[15px]">{children}</AccordionContent>
    </AccordionItem>
  );
}
