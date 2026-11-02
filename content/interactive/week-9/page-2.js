
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  phases:`<div class="flow"><span><b>Assess</b>Inventory, usage, dependencies</span><i>→</i><span><b>Plan</b>Disposition, waves, exit criteria</span><i>→</i><span><b>Migrate in waves</b>Build, parallel run, reconcile</span><i>→</i><span><b>Cutover</b>Repoint, hypercare, decommission</span></div><div class="xbands"><div style="background:var(--teal);color:#fff">THE LEGACY WAREHOUSE KEEPS RUNNING UNTIL EACH WAVE IS RECONCILED AND SIGNED OFF</div></div>`,
  parallel:`<div class="silo"><div><b>Legacy path (still live)</b><ul><li>SSIS package loads the warehouse</li><li>Power BI report reads the warehouse</li><li>Users keep working as today</li></ul></div><div><b>New path (shadow)</b><ul><li>Lakeflow pipeline builds gold</li><li>Copy of the report reads a SQL warehouse</li><li>Reconciliation compares both every run</li></ul></div></div>`,
  recon:`<div class="ladder"><div><b>1 · COUNTS</b>Rows per table and per load. Cheap. Catches lost or doubled loads.</div><div><b>2 · CONTROL TOTALS</b>Sums by month, region, plant. Shows where the gap is.</div><div><b>3 · KEY-LEVEL DIFF</b>Full outer join on the business key. Names each broken record.</div><div><b>4 · COLUMN / HASH</b>Every column, or a row hash. Most precise, most expensive.</div></div>`,
  obs:`<div class="stack"><div class="row"><div><b>Job runs</b>system.lakeflow tables</div><div><b>Cost</b>system.billing.usage</div><div><b>Access</b>system.access.audit</div><div><b>Data health</b>Data quality monitoring</div></div><div class="band uc">ALERTS AND DASHBOARDS: one view of “did it run, did it cost, who touched it, is it right”</div><div class="band st">RUNBOOK + ON-CALL: who acts, in what order, and who tells the business</div></div>`,
  dr:`<div class="ladder"><div><b>IN-REGION FIX · minutes</b>Time travel and RESTORE undo a bad write. Not DR: the region is still up.</div><div><b>BACKUP AND RESTORE · day</b>Copies in a second region, rebuilt by hand. Lowest cost, highest RTO and RPO.</div><div><b>ACTIVE-PASSIVE · hours</b>Standby region, data cloned on a schedule, code deployable on demand.</div><div><b>ACTIVE-ACTIVE · minutes</b>Both regions serve users. Highest cost and complexity.</div></div>`,
  opmodel:`<div class="stack"><div class="row"><div><b>Operations domain</b>OEE, sensors, MES</div><div><b>Service domain</b>Contracts, cases, margin</div><div><b>Finance domain</b>Close, revenue, cost</div><div><b>Quality domain</b>Supplier inspections</div></div><div class="band uc">CENTRAL PLATFORM TEAM: workspaces, Unity Catalog, CI/CD templates, monitoring, cost, security</div><div class="band st">SHARED STANDARDS: naming, layers, readiness gates, runbooks</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Migration & Waves", title:"Migration Strategy, Waves & Cutover", badge:"WP", badgeName:"Wave Planner",
  goal:"Run a migration as assess, plan, migrate in waves and cut over, choose a disposition for each legacy workload, and pick a cutover pattern with a rollback.",
  blocks:[
  {type:"poll", kind:"hook", q:"A client wants to move 340 nightly ETL packages and 120 reports to a new platform in one weekend. How often does a big-bang cutover like that go to plan?",
    opts:["Usually, with enough testing","About half the time","Rarely, and the rollback is the hard part"],
    reveal:"Most experienced leads answer the third. One weekend leaves no time to compare results, and if Monday’s numbers are wrong, every report is wrong at once. This lesson is about moving in waves instead."},
  {type:"concept", title:"Four phases, in order", body:"<p>A warehouse migration has four phases. Skipping one is the most common reason migrations overrun.</p><ul><li><b>Assess</b>: list every package, table, report and user. Measure what is actually used.</li><li><b>Plan</b>: decide what happens to each workload and group them into waves.</li><li><b>Migrate in waves</b>: build, run in parallel with the legacy path, reconcile.</li><li><b>Cutover</b>: repoint users, support them closely for a short period (hypercare), then switch off the old path.</li></ul>", diagram:"phases",
    analogy:"Moving house room by room. You keep living in the old house until each room in the new one works, then you hand back the keys."},
  {type:"order", kind:"build", title:"Sequence the migration", q:"Put these steps in the order a migration lead runs them.",
    items:["Inventory packages, tables, reports and usage","Decide a disposition for each workload","Group workloads into waves with exit criteria","Build the wave and run it in parallel","Reconcile and get the data owner’s sign-off","Repoint users, run hypercare, decommission the legacy path"],
    why:"You cannot plan what you have not counted, and you cannot cut over what you have not reconciled. Decommissioning is last because it removes the rollback."},
  {type:"concept", title:"A disposition for every workload", body:"<p>Not every legacy package should be rewritten. Give each one a disposition:</p><ul><li><b>Retire</b>: nobody uses the output. Switch it off and save the effort.</li><li><b>Replace</b>: it only copies data from a source. Use managed ingestion instead, such as Lakeflow Connect or Auto Loader.</li><li><b>Rewrite</b>: transformation logic worth keeping. Rebuild it as a Lakeflow Spark Declarative Pipeline or a Lakeflow Job.</li><li><b>Convert</b>: large volumes of SQL. Tools such as Lakebridge (a Databricks Labs project with an analyzer, a SQL converter and a reconciler) speed this up, but the output still needs review.</li></ul>"},
  {type:"sort", kind:"build", title:"Dispose of the packages", q:"Sort each legacy SSIS package into its disposition.",
    buckets:[{k:"ret",n:"Retire",s:"no one uses it"},{k:"rep",n:"Replace",s:"managed ingestion"},{k:"rw",n:"Rewrite",s:"declarative pipeline"},{k:"cv",n:"Convert",s:"tool-assisted, then review"}],
    items:[
      {t:"Package that feeds a report nobody has opened in 6 months",k:"ret",why:"Usage data says the output has no consumer. Retiring it is the cheapest migration."},
      {t:"Package that copies the Salesforce case table nightly, no logic",k:"rep",why:"A pure copy from a SaaS source is what a managed connector does."},
      {t:"Package that picks up MES CSV files from a share",k:"rep",why:"Files arriving in storage are Auto Loader’s job."},
      {t:"Package with the OEE business rules and quality checks",k:"rw",why:"Valuable logic. Rebuild it once, cleanly, with expectations in a declarative pipeline."},
      {t:"60 stored procedures of straightforward T-SQL reporting logic",k:"cv",why:"Volume makes manual rewriting slow. Convert with tooling, then review and test."},
      {t:"Duplicate copy of a load that another package already does",k:"ret",why:"Two packages producing the same thing is a classic legacy finding. Keep one."}]},
  {type:"concept", title:"Design the waves", body:"<p>A wave is a set of workloads that can be cut over together and signed off by one owner.</p><ul><li>Group by <b>business domain and the reports people use</b>, not by technical layer. “All bronze first” delivers nothing a user can check.</li><li>Respect <b>dependencies</b>: shared dimensions such as customer or material go in the first wave that needs them.</li><li>Make wave 1 <b>low risk and visible</b>. Put the most sensitive workload (often finance close) after the team has done one full cutover.</li><li>Give each wave <b>exit criteria</b>: reconciled, signed off, runbook ready.</li></ul>"},
  {type:"mcq", q:"A team proposes: wave 1 migrates every bronze table, wave 2 every silver table, wave 3 every gold table and report. What is the main problem?",
    opts:[{t:"No report can be cut over and signed off until the last wave, so all risk lands at the end",ok:true,why:"Right. Layer-by-layer waves are a big bang in disguise. Domain waves let a business owner sign off something real every few weeks."},
          {t:"Bronze tables cannot be migrated first",why:"They can. The issue is that nothing usable is finished until the end."},
          {t:"It needs more compute",why:"Compute is not the problem. Risk and late feedback are."},
          {t:"Silver should come before bronze",why:"Bronze feeds silver, so the order is right. The grouping is wrong."}]},
  {type:"concept", title:"Cutover patterns and rollback", body:"<ul><li><b>Big bang</b>: everything switches at once. Only for small estates with a long freeze window.</li><li><b>Phased by wave</b>: each wave switches when it is reconciled. The legacy system shrinks over time. This is the usual choice.</li><li><b>Parallel run, then switch</b>: inside each wave, both paths run for an agreed number of cycles before users move.</li></ul><p>Every cutover needs a <b>go/no-go</b> meeting with written criteria and a <b>rollback plan</b>: how users go back to the legacy report, and until when that is possible.</p>"},
  {type:"mcq", q:"Wave 2 went live on Monday. On Wednesday a plant manager finds yesterday’s figure is wrong in the new report. The legacy warehouse is still loading. What is the right first move?",
    opts:[{t:"Follow the rollback plan: point the affected report back to the legacy source, then find the cause",ok:true,why:"Right. Rollback is only possible because the legacy path still runs. Protect users first, diagnose second."},
          {t:"Hotfix the pipeline in production straight away",why:"Fixing under pressure without a diagnosis risks a second error. Users still see a wrong figure meanwhile."},
          {t:"Switch off the legacy warehouse so nobody compares",why:"That removes the safety net and hides the problem."},
          {t:"Wait for the next wave and fix it then",why:"Users keep making decisions on a wrong number."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Assess","Inventory every package, table, report and user, with real usage numbers."],
    ["Disposition","What happens to each workload: retire, replace, rewrite or convert."],
    ["Wave","A group of workloads cut over together and signed off by one owner."],
    ["Parallel run","Legacy and new paths run side by side so results can be compared."],
    ["Go/no-go","A meeting with written criteria that decides whether a wave cuts over."],
    ["Hypercare","A short period of close support after cutover, before the legacy path is switched off."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>The SQL Server warehouse holds 8 TB, loaded nightly by <b>340 SSIS packages</b>, and serves <b>~120 Power BI reports</b> to ~900 users. The licence renewal is about a year away at +22%. The governed OEE pilot is already live. Raj’s 11-person team must run the result.</p>",
    qs:[
      {q:"What should the first piece of HAL-09 work be?",opts:[
        {t:"A usage-based inventory of packages and reports, so some can be retired before any are migrated",ok:true,why:"Right. Every retired package is migration work you never do. Usage data also tells you which reports matter most."},
        {t:"Convert all 340 packages with a tool in one go",why:"Conversion without assessment migrates dead and duplicate packages too."},
        {t:"Rebuild all 120 reports in a new BI tool",why:"Power BI stays. Reports are repointed, not rebuilt."}]},
      {q:"Which wave order is most defensible?",opts:[
        {t:"Operations (OEE already proven), then service margin, then finance close, then the long tail",ok:true,why:"Right. Start where the team has momentum, and move finance only after a full month-end parallel run."},
        {t:"Finance close first, because the CFO cares most",why:"Highest risk first, with the least practised team. A failed close would end the programme."},
        {t:"All reports in one wave the month before renewal",why:"A big bang next to a hard deadline leaves no room to roll back."}]},
      {q:"The renewal date is fixed. How do you protect it?",opts:[
        {t:"Plan the last cutover with buffer before renewal, and track waves against a burn-down of packages left",ok:true,why:"Right. A visible burn-down shows early if the date is at risk, while there is still time to act."},
        {t:"Promise the CFO the warehouse will be gone and hope",why:"No evidence, no buffer, no early warning."},
        {t:"Renew for three more years to be safe",why:"That gives up the cost goal without testing the plan."}]}]}
  ]},
{ id:"lesson-2", short:"Reconciliation & Parallel Run", title:"Reconciliation & Parallel Running", badge:"RC", badgeName:"Reconciler",
  goal:"Prove a migrated table matches the legacy one, classify every mismatch, set parallel-run exit criteria, and repoint Power BI safely.",
  blocks:[
  {type:"poll", kind:"hook", q:"The legacy table and the new gold table both have 10,000 rows. Is the migration correct?",
    opts:["Yes, the counts match","Probably","We don’t know yet"],
    reveal:"We don’t know yet. One missing row and one extra row give the same count. Counts are the first check, never the last."},
  {type:"concept", title:"Four levels of reconciliation", body:"<p>Reconcile from cheap and broad to precise and expensive. Each level tells you where to look next.</p>", diagram:"recon"},
  {type:"order", kind:"build", title:"Stack the checks", q:"Order the checks from cheapest and broadest (1) to most precise (4).",
    items:["Row counts per table","Control totals by month and region","Key-level full outer join with a tolerance","Column-by-column or row-hash comparison"],
    why:"Counts find lost loads fast. Totals locate the gap. The key-level join names the records. Hash or column checks prove every value, at the highest cost."},
  {type:"concept", title:"Name every mismatch", body:"<p>A key-level comparison puts each business key in one of five states:</p><ul><li><b>Match</b>: same values within the agreed tolerance.</li><li><b>Missing in new</b>: the new pipeline dropped it.</li><li><b>Missing in legacy</b>: the new pipeline has it and the old one does not.</li><li><b>Duplicate key</b>: one side has the key more than once.</li><li><b>Value mismatch</b>: present on both sides, values differ beyond tolerance.</li></ul><p>Then find the cause. It is not always the new pipeline: migrations often expose old bugs.</p>"},
  {type:"sort", kind:"build", title:"Who fixes it?", q:"Each finding came from a parallel run. Sort it by the most likely owner of the fix.",
    buckets:[{k:"new",n:"Fix the new pipeline",s:"defect in the lakehouse"},{k:"old",n:"Legacy defect",s:"document, owner signs off"},{k:"time",n:"Timing",s:"align the cut-off"}],
    items:[
      {t:"A contract is missing in gold because its silver mapping row was filtered out",k:"new",why:"The new pipeline dropped a valid record. Fix the filter."},
      {t:"The legacy table has one contract twice after an SSIS package was re-run",k:"old",why:"The old load double-inserted. Gold is right; the owner signs off the difference."},
      {t:"Legacy lacks a late field-visit cost that gold includes",k:"old",why:"The new logic is more complete. Document it so the owner accepts the new figure."},
      {t:"Gold has an order created at 23:58 that legacy picked up the next night",k:"time",why:"Different extract cut-off times. Align them before comparing."},
      {t:"Revenue is 0.004 off after currency conversion",k:"new",why:"Usually rounding order. Agree a tolerance with the owner, or align the rounding rule."}]},
  {type:"concept", title:"Parallel running and exit criteria", body:"<p>During a parallel run both paths load every cycle and reconciliation runs automatically after each one. Agree the exit criteria <b>before</b> the run starts:</p><ul><li>How many consecutive clean cycles (for example 10 nightly runs).</li><li>Which business events must be included (for finance: at least one full month-end close).</li><li>The tolerance per measure, agreed with the data owner (for example 0 for counts, 0.01 per amount).</li><li>Who signs off. That is the business owner, not the engineer.</li></ul>", diagram:"parallel"},
  {type:"mcq", q:"Finance data has reconciled cleanly for 12 nights. The team wants to cut over before month-end. What is missing?",
    opts:[{t:"A month-end close in parallel: the riskiest logic only runs then",ok:true,why:"Right. Accruals and close adjustments run once a month. Twelve clean nights never exercised them."},
          {t:"Nothing; 12 nights is plenty",why:"Night count is not the point. The business event that matters has not happened yet."},
          {t:"A faster SQL warehouse",why:"Performance is not the exit criterion here."},
          {t:"A new Power BI licence",why:"Licensing has nothing to do with whether the numbers are right."}]},
  {type:"concept", title:"Repointing Power BI", body:"<ul><li>Keep the report and semantic model. Change the data source to a <b>Databricks SQL warehouse</b> with the Databricks connector (server hostname and HTTP path).</li><li>If gold tables are shaped differently from the old tables, publish <b>views shaped like the old tables</b> so report changes stay small.</li><li>Choose <b>Import or DirectQuery</b> per report, based on size and freshness.</li><li>Test in a separate Power BI workspace; the report owner compares old and new side by side, then signs off.</li><li>For new models, Catalog Explorer can <b>publish tables to the Power BI service</b> (needs Unity Catalog, a SQL warehouse and Power BI Premium capacity).</li></ul>"},
  {type:"mcq", q:"A finance report uses 14 columns from a legacy view with old column names. Gold uses new names. What keeps the repoint lowest-risk?",
    opts:[{t:"A gold-layer view that exposes the old names, so only the data source changes in the report",ok:true,why:"Right. One change at a time: first the source, later (if wanted) the model. Users see the same fields."},
          {t:"Rename the gold table columns to match the legacy names",why:"That spreads legacy naming into your standards for every consumer."},
          {t:"Rebuild the report from scratch",why:"More work and more risk. The goal is the same report on new data."},
          {t:"Export gold to CSV and load it into the report",why:"Ungoverned copy, no refresh path, no audit."}]},
  {type:"spot", title:"Spot the mistakes", q:"A migration status report makes these claims. Tap every wrong one, then check.",
    items:[
      {t:"Counts match on both sides, so the table is reconciled.",bad:true,ex:"Wrong. Offsetting errors hide behind equal counts."},
      {t:"Control totals by month and region show where a gap is.",bad:false,ex:"True. They narrow the search before key-level checks."},
      {t:"A full outer join on the business key finds records missing on either side.",bad:false,ex:"True. An inner join would hide them."},
      {t:"If gold differs from legacy, gold is wrong.",bad:true,ex:"Wrong. Migrations often expose legacy defects. Find the cause first."},
      {t:"The engineer signs off the reconciliation for finance data.",bad:true,ex:"Wrong. The data owner signs off; the engineer provides the evidence."},
      {t:"The tolerance for each measure should be agreed before the parallel run starts.",bad:false,ex:"True. Agreeing it afterwards looks like moving the goalposts."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>The service-margin wave is in parallel run. Last night’s key-level check on contract margin shows: 7 keys match, one contract missing in gold, one contract only in gold, one contract duplicated in the legacy table, and one cost that differs by $150. Priya Raman (CFO) must sign off before the margin reports move.</p>",
    qs:[
      {q:"What do you take to Priya?",opts:[
        {t:"Each mismatch with its cause, owner and fix, plus what would make the figure final",ok:true,why:"Right. The CFO signs off evidence, not a percentage. Name what is a new defect, what is a legacy defect, and what is still open."},
        {t:"“93% of rows match”",why:"A percentage hides which contracts and how much money."},
        {t:"Nothing until everything matches",why:"Some differences are legacy bugs and will never match. She needs to accept them knowingly."}]},
      {q:"The duplicate came from a re-run SSIS package. What does that tell you?",opts:[
        {t:"The legacy figure was overstated; gold is right, and the difference should be documented and signed off",ok:true,why:"Right. This is a finding to show, not hide. It also strengthens the case for the migration."},
        {t:"Gold should copy the duplicate to match",why:"That migrates the bug and makes reconciliation pass for the wrong reason."},
        {t:"Stop the wave",why:"The new pipeline behaved correctly. No reason to stop."}]}]}
  ]},
{ id:"lesson-3", short:"Observability & Incidents", title:"Observability, Troubleshooting & Incident Response", badge:"OB", badgeName:"Observer",
  goal:"Find failed runs, cost and access in system tables, watch data health with data quality monitoring, troubleshoot in a fixed order, and run the first 30 minutes of an incident.",
  blocks:[
  {type:"poll", kind:"hook", q:"At most companies with a nightly warehouse load, who usually notices a failed load first?",
    opts:["A monitoring alert","The first business user to open a report","Nobody, for a day or two"],
    reveal:"Too often it is the business user. Observability means your team knows before they do, and has already told them."},
  {type:"concept", title:"Four signals, all queryable", body:"<p>Databricks records platform activity in <b>system tables</b> you query with SQL, and adds <b>data quality monitoring</b> (formerly Lakehouse Monitoring) for the data itself.</p><ul><li><b>Did it run?</b> <code>system.lakeflow.jobs</code>, <code>job_run_timeline</code>, <code>job_task_run_timeline</code>.</li><li><b>What did it cost?</b> <code>system.billing.usage</code> joined to <code>system.billing.list_prices</code>.</li><li><b>Who touched what?</b> <code>system.access.audit</code>.</li><li><b>Is the data right?</b> Anomaly detection checks freshness and completeness across a schema; data profiling tracks distributions and drift per table.</li></ul>", diagram:"obs"},
  {type:"sort", kind:"build", title:"Where do you look?", q:"Match each question to the source that answers it.",
    buckets:[{k:"run",n:"Job run tables",s:"system.lakeflow"},{k:"bill",n:"Billing usage",s:"system.billing"},{k:"aud",n:"Audit log",s:"system.access.audit"},{k:"dq",n:"Data quality monitoring",s:"freshness, completeness, drift"}],
    items:[
      {t:"Which jobs failed last night, and with which termination code?",k:"run",why:"Run outcome and termination code live in the job run timeline."},
      {t:"Which job used the most DBUs last month?",k:"bill",why:"Usage by job is in billing usage; join list prices to estimate cost."},
      {t:"Who read the customer table yesterday?",k:"aud",why:"Unity Catalog access events are in the audit log."},
      {t:"Did the OEE table receive fewer rows than usual today?",k:"dq",why:"Completeness checks compare today’s rows to a predicted range."},
      {t:"Is the sensor table later than normal?",k:"dq",why:"Freshness checks predict when the next commit should land."},
      {t:"How often has the MES load timed out this month?",k:"run",why:"Count runs with result_state TIMED_OUT in the run timeline."}]},
  {type:"concept", title:"Reading the job tables correctly", body:"<ul><li><code>result_state</code> is only filled on the row that ends a run. Long runs have hourly slices with a null state. Values include SUCCEEDED, FAILED, ERROR, TIMED_OUT, CANCELLED and SKIPPED.</li><li><code>job_id</code> is unique only within a workspace. Join on <code>workspace_id</code> and <code>job_id</code>.</li><li><code>system.lakeflow.jobs</code> keeps history: a new row per change. Take the latest <code>change_time</code> per job for the current name.</li><li>System tables are regional: you see workspaces in the same region.</li></ul>"},
  {type:"mcq", q:"Your failed-runs query counts every row in job_run_timeline with result_state = 'FAILED'. A colleague’s count of runs is much higher than yours using all rows. Why?",
    opts:[{t:"Long runs are split into hourly rows; only the final row carries the result, so counting all rows counts slices, not runs",ok:true,why:"Right. Count distinct run_id, and filter on result_state when you want finished runs."},
          {t:"The table only keeps one day of history",why:"It keeps far more. The difference is about slices."},
          {t:"FAILED is not a valid state",why:"It is one of the documented values."},
          {t:"Billing usage must be joined first",why:"Billing is not needed to count runs."}]},
  {type:"concept", title:"Troubleshoot in a fixed order", body:"<p>Under pressure, a fixed order beats intuition:</p><ol><li><b>What changed?</b> Code deploy, source schema, data volume, permissions.</li><li><b>How wide?</b> One task, one job, or everything in the workspace?</li><li><b>What does the run say?</b> Task error, termination code, retries.</li><li><b>Logs and plans</b>: driver logs, Spark UI, query profile.</li><li><b>Upstream data</b>: did the source deliver, late or malformed?</li><li><b>Decide</b>: fix forward, re-run, or roll back.</li></ol>"},
  {type:"order", kind:"build", title:"Run the triage", q:"The nightly OEE job failed. Put the triage steps in order.",
    items:["Ask what changed since the last good run","Check how wide the failure is","Read the task error and termination code","Look at logs and the query profile","Check whether upstream data arrived","Decide: fix forward, re-run or roll back"],
    why:"Most failures follow a change, so start there. Scope tells you whether it is a platform or job issue. Only then go deep into logs."},
  {type:"concept", title:"Incident response basics", body:"<ul><li><b>Severity</b> by business impact: a missed 07:00 OEE for all plants is higher than one late test table.</li><li><b>Roles</b>: an incident lead decides, one person fixes, one person communicates. In a small team one person may hold two roles, never all three.</li><li><b>First 30 minutes</b>: acknowledge, assess impact, tell affected users what they will see and when the next update comes, then mitigate (for example, publish yesterday’s figure clearly labelled) before chasing root cause.</li><li><b>Afterwards</b>: a blameless post-incident review with a timeline, the cause, and actions with owners.</li></ul>",
    analogy:"A hospital emergency team. The lead does not hold the scalpel, and someone is always talking to the family."},
  {type:"mcq", q:"The OEE job failed at 05:50. Plants read OEE at 07:00. The cause is not yet known. What should happen by 06:30?",
    opts:[{t:"Operations is told what they will see at 07:00, when the next update comes, and the mitigation in place",ok:true,why:"Right. People can work around a known gap. A silent wrong or missing number destroys trust faster than the outage."},
          {t:"Nothing until the root cause is found",why:"The business finds out at 07:00 by itself. That is the worst outcome."},
          {t:"Delete today’s partition and re-run without telling anyone",why:"Untested fixes under pressure and no communication."},
          {t:"Email every user a technical error log",why:"Communicate impact and timing, not stack traces."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["job_run_timeline","System table of job runs; result_state only on the final row of a run."],
    ["system.billing.usage","Usage records by product, SKU and job; join list_prices for an estimated cost."],
    ["system.access.audit","Audit events: who did what, through which service, with what result."],
    ["Data quality monitoring","Anomaly detection for freshness and completeness, plus data profiling for drift."],
    ["Incident lead","Owns decisions and priorities during an incident; does not do the fix."],
    ["Blameless review","Timeline, cause and actions with owners, without blaming individuals."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Today SSIS loads fail about twice a month, and plant managers often discover it themselves at shift handover. On the new platform, the OEE gold table must land by 07:00 local time in every plant. Raj’s team has no on-call rota yet.</p>",
    qs:[
      {q:"Which alert would have the biggest effect on trust in the first month?",opts:[
        {t:"An alert at 06:15 if the OEE gold table is stale or incomplete, routed to the on-call engineer",ok:true,why:"Right. It fires early enough to act and communicate before 07:00, which is the moment that matters to operations."},
        {t:"A weekly email of all job runs",why:"Too late to act on any single failure."},
        {t:"A dashboard nobody is assigned to watch",why:"A dashboard without an owner is not monitoring."}]},
      {q:"What makes Raj’s team able to run this at 06:00?",opts:[
        {t:"A rota, a runbook per critical job, and a pre-written message for operations",ok:true,why:"Right. People, steps and words are ready before the incident, not invented during it."},
        {t:"Giving every engineer admin rights",why:"Broad rights create new risks and do not tell anyone what to do."},
        {t:"Asking the consulting team to stay on call forever",why:"The constraint is that the internal team runs it."}]}]}
  ]},
{ id:"lesson-4", short:"DR, Readiness & Operating Model", title:"Disaster Recovery, Production Readiness & Operating Model", badge:"PR", badgeName:"Production Ready",
  goal:"Set RPO and RTO per workload, design DR with deep clone and redeployable code, run readiness gates before go-live, and split work between a platform team and domain teams.",
  blocks:[
  {type:"poll", kind:"hook", q:"A client says: “We have Delta time travel, so we already have disaster recovery.” Is that right?",
    opts:["Yes","Partly","No"],
    reveal:"No. Time travel undoes a bad write while the region is up. If the region is down, the table and its history are down with it. DR needs a copy somewhere else and a way to run the code there."},
  {type:"concept", title:"RPO, RTO and the DR options", body:"<ul><li><b>RPO</b> (recovery point objective): how much data loss is acceptable. It sets how often you copy.</li><li><b>RTO</b> (recovery time objective): how long the business can wait. It sets how automated the failover is.</li><li><b>HA</b> covers losing one zone; <b>DR</b> covers losing a whole region.</li></ul><p>Set targets per workload tier. The Databricks deployment guide gives examples: critical RTO under 1 hour and RPO under 15 minutes; standard both under 24 hours.</p>", diagram:"dr"},
  {type:"tradeoff", kind:"build", title:"Pick the DR pattern", q:"Halvorsen’s OEE gold table must be available by 07:00; losing one day of data is acceptable because it can be rebuilt from bronze. Pick a DR pattern. Here “freshness” means how current the DR copy is.",
    opts:[
      {n:"Active-active in two regions",m:[95,90,90],verdict:"Fastest recovery, but you pay to run everything twice for a workload that tolerates a day of loss. Hard to justify to the CFO.",ok:false},
      {n:"Active-passive: nightly deep clone, code redeployable",m:[60,35,45],verdict:"Best fit. A scheduled deep clone meets a 24-hour RPO; Git plus bundles redeploy jobs in the secondary region within hours.",ok:true},
      {n:"Rely on time travel only",m:[10,5,10],verdict:"Cheap, but useless if the region is lost. This is not DR.",ok:false}]},
  {type:"concept", title:"What a DR copy needs", body:"<ul><li><b>Data</b>: deep clone copies data and metadata; re-running it copies only changes since the last clone. Streaming tables and materialized views cannot be cloned; rebuild them from their sources.</li><li><b>Code and jobs</b>: Git plus Declarative Automation Bundles (formerly Databricks Asset Bundles) so the same jobs deploy to the secondary workspace.</li><li><b>Governance</b>: a metastore in the secondary region; catalogs, grants and external locations scripted (for example with Terraform).</li><li><b>Identity</b>: users and groups synced at account level.</li><li><b>Data residency</b>: the secondary region must meet the same rules as the primary.</li><li><b>Test it</b>: the guide recommends at least quarterly, measuring the real RTO and RPO.</li></ul>"},
  {type:"mcq", q:"The DR runbook says: “Deep clone every gold object nightly.” Two gold objects are materialized views. What happens?",
    opts:[{t:"The clone fails for them; they must be rebuilt in the secondary region from their source tables",ok:true,why:"Right. CLONE does not support streaming tables or materialized views. The runbook must say how they are recreated."},
          {t:"They clone as normal tables",why:"They are not supported as clone sources."},
          {t:"They are replicated automatically by Unity Catalog",why:"Unity Catalog does not replicate data across regions for you."},
          {t:"Time travel covers them",why:"Time travel is in-region only."}]},
  {type:"concept", title:"Production-readiness gates", body:"<p>A workload goes live only when it passes a written checklist. Typical gates:</p><ul><li><b>Prove</b>: reconciliation signed off by the data owner; data quality expectations in place.</li><li><b>Operate</b>: named owner, alert routed to an on-call rota, runbook, SLA written down.</li><li><b>Protect</b>: least-privilege grants, PII masked, access visible in the audit log.</li><li><b>Recover</b>: rollback tested, DR copy in place, RPO and RTO agreed.</li><li><b>Afford</b>: cost tags set, expected monthly cost known.</li></ul>"},
  {type:"sort", kind:"build", title:"Sort the gate items", q:"Sort each checklist item into its gate.",
    buckets:[{k:"prove",n:"Prove"},{k:"op",n:"Operate"},{k:"prot",n:"Protect"},{k:"rec",n:"Recover"}],
    items:[
      {t:"CFO signed the margin reconciliation",k:"prove",why:"Evidence that the numbers are right."},
      {t:"Expectations on contract_id not null and margin within range",k:"prove",why:"Data quality rules prove correctness every run."},
      {t:"Failure alert goes to the on-call engineer, not a shared inbox",k:"op",why:"Someone specific acts when it breaks."},
      {t:"Runbook for the 07:00 OEE job",k:"op",why:"Steps are written before they are needed."},
      {t:"Customer email column masked for non-service roles",k:"prot",why:"PII protection is a security gate."},
      {t:"DR deep clone ran and a restore was tested last quarter",k:"rec",why:"Recovery has been proven, not assumed."}]},
  {type:"concept", title:"Platform operating model", body:"<p>Who runs what after the consultants leave?</p><ul><li><b>Central platform team</b>: workspaces, Unity Catalog, networking, CI/CD templates, monitoring, cost and security standards. Few people, high leverage.</li><li><b>Domain teams</b>: pipelines and gold tables for their own domain, inside the platform’s guardrails.</li><li><b>Hub and spoke</b> is the common middle: the platform team sets standards and readiness gates; domain teams build and own their data products.</li></ul><p>Fit the model to the people. A team of 11 cannot staff five domain squads on day one.</p>", diagram:"opmodel"},
  {type:"mcq", q:"Halvorsen has 11 data people, mostly SQL. Which operating model fits for the next 12 months?",
    opts:[{t:"A small central platform team, plus two domain squads (operations, service and finance), using shared templates and gates",ok:true,why:"Right. It matches team size and skills, and grows into more domains later."},
          {t:"Fully federated: every plant builds its own pipelines",why:"Nine plants with no data engineers would recreate the three-OEE problem."},
          {t:"Everything stays with an external partner",why:"The constraint says the internal team must run it."},
          {t:"No platform team; everyone is a domain engineer",why:"Nobody owns Unity Catalog, CI/CD or cost. Standards drift fast."}]},
  {type:"spot", title:"Spot the mistakes", q:"A go-live checklist contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"Time travel is our DR strategy.",bad:true,ex:"Wrong. It does not survive a region outage."},
      {t:"RPO sets how often we copy data to the secondary region.",bad:false,ex:"True."},
      {t:"Re-running a deep clone copies only what changed since the last clone.",bad:false,ex:"True. That is why it suits scheduled DR syncs."},
      {t:"EU data can fail over to any region with spare capacity.",bad:true,ex:"Wrong. The secondary region must meet the same residency rules."},
      {t:"A DR plan that has never been tested counts as a passed gate.",bad:true,ex:"Wrong. Untested DR is a hope, not a control."},
      {t:"Domain teams build inside guardrails set by the platform team.",bad:false,ex:"True. That is hub and spoke."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>EU personal data must stay in the EU. OEE must land by 07:00; finance close runs once a month; the service-margin wave goes live next. Dana Okafor (DPO) and Priya Raman (CFO) both sit on the go-live board.</p>",
    qs:[
      {q:"Where should Region A (EU) data fail over to?",opts:[
        {t:"A second Azure region inside the EU, with its own metastore and the same controls",ok:true,why:"Right. DR must not break the residency constraint. Dana will check this first."},
        {t:"The North America region, which already has a workspace",why:"That moves EU personal data out of the EU."},
        {t:"Nowhere; DR is not needed for EU data",why:"The business still needs OEE and margin if a region fails."}]},
      {q:"What will Priya ask before approving the DR design?",opts:[
        {t:"What it costs per year, by workload tier, and what risk each tier removes",ok:true,why:"Right. Tier the design: protect the 07:00 OEE and finance, keep the long tail on cheaper backup and restore."},
        {t:"Which Spark version it uses",why:"Not a CFO question."},
        {t:"Nothing; DR is always worth it",why:"She is cost-sceptic. Unpriced DR will not be approved."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T08. 90 seconds. Score 6 or more to earn the T08 Production Architect badge.",
    qs:[
      {q:"Which phase comes before grouping workloads into waves?",o:["Cutover","Assess and disposition","Hypercare"],a:1},
      {q:"A package nobody has used in six months should be…",o:["Retired","Rewritten","Converted"],a:0},
      {q:"Counts match. What check names the broken records?",o:["Control totals","Key-level full outer join","Row counts again"],a:1},
      {q:"Who signs off finance reconciliation?",o:["The data engineer","The data owner","The platform team"],a:1},
      {q:"Where do you find failed job runs?",o:["system.lakeflow.job_run_timeline","system.billing.list_prices","DESCRIBE HISTORY"],a:0},
      {q:"RPO sets…",o:["How long recovery may take","How much data loss is acceptable","How many users fail over"],a:1},
      {q:"Which cannot be deep cloned?",o:["A managed Delta table","A materialized view","An external Delta table"],a:1},
      {q:"In hub and spoke, who owns Unity Catalog and CI/CD templates?",o:["Each domain team","The central platform team","The BI analysts"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T08",n:"T08 Production Architect"};

/* ---------- ENGINE ---------- */
let S=structuredClone(window.__ecodActivity.initial);
const save=()=>window.__ecodActivity.save(S);
const $=(s,r=document)=>r.querySelector(s);
const el=(tag,cls,html)=>{const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e;};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
let toastT;
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2200);}
function addXP(n,label){S.xp+=n;save();$("#xpv").textContent=S.xp;const x=$("#xp");x.classList.remove("bump");void x.offsetWidth;x.classList.add("bump");toast(`+${n} XP · ${label}`);}
function scoredBlocks(L){return L.blocks.filter(b=>b.type!=="concept");}
function complete(id,xp,label,L){
  if(S.done[id]) return; S.done[id]=true; addXP(xp,label);
  const node=document.getElementById(id); if(node){const d=node.querySelector(".tag .done"); if(d) d.textContent="✓ done";}
  updateProgress(L);
}
function updateProgress(L){
  const sb=scoredBlocks(L), ids=sb.map((b,i)=>blockId(L,b)), n=ids.filter(i=>S.done[i]).length;
  const m=$("#lmeter"); if(m){m.style.width=(100*n/ids.length)+"%"; $("#lcount").textContent=`${n} of ${ids.length} activities`;}
  if(n===ids.length && !S.badges[L.badge]){S.badges[L.badge]=true;window.__ecodNotify&&window.__ecodNotify("lesson-complete",{lesson:L.id,badge:L.badgeName});save();renderShelf();setTimeout(()=>toast(`Badge earned: ${L.badgeName}`),900);}
  renderTabs();
}
function blockId(L,b){return L.id+"-b"+L.blocks.indexOf(b);}
function renderShelf(){
  const s=$("#shelf"); s.innerHTML="";
  [...LESSONS.map(L=>({k:L.badge,n:L.badgeName})),FINAL_BADGE].forEach(b=>{
    const d=el("div","badge"+(S.badges[b.k]?" on":""),b.k); d.title=b.n+(S.badges[b.k]?" (earned)":" (locked)"); s.appendChild(d);});
}
function current(){const h=location.hash.slice(1);return LESSONS.find(L=>L.id===h)||LESSONS[0];}
function renderTabs(){
  const t=$("#tabs"), cur=current(); t.innerHTML="";
  LESSONS.forEach((L,i)=>{const b=el("button","tab",`<span class="tick">${S.badges[L.badge]?"✓":(i+1)}</span>${L.short}`);
    b.setAttribute("aria-current",L===cur?"true":"false"); b.onclick=()=>{location.hash=L.id}; t.appendChild(b);});
}
const KIND_LABEL={hook:["hook","Hook"],learn:["learn","Learn"],check:["","Check"],build:["build","Build it"],recall:["","Recall"],apply:["apply","Apply"],boss:["build","Boss round"]};
function kindOf(b){
  if(b.kind) return b.kind;
  return {concept:"learn",mcq:"check",flash:"recall",spot:"recall",case:"apply",boss:"boss",sort:"check",order:"build",calc:"build",tradeoff:"build",poll:"hook"}[b.type];
}
function shell(L,b){
  const id=blockId(L,b), k=kindOf(b), [cls,lab]=KIND_LABEL[k];
  const box=el("section","blk "+b.type); box.id=id;
  const tag=el("div","tag mono",`<span class="k ${cls}">${lab}</span>${b.title&&b.type!=="concept"?`<span>${b.title}</span>`:""}${b.type!=="concept"?`<span class="done">${S.done[id]?"✓ done":""}</span>`:""}`);
  box.appendChild(tag); return {box,id};
}

const R={};
R.concept=(L,b,box)=>{
  box.appendChild(el("h2",null,b.title));
  box.appendChild(el("div",null,b.body));
  if(b.diagram) box.appendChild(el("div","dg",DIAG[b.diagram]));
  if(b.analogy) box.appendChild(el("p","analogy","<b>Analogy.</b> "+b.analogy));
};
R.poll=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  const o=el("div","opts"), fb=el("div","fb"); fb.hidden=true;
  b.opts.forEach(t=>{const btn=el("button","opt",t); btn.onclick=()=>{o.querySelectorAll(".opt").forEach(x=>x.classList.remove("right"));btn.classList.add("right");fb.hidden=false;fb.innerHTML=b.reveal;complete(id,5,"Hook",L);}; o.appendChild(btn);});
  box.append(o,fb);
};
function mcq(container,q,opts,onRight){
  container.appendChild(el("p","q",q));
  const o=el("div","opts"); let tries=0, solved=false;
  shuffle(opts).forEach(op=>{
    const btn=el("button","opt",`<span>${op.t}</span><span class="why" hidden>${op.why}</span>`);
    btn.onclick=()=>{ if(solved) return; tries++;
      btn.querySelector(".why").hidden=false;
      if(op.ok){btn.classList.add("right");solved=true;o.querySelectorAll(".opt").forEach(x=>x.disabled=true);onRight(tries);}
      else{btn.classList.add("wrong");btn.disabled=true;}
    };
    o.appendChild(btn);});
  container.appendChild(o);
}
R.mcq=(L,b,box,id)=>mcq(box,b.q,b.opts,tries=>complete(id,tries===1?10:5,tries===1?"First try":"Got there",L));

R.sort=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  const items=shuffle(b.items.map((it,i)=>({...it,i}))); const place={}; let sel=null, attempts=0;
  const pool=el("div","pool"); const bw=el("div","buckets"); const fb=el("div","fb"); fb.hidden=true;
  const bucketEls={};
  b.buckets.forEach(bk=>{
    const d=el("div","bucket",`<span class="bh">${bk.n}${bk.s?`<small>${bk.s}</small>`:""}</span>`); d.setAttribute("role","button"); d.tabIndex=0; d.setAttribute("aria-label","Place selected item in "+bk.n); d.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===d){e.preventDefault();d.click();}};
    d.onclick=e=>{ if(e.target.closest(".chip")) return; if(sel!=null){place[sel]=bk.k;sel=null;draw();}};
    d.ondragover=e=>{e.preventDefault();d.classList.add("over")}; d.ondragleave=()=>d.classList.remove("over");
    d.ondrop=e=>{e.preventDefault();d.classList.remove("over");const i=+e.dataTransfer.getData("text/plain");place[i]=bk.k;sel=null;draw();};
    bucketEls[bk.k]=d; bw.appendChild(d);});
  pool.onclick=e=>{ if(e.target.closest(".chip")) return; if(sel!=null){delete place[sel];sel=null;draw();}};
  pool.ondragover=e=>e.preventDefault(); pool.ondrop=e=>{e.preventDefault();delete place[+e.dataTransfer.getData("text/plain")];draw();};
  const check=el("button","btn","Check"); const row=el("div","btnrow"); row.append(check);
  function draw(){
    pool.innerHTML=""; Object.values(bucketEls).forEach(d=>{d.querySelectorAll(".chip").forEach(c=>c.remove());d.classList.toggle("armed",sel!=null)});
    items.forEach(it=>{
      const c=el("button","chip"+(sel===it.i?" sel":"")+(it.state?" "+it.state:""),it.t); c.type="button"; c.draggable=!S.done[id];
      c.ondragstart=e=>{e.dataTransfer.setData("text/plain",it.i)};
      c.onclick=e=>{e.stopPropagation(); if(S.done[id]) return; sel=(sel===it.i?null:it.i); it.state=""; draw();};
      (place[it.i]?bucketEls[place[it.i]]:pool).appendChild(c);});
    check.disabled=Object.keys(place).length<items.length||S.done[id];
  }
  check.onclick=()=>{
    attempts++; const wrong=items.filter(it=>place[it.i]!==it.k);
    items.forEach(it=>it.state=place[it.i]===it.k?"right":"wrong");
    if(!wrong.length){fb.className="fb good";fb.innerHTML="<b>All correct.</b> Every item is in the right place.";complete(id,Math.max(5,25-5*(attempts-1)),b.title||"Sorted",L);}
    else{fb.className="fb bad";fb.innerHTML=`<b>${wrong.length} misplaced.</b> Tap a red item to move it.<ul>${wrong.map(w=>`<li>${w.t}: ${w.why}</li>`).join("")}</ul>`;}
    fb.hidden=false; draw();
  };
  box.append(pool,bw,el("p","hint","Tap an item, then tap a box. Desktop: drag and drop. Tap the grey area to return an item."),row,fb);
  if(S.done[id]){b.items.forEach(it=>{const x=items.find(y=>y.t===it.t);place[x.i]=it.k;x.state="right"});}
  draw();
};

R.order=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  let arr=shuffle(b.items); if(arr.join()===b.items.join()) arr=arr.slice().reverse();
  if(S.done[id]) arr=b.items.slice();
  let attempts=0, marks=null; const ul=el("ol","olist"); const fb=el("div","fb"); fb.hidden=true; let dragI=null;
  function draw(){
    ul.innerHTML="";
    arr.forEach((t,i)=>{
      const li=el("li",marks?(marks[i]?"right":"wrong"):"",`<span class="n">${i+1}</span><span class="t">${t}</span>`); li.draggable=!S.done[id];
      li.ondragstart=()=>{dragI=i}; li.ondragover=e=>e.preventDefault();
      li.ondrop=e=>{e.preventDefault(); if(dragI==null) return; const [m]=arr.splice(dragI,1); arr.splice(i,0,m); dragI=null; marks=null; draw();};
      const up=el("button","mv","↑"), dn=el("button","mv","↓"); up.setAttribute("aria-label","Move up: "+t); dn.setAttribute("aria-label","Move down: "+t);
      up.disabled=i===0||S.done[id]; dn.disabled=i===arr.length-1||S.done[id];
      up.onclick=()=>{[arr[i-1],arr[i]]=[arr[i],arr[i-1]];marks=null;draw();}; dn.onclick=()=>{[arr[i+1],arr[i]]=[arr[i],arr[i+1]];marks=null;draw();};
      li.append(up,dn); ul.appendChild(li);});
  }
  const check=el("button","btn","Check order");
  check.onclick=()=>{ attempts++; marks=arr.map((t,i)=>t===b.items[i]); draw();
    if(marks.every(Boolean)){fb.className="fb good";fb.innerHTML="<b>Correct.</b> "+b.why;fb.hidden=false;check.disabled=true;complete(id,Math.max(5,25-5*(attempts-1)),b.title,L);}
    else{fb.className="fb bad";fb.innerHTML=`<b>${marks.filter(x=>!x).length} in the wrong place.</b> Red rows are out of position. Move them and check again.`;fb.hidden=false;}
  };
  if(S.done[id]){check.disabled=true;marks=arr.map(()=>true);fb.className="fb good";fb.innerHTML="<b>Correct.</b> "+b.why;fb.hidden=false;}
  draw(); const row=el("div","btnrow"); row.append(check); box.append(ul,row,fb);
};

R.flash=(L,b,box,id)=>{
  box.appendChild(el("p","q","Say the definition out loud, then tap to check yourself."));
  const g=el("div","cards"); const seen=new Set();
  b.cards.forEach(([f,bk],i)=>{
    const c=el("button","card"+(S.done[id]?"":""),`<div class="in"><div class="f">${f}</div><div class="b">${bk}</div></div>`); c.setAttribute("aria-label","Flip card: "+f);
    c.onclick=()=>{c.classList.toggle("flip");seen.add(i); if(seen.size===b.cards.length) complete(id,10,"Recall",L);};
    g.appendChild(c);});
  box.appendChild(g);
};

R.spot=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  const flags=new Set(); const list=el("div","stmts"); const fb=el("div","fb"); fb.hidden=true; let attempts=0, shown=!!S.done[id];
  const items=b.items.map((it,i)=>({...it,i}));
  function draw(){
    list.innerHTML="";
    items.forEach(it=>{
      let cls="stmt"+(flags.has(it.i)?" on":"");
      if(shown) cls+=(flags.has(it.i)===it.bad)?" right":" wrong";
      const s=el("button",cls,`<span class="flag">${flags.has(it.i)?"✕":""}</span><span>${it.t}${shown?`<span class="ex">${it.ex}</span>`:""}</span>`);
      s.setAttribute("aria-pressed",flags.has(it.i)?"true":"false");
      s.onclick=()=>{ if(S.done[id]) return; shown=false; flags.has(it.i)?flags.delete(it.i):flags.add(it.i); fb.hidden=true; draw();};
      list.appendChild(s);});
  }
  const check=el("button","btn","Check");
  check.onclick=()=>{attempts++; shown=true; const ok=items.every(it=>flags.has(it.i)===it.bad); draw();
    if(ok){fb.className="fb good";fb.innerHTML="<b>Sharp eye.</b> You caught every mistake and trusted every true claim.";check.disabled=true;complete(id,Math.max(5,20-5*(attempts-1)),b.title,L);}
    else{fb.className="fb bad";fb.innerHTML="<b>Not quite.</b> Red rows are misjudged. Read the explanations, adjust and check again.";}
    fb.hidden=false;};
  if(S.done[id]){items.forEach(it=>{if(it.bad)flags.add(it.i)});check.disabled=true;}
  draw(); const row=el("div","btnrow"); row.append(check); box.append(list,row,fb);
};

R.calc=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  const wrap=el("div","calc",`<label for="hrs-${id}"><b>Busy hours per day: <span id="hv-${id}">6</span></b></label><input type="range" id="hrs-${id}" min="1" max="24" value="6">
  <div class="bars"><div class="barrow"><span>Always-on cluster</span><div class="track"><div class="fill" id="a-${id}" style="background:var(--bad)"></div></div><span class="v" id="av-${id}"></span></div>
  <div class="barrow"><span>Start, scale, stop</span><div class="track"><div class="fill" id="r-${id}" style="background:var(--teal)"></div></div><span class="v" id="rv-${id}"></span></div></div>
  <div class="fb" id="cf-${id}"></div><p class="hint">${b.note}</p>`);
  box.appendChild(wrap); const $=sel=>wrap.querySelector(sel);
  const rate=30, days=30, always=rate*24*days, fmt=n=>"$"+n.toLocaleString("en-US");
  const upd=(touched)=>{const h=+$("#hrs-"+id).value, right=rate*h*days, idle=always-right;
    $("#hv-"+id).textContent=h; $("#a-"+id).style.width="100%"; $("#r-"+id).style.width=(100*right/always)+"%";
    $("#av-"+id).textContent=fmt(always); $("#rv-"+id).textContent=fmt(right);
    $("#cf-"+id).innerHTML=idle>0?`<b>${fmt(idle)} a month</b> (${Math.round(100*idle/always)}%) pays for a cluster doing nothing.`:"Busy all day: separation saves little here. Then the case rests on isolation and scaling, not idle time.";
    if(touched) complete(id,10,"Calculator",L);};
  $("#hrs-"+id).oninput=()=>upd(true); upd(false);
};

R.tradeoff=(L,b,box,id)=>{
  box.appendChild(el("p","q",b.q));
  const opts=el("div","trade"), g=el("div","gauges"), fb=el("div","fb"); fb.hidden=true;
  const names=["Freshness","Cost","Complexity"], colors=["var(--teal)","var(--rust)","var(--silver)"];
  names.forEach((n,i)=>g.appendChild(el("div","barrow",`<span>${n}</span><div class="track"><div class="fill" data-g="${i}" style="width:0;background:${colors[i]}"></div></div><span class="v" data-v="${i}">–</span>`)));
  b.opts.forEach(op=>{const btn=el("button","opt",`<b>${op.n}</b>`);
    btn.onclick=()=>{opts.querySelectorAll(".opt").forEach(x=>x.classList.remove("right","wrong"));btn.classList.add(op.ok?"right":"wrong");
      op.m.forEach((v,i)=>{g.querySelector(`[data-g="${i}"]`).style.width=v+"%";g.querySelector(`[data-v="${i}"]`).textContent=v>66?"High":v>33?"Medium":"Low";});
      fb.className="fb "+(op.ok?"good":"bad"); fb.innerHTML=op.verdict; fb.hidden=false;
      if(op.ok) complete(id,15,"Trade-off",L);};
    opts.appendChild(btn);});
  box.append(opts,g,fb);
};

R.case=(L,b,box,id)=>{
  box.appendChild(el("div","brief",b.brief));
  let solved=0;
  b.qs.forEach((q,qi)=>{const sub=el("div","sub"); mcq(sub,(qi+1)+". "+q.q,q.opts,()=>{solved++; if(solved===b.qs.length) complete(id,15*b.qs.length,"Case applied",L);}); box.appendChild(sub);});
};

R.boss=(L,b,box,id)=>{
  box.classList.add("boss");
  box.appendChild(el("h2",null,"Can you architect it in 90 seconds?"));
  box.appendChild(el("p",null,b.q));
  const stage=el("div","opts"); const start=el("button","btn",S.badges[FINAL_BADGE.k]?"Play again":"Start the round");
  const row=el("div","btnrow"); row.append(start); box.append(row,stage);
  let timer, left, qi, score, order;
  function end(){clearInterval(timer); stage.innerHTML="";
    const pass=score>=6;
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: T08 Production Architect.":"Score 6 or more to earn the badge. Try again."}`));
    if(pass){ if(!S.badges[FINAL_BADGE.k]){S.badges[FINAL_BADGE.k]=true;window.__ecodNotify&&window.__ecodNotify("module-complete",{badge:FINAL_BADGE.n});save();renderShelf();} complete(id,50+score*5,"Boss round",L);}
    start.hidden=false; start.textContent="Play again";}
  function show(){
    if(qi>=order.length||left<=0) return end();
    const q=order[qi]; stage.innerHTML="";
    stage.appendChild(el("div","btnrow",`<span class="timer">${left}s</span><span class="hint">Question ${qi+1} of ${order.length} · Score ${score}</span>`));
    stage.appendChild(el("p","q",q.q));
    q.o.forEach((t,i)=>{const btn=el("button","opt",t); btn.onclick=()=>{
      stage.querySelectorAll(".opt").forEach(x=>x.disabled=true);
      if(i===q.a){score++;btn.classList.add("right")}else{btn.classList.add("wrong");stage.querySelectorAll(".opt")[q.a].classList.add("right")}
      setTimeout(()=>{qi++;show()},650);}; stage.appendChild(btn);});
  }
  start.onclick=()=>{start.hidden=true; left=90; qi=0; score=0; order=shuffle(b.qs);
    timer=setInterval(()=>{left--; const t=stage.querySelector(".timer"); if(t) t.textContent=left+"s"; if(left<=0) end();},1000); show();};
};

function render(){
  const L=current(), i=LESSONS.indexOf(L), main=$("#main"); main.innerHTML="";
  const head=el("header","head",`<span class="mono eyebrow">T08 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
    <div class="grammar" aria-label="Lesson structure"><span>Hook</span><em>→</em><span>Learn + check ×${L.blocks.filter(b=>b.type==="concept").length}</span><em>→</em><span>Build it</span><em>→</em><span>Recall</span><em>→</em><span>Apply</span></div>
    <div class="meterlab"><span id="lcount"></span><span>${L.badgeName} badge</span></div><div class="meter"><div id="lmeter"></div></div>`);
  main.appendChild(head);
  const list=el("div","blocks");
  L.blocks.forEach(b=>{const {box,id}=shell(L,b); R[b.type](L,b,box,id); list.appendChild(box);});
  main.appendChild(list);
  const nx=el("div","next");
  const prev=LESSONS[i-1], next=LESSONS[i+1];
  nx.innerHTML=`<span>${prev?`<button class="btn ghost" id="pv">← ${prev.short}</button>`:""}</span><span>${next?`<button class="btn" id="nv">Next: ${next.short} →</button>`:""}</span>`;
  main.appendChild(nx);
  if(prev) $("#pv").onclick=()=>{location.hash=prev.id};
  if(next) $("#nv").onclick=()=>{location.hash=next.id};
  updateProgress(L); renderTabs(); window.scrollTo(0,0);
}
$("#xpv").textContent=S.xp; renderShelf();
let resetArmed=false;
$("#reset").onclick=()=>{ if(!resetArmed){resetArmed=true;$("#reset").textContent="Tap again to erase XP and badges";setTimeout(()=>{resetArmed=false;$("#reset").textContent="Reset my progress"},4000);return;}
  S={xp:0,done:{},badges:{}};save();$("#xpv").textContent=0;renderShelf();render();toast("Progress reset");resetArmed=false;$("#reset").textContent="Reset my progress";};
window.addEventListener("hashchange",render);
render();
