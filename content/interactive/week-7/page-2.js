
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  silo:`<div class="silo"><div><b>Data warehouse</b><ul><li>Structured tables, fast SQL</li><li>Strong governance, transactions</li><li>Costly for raw or unstructured data</li><li>Proprietary storage format</li></ul></div><div><b>Data lake</b><ul><li>Cheap files in object storage</li><li>Any data: logs, images, JSON</li><li>No transactions or schema rules</li><li>Quality decays into a “swamp”</li></ul></div></div>`,
  stack:`<div class="stack"><div class="row"><div><b>Data engineering</b>Lakeflow · Spark · Photon</div><div><b>Warehousing / BI</b>SQL warehouses · Dashboards</div><div><b>Data science &amp; ML</b>Notebooks · MLflow</div><div><b>Real time</b>Streaming · Model Serving</div></div><div class="band uc">UNITY CATALOG: access control, lineage, audit for every engine above</div><div class="band st">OPEN STORAGE: Delta Lake / Apache Iceberg tables in your cloud object storage</div></div>`,
  med:`<div class="med"><div style="background:var(--bronze)"><b>BRONZE</b>Raw, as landed. Minimal checks. Kept for replay and audit.</div><span class="ar">→</span><div style="background:var(--silver)"><b>SILVER</b>Cleaned, deduplicated, conformed. Schema enforced.</div><span class="ar">→</span><div style="background:var(--gold)"><b>GOLD</b>Business-ready aggregates, metrics and ML feature tables.</div></div>`,
  flow:`<div class="flow"><span><b>Source</b>ERP · CRM · IoT</span><i>→</i><span><b>Ingest</b>Lakeflow Connect · Auto Loader</span><i>→</i><span><b>Process</b>Spark · Photon</span><i>→</i><span><b>Store</b>Delta / Iceberg medallion</span><i>→</i><span><b>Serve</b>SQL · Model Serving</span><i>→</i><span><b>Analyse</b>BI · Genie</span></div><div class="xbands"><div style="background:var(--sunk)">IDENTITY &amp; ORCHESTRATION</div><div style="background:var(--teal);color:#fff">UNITY CATALOG GOVERNANCE (CROSS-CUTTING)</div><div style="background:var(--sunk)">MONITORING &amp; COST: SYSTEM TABLES</div></div>`,
  couple:`<div class="silo"><div><b>Coupled</b><ul><li>Storage and compute live on the same machines</li><li>Need more storage? Buy more compute too</li><li>One cluster, sized for the busiest hour, runs all day</li></ul></div><div><b>Separated (Databricks)</b><ul><li>Data sits once in object storage</li><li>Each workload starts its own compute, then stops</li><li>Many engines read the same governed tables</li></ul></div></div>`,
  ladder:`<div class="ladder"><div><b>BATCH · hours</b>Scheduled runs. Cheapest, simplest. Month-end, nightly loads.</div><div><b>INCREMENTAL · minutes</b>Process only what is new, on a schedule or file arrival.</div><div><b>STREAMING · seconds</b>Always-on pipeline. Alerts, live monitoring.</div><div><b>REAL TIME · milliseconds</b>Model Serving answers one request at a time.</div></div>`,
  servclassic:`<div class="silo"><div><b>Serverless</b><ul><li>Databricks runs the machines in its account</li><li>Starts fast, scales itself, stops when idle</li><li>One DBU price covers the infrastructure</li><li>Little to tune: pick performance mode and environment</li></ul></div><div><b>Classic</b><ul><li>VMs run in Halvorsen’s Azure subscription</li><li>You choose instance type, workers, autoscaling, Photon, spot</li><li>You pay DBUs to Databricks plus VMs to Azure</li><li>Needed for some cases: specific VMs, init scripts, certain libraries or access modes</li></ul></div></div>`,
  sizing:`<div class="ladder"><div><b>GENERAL PURPOSE</b>Azure D-series. Balanced default for simple batch ETL.</div><div><b>MEMORY-OPTIMISED</b>Azure E-series. Wide joins, big aggregations, spills to disk.</div><div><b>COMPUTE-OPTIMISED</b>Azure F-series. CPU-heavy parsing and transforms on modest data.</div><div><b>STORAGE-OPTIMISED</b>Azure L-series. Local SSD for disk caching of repeated reads.</div></div>`,
  finops:`<div class="flow"><span><b>Tag</b>team, env, workload on every job, pipeline, warehouse</span><i>→</i><span><b>Measure</b>system.billing.usage × list_prices</span><i>→</i><span><b>Attribute</b>cost by tag, job, SKU</span><i>→</i><span><b>Alert</b>budgets by workspace and tag</span><i>→</i><span><b>Act</b>right-size, schedule, switch compute</span></div>`,
  bundle:`<div class="stack"><div class="row"><div><b>bundle</b>name of the project</div><div><b>variables</b>catalog, emails, IDs</div><div><b>resources</b>jobs, pipelines, schemas</div><div><b>include</b>resources/*.yml</div></div><div class="band uc">TARGETS: dev (mode: development) · prod (mode: production, run_as service principal)</div><div class="band st">databricks.yml + source code in one Git repository</div></div>`,
  cicd:`<div class="flow"><span><b>Develop</b>VS Code + extension, deploy to dev target</span><i>→</i><span><b>Pull request</b>review by another pair</span><i>→</i><span><b>CI</b>bundle validate + unit tests</span><i>→</i><span><b>Merge</b>to main</span><i>→</i><span><b>CD</b>bundle deploy -t prod as service principal</span></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Compute & Sizing", title:"Compute Choices & Sizing", badge:"CR", badgeName:"Compute Right-sizer",
  goal:"Choose serverless or classic compute for each workload, size classic compute from evidence, and know when Photon and autoscaling pay off.",
  blocks:[
  {type:"poll", kind:"hook", q:"Halvorsen’s nightly SAP load runs on the same all-purpose cluster the developers use all day. What is the biggest problem?",
    opts:["It runs too slowly","It pays all-purpose rates and shares the cluster with interactive work","Nothing, one cluster is simpler"],
    reveal:"The second. Scheduled work on an all-purpose cluster pays a higher rate than jobs compute, competes with developers for resources, and keeps the cluster alive longer. Right compute per workload is the first and cheapest cost lever."},
  {type:"concept", title:"Two families: serverless and classic", body:"<p>Every Databricks workload runs on one of two families. <b>Serverless</b> compute runs in Databricks’ account and is managed for you. <b>Classic</b> compute runs as VMs in the client’s own cloud subscription and you configure it.</p><p>Databricks recommends serverless for most new workloads, and classic where serverless does not support what you need.</p>", diagram:"servclassic"},
  {type:"mcq", q:"A classic jobs cluster ran for 2 hours. Where does its full cost show up?",
    opts:[{t:"DBUs in the Databricks bill, plus VM cost in the Azure bill",ok:true,why:"Right. Classic compute is charged twice: DBUs by Databricks and virtual machines by Azure. system.billing.usage shows only the DBU part."},
          {t:"Only in the Databricks bill",why:"That is serverless. On classic, the VMs live in your subscription and Azure bills them."},
          {t:"Only in the Azure bill",why:"Databricks still charges DBUs for classic compute."},
          {t:"Nowhere, jobs compute is free",why:"Jobs compute is cheaper per DBU than all-purpose, not free."}]},
  {type:"concept", title:"The compute menu, by workload", body:"<ul><li><b>Serverless SQL warehouse</b>: BI and SQL. Scales with concurrent users, stops when idle.</li><li><b>Serverless jobs and pipelines</b>: scheduled work without cluster tuning. <b>Standard</b> performance mode uses fewer DBUs but may take 4–6 minutes to start; <b>Performance optimized</b> starts and runs faster for time-sensitive work.</li><li><b>Classic jobs compute</b>: created for the run and terminated after. Lower DBU rate than all-purpose.</li><li><b>All-purpose compute</b>: interactive notebooks. Always set auto termination.</li></ul>"},
  {type:"sort", kind:"build", title:"Pick the compute", q:"Match each Halvorsen workload to the compute you would recommend.",
    buckets:[{k:"sql",n:"Serverless SQL warehouse"},{k:"sj",n:"Serverless job / pipeline"},{k:"cj",n:"Classic jobs compute"},{k:"ap",n:"All-purpose compute"}],
    items:[
      {t:"Power BI OEE report, 900 users, burst before 07:00",k:"sql",why:"Spiky BI concurrency is what a serverless SQL warehouse is built for."},
      {t:"OEE pipeline that must finish before 06:30",k:"sj",why:"No cluster to tune, and Performance optimized mode protects the deadline."},
      {t:"Weekly model training that needs a specific GPU VM type",k:"cj",why:"A specific instance type is a classic-compute reason."},
      {t:"Raj’s team exploring silver tables in notebooks",k:"ap",why:"Interactive development. Keep auto termination short."},
      {t:"Supplier-file ingestion that can start any time before 05:00",k:"sj",why:"Not time-critical: serverless in Standard mode uses fewer DBUs."}]},
  {type:"concept", title:"Sizing classic compute", body:"<p>When you do use classic compute, sizing is a balance between the number of workers and the size of each worker. Look at total cores, total memory and local disk, not worker count alone.</p><ul><li><b>Simple batch ETL</b>: smaller, cheaper instances.</li><li><b>Complex ETL with wide joins</b>: fewer, larger workers; more memory if you see spills.</li><li><b>Repeated reads</b> (analysis, ML): storage-optimised instances with disk caching.</li><li><b>Autoscaling</b>: for long-running jobs whose load varies.</li><li><b>Spot VMs</b>: for workloads with relaxed deadlines.</li><li><b>Photon</b>: pays off on SQL and DataFrame work with joins, aggregations and large scans; little effect on small, fast queries.</li></ul>", diagram:"sizing",
    analogy:"Sizing is like staffing a warehouse shift. More people help only if the work can be split; one heavy lift needs a stronger person, not more of them."},
  {type:"mcq", q:"A complex nightly join on classic compute spills to disk and runs 3 hours on 16 small workers. What is the best first change?",
    opts:[{t:"Try fewer, larger memory-optimised workers and compare cost and duration on the same input",ok:true,why:"Right. Spills mean memory per task is short. Fewer, larger workers also cut shuffle between nodes. Measure before and after."},
          {t:"Double the worker count",why:"More small workers add shuffle and still lack memory per task."},
          {t:"Turn off Photon",why:"Photon usually helps joins and aggregations; it is not the cause of spills."},
          {t:"Move it to an all-purpose cluster",why:"Higher rate, shared resources, same memory problem."}]},
  {type:"concept", title:"Evidence, not opinion", body:"<p>A sizing decision a client will trust has numbers behind it.</p><ul><li><b>Before</b>: duration, DBUs and cost of the current runs from system tables.</li><li><b>Where time goes</b>: the query profile and Spark UI show spills, skew and shuffle.</li><li><b>One change at a time</b>, on the same input, so the effect is clear.</li><li><b>After</b>: the same measures, written into the ADR.</li></ul>"},
  {type:"order", kind:"build", title:"The right-sizing loop", q:"Put the right-sizing steps in order.",
    items:["Measure current duration and cost","Find the bottleneck in the query profile or Spark UI","Change one setting","Re-run on the same input","Compare cost and duration","Record the decision and evidence in an ADR"],
    why:"Baseline first, then diagnose, change one thing, test fairly, compare, and write it down so the next person knows why."},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Serverless compute","Managed by Databricks; fast start, auto scaling, one DBU price that includes infrastructure."],
    ["Classic compute","VMs in the client’s subscription; you choose size and pay DBUs plus VM cost."],
    ["Jobs compute","Created for a scheduled run, terminated after; lower DBU rate than all-purpose."],
    ["Standard performance mode","Serverless jobs use fewer DBUs; may start 4–6 minutes slower."],
    ["Photon","Vectorised engine; best for joins, aggregations and large scans."],
    ["Auto termination","Stops an idle all-purpose cluster after a set time."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>OEE must reach Power BI by 07:00. Today the OEE pipeline runs on a classic cluster that is always on. Developers keep an all-purpose cluster with auto termination switched off. The maintenance model retrains weekly.</p>",
    qs:[
      {q:"What do you recommend for the OEE pipeline?",opts:[
        {t:"A triggered serverless pipeline in Performance optimized mode, with the deadline monitored",ok:true,why:"Right. It runs only when triggered, needs no tuning, and the mode protects the 07:00 deadline."},
        {t:"Keep the always-on classic cluster for safety",why:"It pays for idle hours that add nothing to a daily metric."},
        {t:"Run it on the developers’ all-purpose cluster",why:"Higher rate and noisy neighbours on a deadline-critical job."}]},
      {q:"What is the quickest saving on the developers’ cluster?",opts:[
        {t:"Set auto termination (for example 30 minutes) and enforce it with a compute policy",ok:true,why:"Right. Idle overnight hours disappear, and the policy stops anyone switching it off again."},
        {t:"Make the cluster bigger so work finishes faster",why:"Bigger idle clusters cost more, not less."},
        {t:"Delete it and ban notebooks",why:"Developers need interactive compute; control it, don’t remove it."}]}]}
  ]},
{ id:"lesson-2", short:"Cost & FinOps", title:"Cost Visibility & FinOps", badge:"FO", badgeName:"FinOps Analyst",
  goal:"Attribute Databricks cost by tag, job and SKU with system tables, set budgets, and explain how serverless changes cost behaviour.",
  blocks:[
  {type:"poll", kind:"hook", q:"The CFO asks which workload cost the most last month. How long would it take your team to answer today?",
    opts:["Minutes, with one query","A few days of spreadsheet work","We could not answer it"],
    reveal:"Most teams answer “days” or “not at all”, because usage was never tagged. With tags and system tables it is one query. That query is your Lab 7.1."},
  {type:"concept", title:"What system.billing.usage records", body:"<p>Each row is usage of one SKU by one workload over a time window. Key columns:</p><ul><li><code>usage_date</code>, <code>usage_start_time</code>, <code>usage_end_time</code></li><li><code>sku_name</code>, <code>usage_unit</code> (usually DBU), <code>usage_quantity</code></li><li><code>custom_tags</code>: a map of the tags on the resource</li><li><code>usage_metadata</code>: <code>job_id</code>, <code>cluster_id</code>, <code>warehouse_id</code>, <code>dlt_pipeline_id</code> and more</li><li><code>billing_origin_product</code>, <code>product_<wbr>features.<wbr>is_<wbr>serverless</code>, <code>identity_<wbr>metadata.<wbr>run_<wbr>as</code></li><li><code>record_type</code>: ORIGINAL, RETRACTION or RESTATEMENT</li></ul><p>Multiply quantity by <code>system.<wbr>billing.<wbr>list_<wbr>prices.<wbr>pricing.<wbr>effective_<wbr>list.<wbr>default</code> for the price valid at <code>usage_end_time</code>. That is <b>list</b> price, before any negotiated discount.</p>"},
  {type:"mcq", q:"A usage row was corrected: the table now holds an ORIGINAL of 50 DBU, a RETRACTION of −50 and a RESTATEMENT of 30. What do you do?",
    opts:[{t:"Sum all three: the result, 30 DBU, is the corrected usage",ok:true,why:"Right. The retraction cancels the original and the restatement carries the corrected value, so a plain SUM is correct."},
          {t:"Filter to ORIGINAL rows only",why:"That keeps the wrong 50 and ignores the correction."},
          {t:"Take the maximum value",why:"There is no such rule. Sum the records."},
          {t:"Delete the retraction row",why:"System tables are read-only, and the sum already handles it."}]},
  {type:"concept", title:"Tags make cost attributable", body:"<ul><li><b>Custom tags</b> on jobs, pipelines, clusters and SQL warehouses flow into <code>custom_tags</code>.</li><li><b>Serverless usage policies</b> (Public Preview) apply tags to serverless notebooks, jobs and pipelines for users assigned to them.</li><li><b>Compute policies</b> can require tags on classic compute so nobody forgets.</li><li>Agree a short tag standard, for example <code>team</code>, <code>env</code>, <code>workload</code>, and track the <b>untagged share</b> as a KPI.</li></ul>",
    analogy:"Untagged usage is like an expense claim with no cost centre. It still gets paid, but nobody can be asked about it."},
  {type:"sort", kind:"build", title:"Which column answers it?", q:"Match each question to the column you would group or filter by.",
    buckets:[{k:"tag",n:"custom_tags"},{k:"meta",n:"usage_metadata"},{k:"sku",n:"sku_name"},{k:"feat",n:"product_features"}],
    items:[
      {t:"How much did the operations team spend?",k:"tag",why:"Team is a tag you set; it lives in custom_tags."},
      {t:"Which job ID cost the most?",k:"meta",why:"usage_metadata.job_id identifies the job."},
      {t:"How much went on all-purpose versus jobs compute?",k:"sku",why:"The SKU name tells you the compute type and tier."},
      {t:"What share of usage was serverless?",k:"feat",why:"product_features.is_serverless flags serverless usage."},
      {t:"Which SQL warehouse served Power BI?",k:"meta",why:"usage_metadata.warehouse_id."}]},
  {type:"concept", title:"Budgets: alerts, not a brake", body:"<p>Account admins create <b>budgets</b> in the account console. A budget can be scoped to workspaces and to custom tags, with up to four monthly thresholds that send email alerts.</p><ul><li>Measured in USD at <b>list</b> price, without discounts.</li><li>Alerts can lag usage by up to 24 hours.</li><li>A budget is not a hard spending cap. Stopping spend is your job: schedules, policies, auto termination.</li></ul>"},
  {type:"mcq", q:"Priya wants a guarantee that platform spend can never exceed the monthly budget. What do you tell her?",
    opts:[{t:"Budgets alert us at thresholds; we enforce limits through compute policies, schedules and auto termination, and review spend weekly",ok:true,why:"Right. Budgets warn; controls on compute prevent. Promising a hard cap from a budget would be wrong."},
          {t:"Set a budget and Databricks will stop all jobs at the limit",why:"Budgets are not a hard cap; the docs warn against relying on them that way."},
          {t:"Remove all serverless compute",why:"That does not cap spend and loses the idle-cost benefit."},
          {t:"Check the Azure invoice at month end",why:"Too late, and it does not attribute cost to workloads."}]},
  {type:"concept", title:"How serverless changes cost behaviour", body:"<ul><li><b>No idle clusters</b>: you pay while work runs, so quiet hours cost nothing.</li><li><b>Higher DBU rate, no VM bill</b>: the serverless price includes infrastructure, so compare total cost, not DBU rates.</li><li><b>Mode matters</b>: continuous pipelines run all the time; triggered pipelines run only when started. Standard performance mode uses fewer DBUs than Performance optimized.</li><li><b>Fewer knobs</b>: you control cost through scheduling, mode and data volume, not instance types.</li></ul>"},
  {type:"tradeoff", kind:"build", title:"Turn the dials", q:"The OEE pipeline runs continuously today. Plant managers read OEE before 07:00 and again after lunch. Pick a run pattern and watch the dials.",
    opts:[
      {n:"Continuous pipeline",m:[95,85,50],verdict:"Fresh to the minute, but nobody reads OEE more than twice a day. The lab shows this pipeline is the biggest single cost.",ok:false},
      {n:"Triggered hourly in plant hours",m:[70,30,35],verdict:"Best fit. Fresh for both readings, runs only when needed, and matches the Week 1 decision.",ok:true},
      {n:"Triggered once at 04:15",m:[25,10,20],verdict:"Cheapest, and meets 07:00, but the after-lunch check shows last night’s numbers.",ok:false}]},
  {type:"spot", title:"Spot the mistakes", q:"A cost report makes these claims. Tap every wrong one, then check.",
    items:[
      {t:"system.billing.usage shows the Azure VM cost of classic clusters.",bad:true,ex:"Wrong. It shows Databricks usage. Classic VM cost is on the Azure bill."},
      {t:"Summing usage_quantity nets out retractions.",bad:false,ex:"True."},
      {t:"Budgets apply negotiated discounts.",bad:true,ex:"Wrong. Budgets use list price."},
      {t:"Serverless usage policies tag serverless usage for attribution.",bad:false,ex:"True (Public Preview)."},
      {t:"A serverless SKU with a higher DBU rate is always more expensive overall.",bad:true,ex:"Wrong. It includes infrastructure and removes idle time. Compare total cost."},
      {t:"Tags on a job appear in the custom_tags column.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Lab 7.1 sample month: list cost $609.38. The continuous OEE pipeline is 36.3%, the developers’ all-purpose cluster 23.5%, and 8.1% of spend has no team tag.</p>",
    qs:[
      {q:"Which action cuts the most, with the least risk to OEE by 07:00?",opts:[
        {t:"Switch the OEE pipeline from continuous to triggered runs",ok:true,why:"Right. It is the largest line, and triggered runs still meet both readings."},
        {t:"Cut the Power BI warehouse size in half",why:"It is a smaller line and risks the 07:00 experience for 900 users."},
        {t:"Stop the maintenance model",why:"It is 5.2% of spend and is the predictive pilot the CFO still wants."}]},
      {q:"How do you stop the untagged share coming back?",opts:[
        {t:"Require tags through compute policies and usage policies, and report untagged share monthly",ok:true,why:"Right. Make tagging automatic, then measure it."},
        {t:"Ask people to remember to tag",why:"It decays within weeks; make it a policy."},
        {t:"Delete untagged clusters automatically",why:"Disruptive, and hides the cost instead of attributing it."}]}]}
  ]},
{ id:"lesson-3", short:"Bundles", title:"Bundles: databricks.yml, Targets & Variables", badge:"BA", badgeName:"Bundle Author",
  goal:"Package a project as a Declarative Automation Bundle with resources, variables and dev/prod targets, and deploy it with the CLI.",
  blocks:[
  {type:"poll", kind:"hook", q:"How does Raj’s team move a pipeline from development to production today?",
    opts:["A scripted, reviewed deployment","Someone recreates it by hand in the production workspace","Nobody is sure"],
    reveal:"Hand-built production is the norm in teams coming from SSIS. It is also why 340 packages fail about twice a month. A bundle makes production a copy of reviewed code, not a copy of someone’s clicks."},
  {type:"concept", title:"What a bundle is", body:"<p>A <b>Declarative Automation Bundle</b> (formerly Databricks Asset Bundle) is source code plus YAML that declares the Databricks resources the code needs: jobs, pipelines, schemas and more. The Databricks CLI validates it and deploys it to a target workspace.</p><p>Everything lives in Git, so every change to production is reviewed and repeatable.</p>", diagram:"bundle"},
  {type:"mcq", q:"What does a bundle deploy to the workspace?",
    opts:[{t:"The resources declared in YAML and the source files they reference",ok:true,why:"Right. Jobs, pipelines and other resources are created or updated to match the YAML, with code synced alongside."},
          {t:"Only notebooks",why:"Bundles deploy jobs, pipelines and other resources, not just notebooks."},
          {t:"A copy of the data",why:"Bundles deploy code and resource definitions, never data."},
          {t:"A Docker image",why:"Bundles are YAML plus files, deployed by the CLI."}]},
  {type:"concept", title:"Inside databricks.yml", body:"<ul><li><code>bundle</code>: the project name (required).</li><li><code>include</code>: extra YAML files, for example <code>resources/*.yml</code>.</li><li><code>variables</code>: values that change per target, such as the catalog.</li><li><code>resources</code>: jobs, pipelines, schemas and more.</li><li><code>targets</code>: named deployments, each able to override workspace, variables, permissions and <code>run_as</code>.</li></ul><p>CLI lifecycle: <code>databricks bundle init</code> → <code>validate</code> → <code>deploy -t dev</code> → <code>run</code> → <code>deploy -t prod</code>.</p>"},
  {type:"order", kind:"build", title:"Ship a bundle", q:"Put the bundle lifecycle in order.",
    items:["databricks bundle init (from a template)","Edit databricks.yml and resources","databricks bundle validate","databricks bundle deploy -t dev","databricks bundle run -t dev oee_daily","Merge, then deploy -t prod from CI"],
    why:"Start from a template, describe the resources, check the YAML, deploy and test in dev, then let CI deploy to production after review."},
  {type:"concept", title:"Targets and modes", body:"<p><b>mode: development</b> prefixes resource names with <code>[dev &lt;your name&gt;]</code>, pauses schedules and triggers, marks pipelines as development and allows concurrent runs. Several developers can deploy the same bundle without clashing.</p><p><b>mode: production</b> checks that pipelines are not in development mode, that the Git branch matches the target’s <code>git.branch</code>, and that <code>run_as</code> and permissions are set; a service principal is recommended.</p>"},
  {type:"sort", kind:"build", title:"Dev or prod mode?", q:"Which deployment mode does each behaviour belong to?",
    buckets:[{k:"d",n:"mode: development"},{k:"p",n:"mode: production"}],
    items:[
      {t:"Resource names get a [dev user] prefix",k:"d",why:"So each developer gets their own copy."},
      {t:"Job schedules are paused",k:"d",why:"Dev copies should not run on a timer."},
      {t:"Checks the Git branch matches the target",k:"p",why:"Production deploys come only from the agreed branch."},
      {t:"Expects run_as and permissions, ideally a service principal",k:"p",why:"Production must not depend on one person’s account."},
      {t:"Pipelines marked development: true",k:"d",why:"Development pipelines are for iteration."}]},
  {type:"concept", title:"Variables, substitutions and templates", body:"<ul><li>Declare <code>variables: catalog: default: hal_<wbr>dev_<wbr>eu</code>; use it as <code>${var.catalog}</code>; override per target or with <code>--var=\"catalog=...\"</code> or <code>BUNDLE_VAR_catalog</code>.</li><li><b>Lookup</b> variables resolve a name (for example a SQL warehouse) to its ID.</li><li>Built-in substitutions: <code>${bundle.name}</code>, <code>${bundle.target}</code>, <code>${workspace.<wbr>current_<wbr>user.<wbr>userName}</code>, <code>${resources.<wbr>pipelines.<wbr>oee_<wbr>pipeline.<wbr>id}</code>.</li><li><b>Templates</b>: <code>databricks bundle init default-python</code> (also default-sql, default-minimal, dbt-sql, mlops-stacks, pydabs). Custom templates use a <code>databricks_<wbr>template_<wbr>schema.<wbr>json</code> and Go templating.</li></ul>"},
  {type:"mcq", q:"The OEE job must write to hal_dev_eu in dev and hal_prod_eu in prod. What is the cleanest way?",
    opts:[{t:"A catalog variable with a default of hal_dev_eu, overridden in the prod target, used as ${var.catalog}",ok:true,why:"Right. One definition, one difference per target, visible in review."},
          {t:"Two copies of the job YAML, one per environment",why:"Copies drift. Variables keep one definition."},
          {t:"Hard-code hal_prod_eu and edit it before each dev deploy",why:"Error-prone, and one mistake writes dev data to production."},
          {t:"Read the catalog from a notebook widget at run time",why:"Hidden from review and easy to get wrong in production."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Declarative Automation Bundles","Formerly Databricks Asset Bundles: code + YAML declaring jobs, pipelines and other resources."],
    ["Target","A named deployment (dev, prod) that overrides workspace, variables and run_as."],
    ["mode: development","Prefixes names, pauses schedules, development pipelines."],
    ["mode: production","Checks branch, run_as and permissions; prefer a service principal."],
    ["${var.catalog}","Reference to a bundle variable, set per target or with --var."],
    ["databricks bundle validate","Checks bundle configuration before deploy."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Halvorsen has two regions with one metastore each. Catalogs follow <code>hal_<wbr>&lt;env&gt;_<wbr>&lt;region&gt;</code>. The OEE pipeline and its daily job must run in both regions, and EU data must stay in the EU.</p>",
    qs:[
      {q:"How do you deploy the same OEE bundle to both regions?",opts:[
        {t:"Separate targets, such as prod_eu and prod_na, each with its own workspace host and catalog variable",ok:true,why:"Right. One codebase, one target per regional workspace, so EU data is processed only in the EU workspace."},
        {t:"One prod target that writes both regions’ data to hal_prod_eu",why:"That moves North American data into the EU catalog and mixes regions."},
        {t:"Copy the repository for each region",why:"Two codebases drift apart; targets solve this."}]},
      {q:"Who should production jobs run as?",opts:[
        {t:"A service principal set with run_as in the prod target",ok:true,why:"Right. Jobs keep working when people leave, and access is auditable."},
        {t:"Raj, because he leads the team",why:"Jobs would break if his account changed and would run with his personal access."},
        {t:"Whoever deployed last",why:"Unpredictable access and unclear audit trail."}]}]}
  ]},
{ id:"lesson-4", short:"CI/CD & VS Code", title:"CI/CD with GitHub Actions & VS Code", badge:"CD", badgeName:"Release Engineer",
  goal:"Build a GitHub Actions pipeline that validates and deploys a bundle with a service principal, and develop locally in VS Code.",
  blocks:[
  {type:"poll", kind:"hook", q:"Whose credentials should deploy to Halvorsen’s production workspace?",
    opts:["The lead developer’s personal token","A shared admin account","A service principal used only by the pipeline"],
    reveal:"The service principal. Personal tokens break when people leave and blur the audit trail; shared accounts are worse. With OIDC federation the pipeline does not even need a stored secret."},
  {type:"concept", title:"The delivery flow", body:"<p>Code moves one way: from a developer’s machine, through review, into production. Only the pipeline touches production.</p>", diagram:"cicd"},
  {type:"order", kind:"build", title:"Build the pipeline", q:"Put the CI/CD steps in order for a change to the OEE job.",
    items:["Change code in VS Code and deploy to your dev target","Open a pull request","CI runs bundle validate and unit tests","A reviewer approves","Merge to main","CD deploys to prod as the service principal"],
    why:"Test in your own dev copy, get review, let CI check it, merge, and let the pipeline deploy with its own identity."},
  {type:"concept", title:"Authenticating GitHub Actions", body:"<ul><li>Create a <b>service principal</b> and grant it only what deployment needs.</li><li>Preferred: <b>workload identity federation (OIDC)</b>. Add a GitHub federation policy to the service principal; the workflow sets <code>DATABRICKS_<wbr>AUTH_<wbr>TYPE: github-oidc</code>, <code>DATABRICKS_HOST</code> and <code>DATABRICKS_CLIENT_ID</code>, and needs <code>permissions: id-token: write</code>.</li><li>Install the CLI with the <code>databricks/setup-cli</code> action, then run <code>databricks bundle validate</code> and <code>databricks bundle deploy -t prod</code>.</li><li>Use a GitHub <b>environment</b> for prod with required reviewers.</li></ul>"},
  {type:"mcq", q:"Why prefer OIDC federation over storing a service principal token as a GitHub secret?",
    opts:[{t:"No long-lived secret to leak or rotate; GitHub proves the workflow’s identity at run time",ok:true,why:"Right. The federation policy trusts only tokens from the named repository and environment."},
          {t:"It makes deployments faster",why:"Speed is not the point; security is."},
          {t:"Tokens cannot be used in GitHub Actions",why:"They can; the docs show a token example. OIDC is the stronger option."},
          {t:"It removes the need for a service principal",why:"OIDC authenticates as a service principal; you still need one."}]},
  {type:"concept", title:"Developing locally in VS Code", body:"<ul><li>The <b>Databricks extension for VS Code</b> connects your local project to a workspace.</li><li>Work with bundles from the editor: deploy and run jobs and pipelines in your dev target.</li><li><b>Databricks Connect</b> runs and debugs local Python against remote Databricks compute, including stepping through notebook cells.</li><li>Sync local code to a workspace folder, or run a file as a job.</li></ul>",
    analogy:"VS Code is the workshop, the dev target is the test bench, and production is the customer site. Only the delivery van (CI/CD) goes to the customer."},
  {type:"mcq", q:"A developer wants to set a breakpoint in a PySpark transform and inspect real silver data. What helps most?",
    opts:[{t:"Databricks Connect through the VS Code extension",ok:true,why:"Right. The code runs locally in the debugger while Spark work runs on remote compute."},
          {t:"databricks bundle deploy -t prod",why:"Never debug by deploying to production."},
          {t:"A GitHub Actions workflow",why:"CI runs checks; it is not an interactive debugger."},
          {t:"Budgets",why:"Budgets track cost."}]},
  {type:"concept", title:"CI/CD best practices", body:"<ul><li>Validate and test on every pull request; deploy to prod only from <code>main</code>.</li><li>Production deploys run as a service principal; nobody edits production by hand.</li><li>Deploy production bundles to a shared, read-only path, not a user folder.</li><li>Pin tool versions you can, and keep secrets out of YAML.</li><li>One concurrency group per target, so two deploys never overlap.</li></ul>"},
  {type:"spot", title:"Spot the mistakes", q:"A team’s CI/CD design contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"The workflow needs permissions id-token: write for OIDC.",bad:false,ex:"True."},
      {t:"Each developer deploys to prod from their laptop after testing.",bad:true,ex:"Wrong. Only the pipeline deploys to production."},
      {t:"mode: production checks the Git branch against the target.",bad:false,ex:"True."},
      {t:"A personal access token in the YAML file is fine if the repo is private.",bad:true,ex:"Wrong. Secrets never go in YAML; prefer OIDC."},
      {t:"bundle validate catches configuration errors before deploy.",bad:false,ex:"True."},
      {t:"CI/CD removes the need for code review.",bad:true,ex:"Wrong. Review is a step in the flow."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Service principal","A non-human identity for automation; production runs and deploys as it."],
    ["OIDC federation","GitHub proves workflow identity at run time; no stored token."],
    ["databricks/setup-cli","GitHub Action that installs the Databricks CLI."],
    ["Databricks Connect","Run and debug local code against remote Databricks compute."],
    ["GitHub environment","Holds prod variables and can require approval before deploy."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Raj’s team has 6 SQL/SSIS developers and little Git experience. Today production changes are made by hand, and SSIS loads fail about twice a month.</p>",
    qs:[
      {q:"What is a realistic first CI/CD step for this team?",opts:[
        {t:"Start from a bundle template, protect main, and run validate on every PR with a deploy-to-prod job behind approval",ok:true,why:"Right. Small, safe and teachable, and production changes stop being manual from day one."},
        {t:"Build a full multi-stage pipeline with canary releases first",why:"Too much at once for a team new to Git."},
        {t:"Keep manual production changes until everyone learns Python",why:"The pipeline is YAML and CLI; it does not need Python skills."}]},
      {q:"A failed deploy left prod half-updated. What does the bundle give you?",opts:[
        {t:"Redeploy the last good commit from main; the bundle brings resources back to that definition",ok:true,why:"Right. Production equals a commit, so rollback is a redeploy."},
        {t:"Rebuild the jobs by hand from memory",why:"That is the habit CI/CD replaces."},
        {t:"Restore the workspace from a backup",why:"Not needed; the definition is in Git."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of this week’s compute, cost and deployment topics. 90 seconds. Score 6 or more to earn the T07 Platform Operator badge.",
    qs:[
      {q:"Where does a classic cluster’s VM cost appear?",o:["system.billing.usage","The Azure bill","Budgets only"],a:1},
      {q:"Best compute for a 900-user Power BI burst?",o:["Serverless SQL warehouse","All-purpose cluster","Classic jobs compute"],a:0},
      {q:"ORIGINAL 50, RETRACTION −50, RESTATEMENT 30. Usage?",o:["50","80","30"],a:2},
      {q:"Which column holds your team tag?",o:["custom_tags","sku_name","record_type"],a:0},
      {q:"Do budgets stop spend at the limit?",o:["Yes, always","No, they alert","Only for SQL"],a:1},
      {q:"Which mode pauses schedules on deploy?",o:["mode: production","mode: development","mode: serverless"],a:1},
      {q:"How do you reference a bundle variable?",o:["${var.catalog}","{{catalog}}","$catalog"],a:0},
      {q:"OIDC in GitHub Actions needs which permission?",o:["contents: write","id-token: write","actions: write"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T07",n:"T07 Platform Operator"};

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
  box.appendChild(el("h2",null,"Can you run it in 90 seconds?"));
  box.appendChild(el("p",null,b.q));
  const stage=el("div","opts"); const start=el("button","btn",S.badges[FINAL_BADGE.k]?"Play again":"Start the round");
  const row=el("div","btnrow"); row.append(start); box.append(row,stage);
  let timer, left, qi, score, order;
  function end(){clearInterval(timer); stage.innerHTML="";
    const pass=score>=6;
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?`Badge earned: ${FINAL_BADGE.n}.`:"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">T07 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
