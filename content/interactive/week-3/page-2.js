
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  decl:`<div class="silo"><div><b>Imperative (SSIS-style)</b><ul><li>You write each step and the order they run in</li><li>You code checkpoints, retries and “what is new since last time”</li><li>Adding a table means rewiring the schedule</li><li>Quality rules hide inside scripts</li></ul></div><div><b>Declarative (Lakeflow pipelines)</b><ul><li>You declare the tables you want and the query for each</li><li>The pipeline works out dependencies, order and parallelism</li><li>Incremental state and checkpoints are managed for you</li><li>Quality rules are named expectations with metrics</li></ul></div></div>`,
  dtypes:`<div class="ladder"><div><b>STREAMING TABLE</b>Reads an append-only source. Each record processed once. Ingestion and simple row-level steps.</div><div><b>MATERIALIZED VIEW</b>Results kept equal to the current source data, refreshed incrementally where possible. Joins, dedup, aggregates.</div><div><b>TEMPORARY VIEW</b>Computed on demand, not stored, visible only inside the pipeline. Intermediate steps and checks.</div><div><b>VIEW</b>Not stored. Unlike a temporary view, it is added to the catalog so others can query it.</div></div>`,
  oeepipe:`<div class="med"><div style="background:var(--bronze)"><b>BRONZE · ST</b>mes_runs_bronze: every MES row as received</div><span class="ar">→</span><div style="background:var(--silver)"><b>TEMP VIEW</b>production_run_parsed: typed, latest version per run</div><span class="ar">→</span><div style="background:var(--silver)"><b>SILVER · MV</b>production_run + quarantine, with expectations</div><span class="ar">→</span><div style="background:var(--gold)"><b>GOLD · MV</b>oee_daily_plant: one OEE definition</div></div>`,
  dq:`<div class="ladder"><div><b>WARN (default)</b>Row is kept. Failures counted in metrics. For plausibility rules you want to watch.</div><div><b>DROP ROW</b>Row is removed before writing. Count logged. For bad rows that must not reach the metric.</div><div><b>FAIL UPDATE</b>The update stops. No metrics written. For broken contracts that make every number wrong.</div><div><b>QUARANTINE</b>A pattern, not a keyword: drop from silver and write the same rows, with a reason, to a review table.</div></div>`,
  dag:`<div class="flow"><span><b>Trigger</b>Schedule 05:15 or table update</span><i>→</i><span><b>Task 1</b>ingest_mes (SQL)</span><i>→</i><span><b>Task 2</b>run_oee_pipeline (pipeline)</span><i>→</i><span><b>Task 3</b>check_oee_complete (SQL)</span><i>→</i><span><b>Task 4</b>notify_ops (run if: at least one failed)</span></div><div class="xbands"><div style="background:var(--sunk)">PER TASK: RETRIES · TIMEOUT · DURATION WARNING · NOTIFICATIONS</div><div style="background:var(--teal);color:#fff">JOB PARAMETERS AND TASK VALUES FLOW BETWEEN TASKS</div><div style="background:var(--sunk)">RUNS AS A SERVICE PRINCIPAL ON JOBS OR SERVERLESS COMPUTE</div></div>`,
  monitor:`<div class="stack"><div class="row"><div><b>Job run</b>Matrix view: which task failed, and which were skipped</div><div><b>Task run details</b>Error message, output, timing</div><div><b>Pipeline UI</b>Graph, Data quality tab, update history</div><div><b>Event log</b>Every update, flow and expectation as queryable rows</div></div><div class="band uc">SYSTEM TABLES: job and task run history across the workspace, queryable with SQL</div><div class="band st">ALERTS: failure and duration notifications to email or a channel, at job or task level</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Pipelines & Dataset Types", title:"Declarative Pipelines & Dataset Types", badge:"DP", badgeName:"Pipeline Declarer",
  goal:"Explain what a declarative pipeline does for you, and choose the right dataset type (streaming table, materialized view or view) for each step.",
  blocks:[
  {type:"poll", kind:"hook", q:"Halvorsen runs 340 SSIS packages every night. When a new table is added, who works out where it fits in the run order?",
    opts:["The scheduler does it automatically","A developer rewires the schedule by hand","Nobody, it just gets appended to the end"],
    reveal:"In imperative ETL it is a developer, by hand, every time. That is one reason the packages fail about twice a month. A declarative pipeline reads the queries and works out the order itself."},
  {type:"concept", title:"Declarative vs imperative", body:"<p>In <b>Lakeflow Spark Declarative Pipelines</b> (formerly Delta Live Tables) you declare <b>what</b> each table should contain, as a query. The pipeline works out <b>how</b>: which tables depend on which, what order to run them in, what can run in parallel, and which records are new since the last update.</p><p>You still own the logic. You stop owning the plumbing.</p>", diagram:"decl",
    analogy:"Ordering in a restaurant. You say what you want on the plate. The kitchen decides which station starts first."},
  {type:"mcq", q:"Which of these does a declarative pipeline work out for you?",
    opts:[{t:"The order to update tables, based on which tables each query reads",ok:true,why:"Right. The pipeline builds the dependency graph from your queries and runs tables in the right order, in parallel where it can."},
          {t:"The business definition of OEE",why:"No. Business logic is still yours. The pipeline runs it; it does not invent it."},
          {t:"Which source systems to connect to",why:"You choose the sources in your queries."},
          {t:"Who is allowed to read the gold tables",why:"Access is set in Unity Catalog, not by the pipeline."}]},
  {type:"concept", title:"Three dataset types", body:"<p>A pipeline produces three kinds of dataset. Choosing the right one is most of the design.</p><ul><li><b>Streaming table</b>: for append-only sources. Each record is processed once. Best for ingestion into bronze and simple row-level steps.</li><li><b>Materialized view</b>: its results are kept equal to the current source data, refreshed incrementally where possible. Best for joins, deduplication, corrections and aggregates.</li><li><b>View</b>: computed on demand and not stored. A <code>TEMPORARY VIEW</code> exists only inside the pipeline; a <code>VIEW</code> is added to the catalog.</li></ul><p>Streaming tables and materialized views are Unity Catalog managed tables that others can query.</p>", diagram:"dtypes"},
  {type:"sort", kind:"build", title:"Pick the dataset type", q:"Drag each Halvorsen dataset to the type you would use. On a phone, tap a dataset, then tap a type.",
    buckets:[{k:"st",n:"Streaming table",s:"append-only, once per record"},{k:"mv",n:"Materialized view",s:"always matches the source"},{k:"v",n:"Temporary view",s:"pipeline-only, not stored"}],
    items:[
      {t:"Daily MES CSV rows landing from 9 plants",k:"st",why:"New files only ever add rows. A streaming table processes each one once."},
      {t:"Sensor readings, ~41M a day, append-only",k:"st",why:"High-volume append-only data is the streaming table's job."},
      {t:"Daily OEE per plant, recomputed when a run is corrected",k:"mv",why:"An aggregate that must reflect corrections belongs in a materialized view."},
      {t:"Production runs where a resent file must replace the earlier version",k:"mv",why:"“Latest version wins” means earlier results change. A materialized view keeps up; a streaming table would not."},
      {t:"Typed and parsed MES rows used only by the next step",k:"v",why:"An intermediate step nobody outside needs: a temporary view, no storage cost."}]},
  {type:"concept", title:"Writing a pipeline in SQL", body:"<ul><li>Bronze: <code>CREATE OR REFRESH STREAMING TABLE bronze.mes_runs_bronze AS SELECT * FROM STREAM read_files('/Volumes/…/mes/', format =&gt; 'csv')</code>. The <code>STREAM</code> keyword makes the read incremental.</li><li>Gold: <code>CREATE OR REFRESH MATERIALIZED VIEW gold.oee_daily_plant AS SELECT …</code>. No <code>STREAM</code>.</li><li>Refer to other datasets by name. Files can sit in any order in the <b>Lakeflow Pipelines Editor</b>; the pipeline analyses the dependencies.</li><li>Common settings: default catalog and schema, <b>serverless</b> compute (recommended for new pipelines), <b>triggered</b> (run then stop, the default) or <b>continuous</b>, and parameters your SQL can read.</li><li><b>Development mode</b> keeps compute warm and turns off retries so you see errors fast. Production runs retry and release compute.</li></ul>"},
  {type:"tradeoff", kind:"build", title:"Triggered or continuous?", q:"The OEE pipeline must finish by 07:00 local. MES files arrive once a night. Pick a pipeline mode and watch the dials.",
    opts:[
      {n:"Continuous pipeline",m:[95,85,60],verdict:"Fresh to the minute, but the data arrives once a night. You pay for always-on compute that waits for files.",ok:false},
      {n:"Triggered, run by a job after files land",m:[70,20,30],verdict:"Best fit. One update per night, compute stops afterwards, and the job adds retries and alerts.",ok:true},
      {n:"Triggered, run by hand when someone remembers",m:[30,15,70],verdict:"Cheap compute, but the 07:00 deadline depends on a person. That is the current SSIS problem in a new tool.",ok:false}]},
  {type:"concept", title:"Joins in pipelines", body:"<ul><li><b>Stream-static join</b>: a streaming table joined to a mostly static table (for example plant master data). No watermark is needed. Each new record joins the static table as it is at that moment. Earlier results are <b>not recalculated</b> if the static table changes, unless you run a full refresh.</li><li><b>Stream-stream join</b>: both sides are streams, so Databricks keeps state. Databricks recommends <b>watermarks on both sides</b> to bound that state.</li><li><b>Join in a materialized view</b>: recomputed to match current data. Use it when a change in the dimension must restate history.</li></ul>"},
  {type:"mcq", q:"Runs are enriched with each line’s ideal rate through a stream-static join. Engineering corrects the ideal rate for line B2-L1. What happens to OEE already calculated?",
    opts:[{t:"Earlier joined rows keep the old rate until a full refresh; only new rows use the new rate",ok:true,why:"Right. Stream-static joins do not restate past results. If a rate change must restate history, join in a materialized view instead."},
          {t:"All past rows are recalculated automatically",why:"That is materialized view behaviour, not stream-static."},
          {t:"The pipeline fails until someone approves the change",why:"Nothing fails. That is exactly why the silent difference is dangerous."},
          {t:"The join needs a watermark, so the update is rejected",why:"Stream-static joins do not need watermarks."}]},
  {type:"order", kind:"build", title:"Build the OEE pipeline", q:"Put the Halvorsen OEE flow in the order data travels.",
    items:["MES files land in cloud storage","Bronze streaming table: rows as received","Temporary view: typed, latest version per run","Silver materialized view with expectations","Gold materialized view: oee_daily_plant","Power BI reads gold through a SQL warehouse"],
    why:"Land, keep raw, parse, enforce quality, compute the one definition, serve. The pipeline runs the middle four for you in this order because each query reads the one before."},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Declarative pipeline","You declare tables as queries; the pipeline works out order, parallelism and incremental state."],
    ["Streaming table","Append-only source, each record processed once. Ingestion and row-level steps."],
    ["Materialized view","Kept equal to the current source data. Joins, dedup, aggregates."],
    ["Temporary view","Not stored, pipeline-only. Intermediate steps and checks."],
    ["Stream-static join","No watermark; past results not restated when the static side changes."],
    ["Triggered mode","Process what is there, then stop. The default and the usual choice for daily data."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Each plant’s MES drops one CSV a night: about 15,000 runs a month across 9 plants. Plants sometimes resend a corrected file for the same day. Raj’s team knows SQL well and Python hardly at all.</p>",
    qs:[
      {q:"Which dataset type should silver <code>production_run</code> be?",opts:[
        {t:"A materialized view, because a resent file must replace the earlier version of a run",ok:true,why:"Right. At 15,000 runs a month the recompute is cheap, and corrections flow through to OEE automatically."},
        {t:"A streaming table, because everything should be streaming",why:"A streaming table processes each row once and would keep both versions of a corrected run."},
        {t:"A temporary view, to save storage",why:"Power BI and analysts need to query silver; a temporary view is not visible outside the pipeline."}]},
      {q:"Which language should the first pipelines use?",opts:[
        {t:"SQL, so the existing team can read, review and run them",ok:true,why:"Right. Declarative pipelines support SQL fully. The goal says the internal team must run it."},
        {t:"Python, because it is more powerful",why:"Power the team cannot maintain becomes a support ticket to the consultants."},
        {t:"Keep SSIS and call it from Databricks",why:"That keeps the failure-prone part and adds a second tool."}]}]}
  ]},
{ id:"lesson-2", short:"Expectations & Quality", title:"Expectations & a Data-Quality Strategy", badge:"DQ", badgeName:"Quality Guard",
  goal:"Write expectations with the right violation mode, quarantine bad rows without losing them, and explain a data-quality strategy in business terms.",
  blocks:[
  {type:"poll", kind:"hook", q:"A plant reports 520 minutes of downtime in a 480-minute shift. What should the pipeline do?",
    opts:["Stop everything until it is fixed","Drop the row quietly","Keep it, but flag it","Set it aside for review and carry on"],
    reveal:"There is no single right answer. It depends on what the bad row costs if it gets through, and what stopping costs. This lesson gives you a rule to decide, and a way to explain it to the client."},
  {type:"concept", title:"Expectations: name, rule, action", body:"<p>An <b>expectation</b> is a named rule on a dataset, written as a SQL condition. Every row is checked, and the pipeline records how many passed and failed.</p><ul><li><code>CONSTRAINT downtime_valid EXPECT (run_min BETWEEN 0 AND planned_production_min) ON VIOLATION DROP ROW</code></li><li>No <code>ON VIOLATION</code> clause means <b>warn</b>: keep the row, count the failure.</li><li><code>ON VIOLATION FAIL UPDATE</code> stops the update.</li><li>Expectations work on streaming tables, materialized views and temporary views. The rule cannot use aggregates or subqueries: it sees one row at a time.</li></ul>", diagram:"dq"},
  {type:"mcq", q:"Which violation mode leaves you with no data-quality metrics for that update?",
    opts:[{t:"FAIL UPDATE",ok:true,why:"Right. The update fails, so no metrics are recorded. You read the error in the update details instead."},
          {t:"Warn",why:"Warn keeps the rows and records the failures."},
          {t:"DROP ROW",why:"Dropped rows are counted and logged with the dataset metrics."},
          {t:"All three record the same metrics",why:"They differ. Fail is the one with none."}]},
  {type:"sort", kind:"build", title:"Choose the violation mode", q:"For each Halvorsen rule, choose what should happen to a row that breaks it.",
    buckets:[{k:"w",n:"Warn",s:"keep and count"},{k:"d",n:"Drop + quarantine",s:"remove, keep for review"},{k:"f",n:"Fail update",s:"stop the update"}],
    items:[
      {t:"Units made are more than the ideal rate allows (performance above 100%)",k:"w",why:"Usually a wrong ideal rate in master data, not a bad run. Keep it, watch the count, fix the master data."},
      {t:"Downtime is blank or longer than the available time",k:"d",why:"The row would corrupt availability. Remove it from silver and keep it, with a reason, for the plant to fix."},
      {t:"Scrap units greater than total units",k:"d",why:"Quality would go negative. Remove and quarantine."},
      {t:"Plant code is not one of the 9 Halvorsen plants",k:"f",why:"An unknown plant usually means the file layout or mapping is broken, so every row is suspect. Stop and investigate. (Some teams drop instead; either way, say why.)"},
      {t:"Run date missing",k:"d",why:"The row cannot be placed on a day. Remove and quarantine."}]},
  {type:"concept", title:"The quarantine pattern", body:"<p>Dropping a row hides it. Quarantine keeps it.</p><ul><li>Silver keeps rows that pass, using <code>DROP ROW</code> expectations.</li><li>A second dataset, <code>production_run_quarantine</code>, selects the rows that fail the <b>same</b> rules and adds a <code>reject_reason</code>.</li><li>Plants fix the source; the next update picks up the corrected row.</li></ul><p><b>The NULL trap.</b> A blank downtime makes the rule <code>NULL</code>, not false. <code>WHERE NOT (rule)</code> then misses the row, and it vanishes from both tables. Write the inverse NULL-safe: <code>WHERE NOT coalesce(rule, false)</code>, and make the expectation explicit: <code>run_min IS NOT NULL AND …</code>.</p>",
    analogy:"A quality inspector at the end of a line. Rejected parts go in a labelled bin, not in the skip. Someone can find out why."},
  {type:"mcq", q:"Silver drops rows where <code>run_min BETWEEN 0 AND planned_production_min</code> is not true. The quarantine table uses <code>WHERE NOT (run_min BETWEEN 0 AND planned_production_min)</code>. A row arrives with blank downtime. Where does it end up?",
    opts:[{t:"In neither table: it is lost",ok:true,why:"Right. run_min is NULL, the rule is NULL, NOT NULL is still NULL, so the quarantine filter rejects it too. Use coalesce(rule, false)."},
          {t:"In quarantine",why:"Only if the inverse is NULL-safe. As written, NULL is not true, so the row is filtered out."},
          {t:"In silver",why:"Silver needs the rule to be true, and NULL is not true."},
          {t:"The pipeline fails",why:"Nothing fails. That is why the loss goes unnoticed."}]},
  {type:"concept", title:"A data-quality strategy in four lines", body:"<ul><li><b>Contract rules → fail.</b> If the file layout or key mapping is broken, every number is wrong. Stop and alert.</li><li><b>Row rules → drop and quarantine.</b> One bad run must not block eight good plants.</li><li><b>Plausibility rules → warn.</b> Keep the row, watch the trend, fix master data.</li><li><b>Completeness → check outside the row.</b> Expectations see one row at a time, so they cannot notice a file that never arrived. Add a check task in the job that counts plants and runs.</li></ul><p>Agree each rule and its mode with the data owner. A rule nobody owns is a rule nobody fixes.</p>"},
  {type:"mcq", q:"Plant B2’s MES file never arrived last night. Which expectation on silver <code>production_run</code> catches this?",
    opts:[{t:"None of them; a completeness check in the job must catch it",ok:true,why:"Right. Expectations test rows that exist. A missing file produces no rows to test. Count plants per day in a separate check task."},
          {t:"<code>known_plant</code> with FAIL UPDATE",why:"It tests rows that arrive. B2 sent none."},
          {t:"<code>downtime_valid</code> with DROP ROW",why:"Same problem: there is no B2 row to check."},
          {t:"A warn expectation on <code>count(*)</code>",why:"Expectations cannot use aggregate functions."}]},
  {type:"spot", title:"Spot the mistakes", q:"A colleague’s data-quality design contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"An expectation with no ON VIOLATION clause keeps the failing rows.",bad:false,ex:"True. Warn is the default."},
      {t:"FAIL UPDATE is the safest choice for every rule.",bad:true,ex:"Wrong. One bad row then blocks every plant’s number. Use fail for contract breaks only."},
      {t:"Dropped-row counts are visible in the pipeline’s Data quality tab and event log.",bad:false,ex:"True."},
      {t:"An expectation can check that all 9 plants sent a file.",bad:true,ex:"Wrong. Expectations are row-level and cannot use aggregates."},
      {t:"A quarantine table should use the same rules as silver, inverted and NULL-safe.",bad:false,ex:"True. Otherwise rows fall between the two."},
      {t:"Expectations can be defined on temporary views.",bad:false,ex:"True. Streaming tables, materialized views and temporary views all support them."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Warn","Default. Row kept, failure counted."],
    ["DROP ROW","Row removed before writing; count logged."],
    ["FAIL UPDATE","Update stops; no metrics for that update."],
    ["Quarantine","Same rules inverted, NULL-safe, with a reject reason, in a review table."],
    ["NULL trap","A NULL rule is not true and not false; use coalesce(rule, false) in the inverse."],
    ["Completeness","Checked by a job task, because expectations see one row at a time."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Halvorsen’s three OEE definitions differ on one point: whether <b>planned maintenance</b> counts as downtime. Tomás Ferreira (Head of Operations) owns the metric. The board wants one number.</p>",
    qs:[
      {q:"Where should the planned-maintenance decision be made and recorded?",opts:[
        {t:"Agreed with Tomás as the metric owner, written in an ADR, and coded once in the gold definition",ok:true,why:"Right. It is a business decision with a technical home. The ADR records why; gold applies it everywhere."},
        {t:"Each plant chooses, and gold stores both",why:"That is three definitions with extra steps."},
        {t:"The data engineer picks whichever gives the higher number",why:"Not the engineer’s call, and it will not survive the CFO."}]},
      {q:"With planned maintenance excluded from planned time, a line with a 480-minute shift, 60 minutes of planned maintenance and 40 minutes of breakdowns has what availability?",opts:[
        {t:"380 ÷ 420 ≈ 0.905",ok:true,why:"Right. Planned production time is 480 − 60 = 420; run time is 420 − 40 = 380."},
        {t:"380 ÷ 480 ≈ 0.792",why:"That counts planned maintenance as downtime: the other definition."},
        {t:"440 ÷ 480 ≈ 0.917",why:"That ignores planned maintenance completely."}]}]}
  ]},
{ id:"lesson-3", short:"Lakeflow Jobs", title:"Lakeflow Jobs: Tasks, Dependencies & Triggers", badge:"JO", badgeName:"Job Orchestrator",
  goal:"Design a multi-task job with the right dependencies, trigger, control flow, retries and alerts.",
  blocks:[
  {type:"poll", kind:"hook", q:"When one of Halvorsen’s SSIS packages fails at night, how does operations usually find out?",
    opts:["An alert to the on-call engineer","A plant manager asks at 07:30 why the report is empty","A weekly failure report"],
    reveal:"Too often it is the plant manager at handover. Orchestration is not only running tasks in order. It is knowing first, retrying what is safe to retry, and telling the right person."},
  {type:"concept", title:"Core components of a job", body:"<ul><li><b>Job</b>: the unit you schedule, monitor and give permissions to.</li><li><b>Tasks</b>: notebook, SQL, pipeline, Python script or wheel, dbt, Run Job, and control-flow tasks (If/else condition, For each).</li><li><b>Dependencies</b>: each task lists the tasks it depends on, making a graph (DAG).</li><li><b>Trigger</b>: what starts a run.</li><li><b>Compute</b>: serverless or jobs compute. A pipeline task uses the compute defined in the pipeline.</li><li><b>Parameters and task values</b>: how settings and results pass between tasks.</li><li><b>Settings per task</b>: retries, timeout, duration warning, notifications.</li></ul>", diagram:"dag"},
  {type:"order", kind:"build", title:"Build the HAL-03 job", q:"Put the tasks of the nightly OEE job in dependency order.",
    items:["ingest_mes: land last night’s MES files","run_oee_pipeline: update bronze, silver and gold","check_oee_complete: every expected plant has OEE for the day","notify_ops: runs only if a task failed"],
    why:"Ingest first, then the pipeline that reads it, then a check on the output. The notify task depends on the others with a Run if condition of “At least one failed”."},
  {type:"concept", title:"Triggers: what starts a run", body:"<ul><li><b>Scheduled</b>: a cron-style time with a time zone. Simple and predictable.</li><li><b>File arrival</b>: starts when new files land in a Unity Catalog storage location (an external location or volume).</li><li><b>Table update</b>: starts when monitored tables change. Run when <b>any</b> or <b>all</b> are updated. <i>Minimum time between triggers</i> spaces runs out; <i>wait after last change</i> waits for a batch of updates to settle.</li><li><b>Continuous</b>: a new run starts as soon as the last one ends.</li><li><b>Manual</b>: Run now, or an external orchestrator.</li></ul><p>By default only one run of a job is active at a time.</p>"},
  {type:"sort", kind:"build", title:"Pick the trigger", q:"Match each need to the trigger you would use.",
    buckets:[{k:"s",n:"Scheduled"},{k:"f",n:"File arrival"},{k:"t",n:"Table update"},{k:"c",n:"Continuous"}],
    items:[
      {t:"Rebuild OEE at 05:15 every day, whatever happens",k:"s",why:"A fixed deadline with a fixed start: a schedule."},
      {t:"Start as soon as a supplier drops a file into the landing volume",k:"f",why:"New files in a Unity Catalog location: file arrival."},
      {t:"Refresh the margin model whenever silver contract tables change",k:"t",why:"Driven by data changing in tables: table update."},
      {t:"A sensor ingestion pipeline that must always be running",k:"c",why:"Always on: a continuous job. Databricks recommends this over the pipeline’s own continuous setting."}]},
  {type:"mcq", q:"Nine plants’ MES rows land in a table between 01:00 and 02:30, each as a separate write. You want one pipeline run after they have all landed, not nine. Which table update setting helps most?",
    opts:[{t:"Wait after last change, set longer than the usual gap between plant writes",ok:true,why:"Right. Each new write resets the timer, so the job starts once the writes stop. Back it with a completeness check, because a late plant can still miss the run."},
          {t:"Trigger when all tables are updated",why:"That is about several tables. Here it is one table written nine times."},
          {t:"Continuous trigger",why:"That would run all day, not once after the batch."},
          {t:"Raise maximum concurrent runs to 9",why:"You would get nine overlapping runs, the opposite of what you want."}]},
  {type:"concept", title:"Run if, If/else and For each", body:"<ul><li><b>Run if</b> sets when a task runs, based on the tasks it depends on: All succeeded (default), At least one succeeded, None failed, All done, At least one failed, All failed.</li><li><b>If/else condition task</b> compares two values with <code>==, !=, &gt;, &gt;=, &lt;, &lt;=</code>. Operands can be job parameters, task values or dynamic values such as the trigger time.</li><li><b>Task values</b>: a task sets a value (for example <code>dbutils.<wbr>jobs.<wbr>taskValues.<wbr>set(<wbr>'plants_missing', 1)</code>) and a later task reads it as <code>{{tasks.<wbr>check.<wbr>values.<wbr>plants_missing}}</code>.</li><li><b>For each</b> runs a nested task once per item in a list, such as the 9 plant codes, with a concurrency you set.</li></ul>",
    analogy:"A shift supervisor’s checklist. Run if is “only if the line stopped”. If/else is “if scrap is above 3%, call quality”. For each is “walk every line”."},
  {type:"mcq", q:"You want an email task to run only when the pipeline or the check fails. Which Run if condition do you set on it?",
    opts:[{t:"At least one failed",ok:true,why:"Right. It runs if any task it depends on failed, and is skipped on a clean night."},
          {t:"All succeeded",why:"That is the default and would email on every good night only."},
          {t:"All done",why:"That runs every night, success or failure."},
          {t:"None failed",why:"The opposite of what you want."}]},
  {type:"mcq", q:"You use a For each task to run the same completeness check for each of the 9 plants. What is the main benefit over 9 copied tasks?",
    opts:[{t:"One task definition, one list of inputs, and a failed plant shows up as one failed iteration",ok:true,why:"Right. Less copy-paste, and adding plant B5 one day means adding one item to the list."},
          {t:"It makes the pipeline itself run 9 times faster",why:"For each repeats a task; it does not speed up a pipeline. A pipeline task inside For each even runs one iteration at a time."},
          {t:"It removes the need for retries",why:"Retries are still set on the nested task."},
          {t:"It is the only way to pass parameters",why:"Job parameters and task values work without it."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Task","One unit of work in a job: notebook, SQL, pipeline, script, control flow."],
    ["Run if","When a task runs, based on its upstream tasks’ results."],
    ["Table update trigger","Starts a run when monitored tables change; any or all."],
    ["Wait after last change","Delays the run until writes stop; each write resets the timer."],
    ["If/else condition","Branches on job parameters, task values or dynamic values."],
    ["For each","Runs a nested task once per item in a list."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>OEE must be in Power BI by 07:00 local for the 07:30 shift handover. Region A (EU) and Region B (North America) are about six hours apart. MES files normally land by 02:30 local.</p>",
    qs:[
      {q:"How many OEE jobs, and how are they triggered?",opts:[
        {t:"One job per region, each scheduled in that region’s time zone with a table update trigger as an early start",ok:true,why:"Right. 07:00 is local, data stays in its region, and a late region does not hold the other back."},
        {t:"One global job at 05:00 UTC",why:"That is midnight or 01:00 on the US East Coast: before the files land."},
        {t:"A continuous job",why:"Always-on cost for data that arrives once a night."}]},
      {q:"The pipeline task fails at 03:10 with a transient cloud error. What should already be configured?",opts:[
        {t:"Retries on the pipeline task with an interval, a timeout, and a failure alert to on-call",ok:true,why:"Right. Transient errors retry on their own; real failures reach a person hours before handover."},
        {t:"Nothing; someone checks the dashboard at 07:00",why:"That is the current SSIS experience."},
        {t:"Unlimited retries so it always succeeds",why:"Unlimited retries hide real problems and can run past the deadline."}]}]}
  ]},
{ id:"lesson-4", short:"Monitor, Repair, Production", title:"Monitoring, Event Log, Repair Runs & Production Practice", badge:"OP", badgeName:"Run Operator",
  goal:"Find why a run failed, repair it safely, and run pipelines and jobs to a production standard.",
  blocks:[
  {type:"poll", kind:"hook", q:"It is 03:10. The OEE job has failed. What do you open first?",
    opts:["The pipeline code","The job run, to see which task failed and why","The Power BI report"],
    reveal:"Start with the run. The matrix view shows which task failed and which were only skipped because of it. Then go one level down: the task’s error, then the pipeline’s event log."},
  {type:"concept", title:"Where to look", body:"<ul><li><b>Job run matrix</b>: each task across runs. A task can be red because it failed, or skipped because an upstream task failed.</li><li><b>Task run details</b>: the error message, output and timing.</li><li><b>Pipeline UI</b>: the graph, each update, and the <b>Data quality</b> tab with passed, failed and dropped rows per expectation.</li><li><b>Event log</b>: every update, flow and expectation as rows. Query it with <code>SELECT * FROM event_log(<wbr>TABLE(<wbr>silver.<wbr>production_run))</code>. Only the table owner can call it.</li><li><b>System tables</b>: job and task run history across the workspace, for trends and reports.</li></ul>", diagram:"monitor"},
  {type:"mcq", q:"Tomás asks how many runs were dropped by each quality rule last night, for every night this month. Where do you get it?",
    opts:[{t:"The pipeline event log: flow_progress events carry passed and failed counts per expectation",ok:true,why:"Right. The event log is queryable SQL; group by update and expectation."},
          {t:"The job run matrix",why:"It shows task success, not row counts per rule."},
          {t:"DESCRIBE HISTORY on gold",why:"That shows table versions, not expectation results."},
          {t:"The Spark UI",why:"Spark UI shows execution detail, not data-quality metrics."}]},
  {type:"concept", title:"Repair a run", body:"<ul><li><b>Repair run</b> re-runs only the tasks that did not succeed, plus the tasks that depend on them. Successful tasks are not re-run.</li><li>You can change task settings or parameters before repairing.</li><li>Each repaired task starts <b>from the beginning</b>. If it wrote half its output before failing, a non-idempotent write duplicates data. Use overwrite, MERGE or keys that deduplicate.</li><li>Repair is for multi-task jobs. A single-task job is simply run again.</li><li>If the fix needs an upstream task that <b>succeeded</b> to run again (for example a late file the pipeline has not read), a repair of the failed task alone is not enough: run the job again, or name the extra tasks in the repair API call.</li></ul>"},
  {type:"mcq", q:"The check task failed because B2’s file was late. The file has now landed. You click Repair run. What re-runs?",
    opts:[{t:"Only check_oee_complete, which fails again because the pipeline has not read the new file",ok:true,why:"Right. The pipeline task succeeded, so repair skips it. Run the job again (ingest and silver are idempotent), or include the pipeline task in the repair."},
          {t:"Every task in the job",why:"Repair skips tasks that succeeded."},
          {t:"Only the pipeline task",why:"The pipeline succeeded; repair targets the failed task and its dependents."},
          {t:"Nothing; repair only works on failed pipelines",why:"Repair works on any multi-task job run."}]},
  {type:"order", kind:"build", title:"Run the incident", q:"Put the 03:10 incident steps in a sensible order.",
    items:["Acknowledge the alert and tell the duty contact you are on it","Find the failed task and read its error and the event log","Decide with the data owner: fix, partial publish or delay","Fix the data or setting, then re-run or repair","Check the completeness task passes and numbers look sane","Send the client a short update with what changed and what is next","Record the cause and the prevention in the runbook"],
    why:"Own it, diagnose, decide with the owner, fix, verify, communicate, learn. Communication happens before and after the fix, not only at the end."},
  {type:"concept", title:"Jobs and pipelines in production", body:"<ul><li><b>Retries with an interval</b> on tasks that can fail for transient reasons. A timeout applies to each retry.</li><li><b>Duration warning</b> set below the deadline, so you hear about slowness before 07:00.</li><li><b>Notifications</b> on failure at job or task level, to a group or channel, not one person.</li><li><b>Run as a service principal</b>, not a person who might leave.</li><li><b>Pipelines in production mode</b>: development mode is for building.</li><li><b>Idempotent tasks</b>, so a re-run or repair never doubles data.</li><li><b>Code in Git</b>, deployed with <b>Declarative Automation Bundles</b> (formerly Databricks Asset Bundles), in week 7.</li></ul>"},
  {type:"spot", title:"Spot the mistakes", q:"A runbook draft contains these statements. Tap every wrong one, then check.",
    items:[
      {t:"Repair re-runs only unsuccessful tasks and their dependents.",bad:false,ex:"True."},
      {t:"A repaired task continues from the row where it failed.",bad:true,ex:"Wrong. It starts from the beginning; make writes idempotent."},
      {t:"Expectation results can be queried from the pipeline event log.",bad:false,ex:"True."},
      {t:"Failure alerts should go to the engineer who wrote the job.",bad:true,ex:"Wrong. Send them to an on-call group or channel that is staffed."},
      {t:"Production pipelines should run in development mode so errors are easier to read.",bad:true,ex:"Wrong. Development mode turns off retries; production mode is for scheduled runs."},
      {t:"A duration warning below the deadline gives early notice of a slow run.",bad:false,ex:"True."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Matrix view","Each task across runs; failed versus skipped."],
    ["Event log","Pipeline updates, flows and expectation metrics as queryable rows."],
    ["Repair run","Re-runs unsuccessful tasks and their dependents, from the start."],
    ["Idempotent","Running twice gives the same result as running once."],
    ["Duration warning","An alert when a run takes longer than expected."],
    ["Service principal","A non-human identity that owns and runs production jobs."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>03:10. The OEE job failed: plant B2’s MES file arrived late and malformed. The other eight plants are fine. Tomás needs numbers for the 07:30 shift handover, and the board pack is due this week.</p>",
    qs:[
      {q:"What is the strongest first recommendation to Tomás?",opts:[
        {t:"Publish the eight good plants by 07:00 with B2 clearly marked “pending”, and restate B2 when its corrected file arrives",ok:true,why:"Right. Handover gets real numbers, nobody mistakes a gap for a zero, and the board pack waits for the full figure."},
        {t:"Hold everything until B2 is fixed",why:"Eight plants lose their handover numbers because of one file."},
        {t:"Publish all nine, using B2’s numbers from yesterday",why:"That is a made-up number presented as fact."}]},
      {q:"What should change so the next late file does not fail the whole job?",opts:[
        {t:"Row problems drop and quarantine; the completeness check publishes what is complete and flags what is missing",ok:true,why:"Right. Fail only on contract breaks. Missing or bad plants become visible flags, not a dead job."},
        {t:"Turn every expectation into warn",why:"Bad rows would then reach the board figure."},
        {t:"Remove the completeness check",why:"Then a missing plant silently lowers group OEE."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T03. 90 seconds. Score 6 or more to earn the T03 Pipeline Operator badge.",
    qs:[
      {q:"Append-only MES files landing nightly. Which dataset type?",o:["Materialized view","Streaming table","Temporary view"],a:1},
      {q:"Daily OEE that must reflect corrected runs?",o:["Materialized view","Streaming table","Temporary view"],a:0},
      {q:"Which expectation action records no metrics?",o:["Warn","DROP ROW","FAIL UPDATE"],a:2},
      {q:"A whole plant’s file is missing. What catches it?",o:["A DROP ROW expectation","A completeness check task","A stream-static join"],a:1},
      {q:"Run a task only if something upstream failed?",o:["Run if: At least one failed","Run if: All done","Run if: All succeeded"],a:0},
      {q:"Start a job when monitored tables change?",o:["File arrival trigger","Table update trigger","Continuous trigger"],a:1},
      {q:"What does Repair run re-run?",o:["Every task","Unsuccessful tasks and their dependents","Only the first task"],a:1},
      {q:"Where are per-expectation counts queryable with SQL?",o:["Pipeline event log","Job matrix view","DESCRIBE HISTORY"],a:0}]}
  ]}
];
const FINAL_BADGE = {k:"T03",n:"T03 Pipeline Operator"};

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
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: T03 Pipeline Operator.":"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">T03 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
