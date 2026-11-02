
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  spark:`<div class="stack"><div class="band st">DRIVER: runs your code, builds and optimises the plan, splits it into stages, schedules tasks</div><div class="row" style="grid-template-columns:repeat(3,1fr)"><div><b>Executor 1</b>Task · Task · Task<br>partitions 1–3</div><div><b>Executor 2</b>Task · Task · Task<br>partitions 4–6</div><div><b>Executor 3</b>Task · Task · Task<br>partitions 7–9</div></div><div class="band uc">DATA: Delta tables in object storage, read and written in parallel partitions</div></div>`,
  jst:`<div class="flow"><span><b>Action</b>count, write, display</span><i>→</i><span><b>Job</b>one per action</span><i>→</i><span><b>Stage 1</b>read · filter · withColumn (narrow)</span><i>→</i><span><b>Shuffle</b>rows move between executors</span><i>→</i><span><b>Stage 2</b>groupBy · agg (wide)</span><i>→</i><span><b>Result</b>to driver or table</span></div><div class="xbands"><div style="background:var(--sunk)">EACH STAGE RUNS AS TASKS: ONE TASK PER PARTITION</div><div style="background:var(--teal);color:#fff">A NEW STAGE STARTS AT EVERY SHUFFLE (JOIN, GROUPBY, WINDOW, DISTINCT)</div></div>`,
  win:`<div class="ladder" style="grid-template-columns:repeat(3,1fr)"><div><b>PARTITION BY</b>The groups. One window per case_id or per contract_id. Rows never mix across groups.</div><div><b>ORDER BY</b>Order inside each group. Needed for row_number, rank, lag, lead and running totals.</div><div><b>FRAME</b>Which rows count for each row: the whole group, or “start of group to this row” for a running total.</div></div>`,
  joins:`<div class="silo"><div><b>Broadcast hash join</b><ul><li>Small table copied to every executor</li><li>Large table is not moved at all</li><li>No shuffle, fast</li><li>Only for tables small enough to fit in memory</li></ul></div><div><b>Shuffle (sort-merge) join</b><ul><li>Both tables repartitioned by the join key</li><li>Rows with the same key meet on one executor</li><li>Works for any size; costs network and disk</li><li>Watch for skewed keys</li></ul></div></div>`,
  edges:`<div class="med"><div style="background:var(--silver)"><b>READ</b>Notebook or job task. Table names come from parameters.</div><span class="ar">→</span><div style="background:var(--teal)"><b>TRANSFORM</b>Pure functions in src/halvorsen: DataFrame in, DataFrame out. Unit-tested.</div><span class="ar">→</span><div style="background:var(--silver)"><b>WRITE</b>Notebook, job or pipeline. Writes to the right catalog per environment.</div></div>`,
  repo:`<div class="stack"><div class="row"><div><b>src/halvorsen/</b>cleaning.py · margin.py</div><div><b>tests/</b>test_*.py · conftest.py</div><div><b>notebooks/ · pipelines/</b>thin entry points</div><div><b>docs/</b>adr · standards · README</div></div><div class="band uc">DATABRICKS GIT FOLDER: one per developer, on their own branch</div><div class="band st">GIT PROVIDER: main branch, pull requests, review, CI</div></div>`,
  pyramid:`<div class="stack"><div class="band st" style="width:40%;margin:0 auto">FEW · End-to-end and reconciliation before release</div><div class="band uc" style="width:70%;margin:0 auto">SOME · Integration: run the real pipeline or job on seed data in dev</div><div class="band" style="background:var(--surface);border:1px solid var(--line);font-weight:700">MANY · Unit: one function, tiny fake DataFrame, local SparkSession, seconds</div></div>`,
  gitflow:`<div class="flow"><span><b>Branch</b>from main</span><i>→</i><span><b>Commit</b>small, clear</span><i>→</i><span><b>Push</b>to provider</span><i>→</i><span><b>Pull request</b>description + tests</span><i>→</i><span><b>CI</b>runs pytest</span><i>→</i><span><b>Review</b>another pair</span><i>→</i><span><b>Merge</b>to main</span></div><div class="xbands"><div style="background:var(--sunk)">NOBODY PUSHES STRAIGHT TO MAIN</div><div style="background:var(--teal);color:#fff">ONLY AUTOMATION UPDATES THE PRODUCTION FOLDER OR BUNDLE</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Spark Execution", title:"Spark Fundamentals & Execution", badge:"SX", badgeName:"Spark Executor",
  goal:"Explain what the driver and executors do, tell transformations from actions, and read a job as stages and tasks.",
  blocks:[
  {type:"poll", kind:"hook", q:"You run <code>df.filter(...).withColumn(...)</code> on a 2 TB table. The cell finishes in 0.2 seconds. What happened?",
    opts:["Photon is that fast","Nothing has run yet","The result came from a cache"],
    reveal:"Nothing ran. Spark is lazy: transformations only add steps to a plan. Work starts when you call an action such as <code>count()</code>, <code>display()</code> or a write. This lesson is about what happens then."},
  {type:"concept", title:"Driver and executors", body:"<p>A Spark application has one <b>driver</b> and many <b>executors</b>.</p><ul><li>The <b>driver</b> runs your Python code, builds the plan, and hands out work.</li><li><b>Executors</b> run that work as <b>tasks</b>, each on one <b>partition</b> (a slice of the data), in parallel.</li><li>Data is read from and written to storage by the executors, not the driver.</li></ul><p>On serverless compute you do not size these yourself, but the model is the same.</p>", diagram:"spark",
    analogy:"The driver is the site manager with the plan. Executors are the work crews. Each crew takes one pallet (partition) at a time."},
  {type:"mcq", q:"A data scientist runs <code>sensor_df.collect()</code> on a day of readings (~41M rows). Where does the data go?",
    opts:[{t:"Into the driver's memory, all at once",ok:true,why:"Right. collect() brings every row back to the driver. On large data this crashes the driver or makes it crawl. Aggregate or filter in Spark first."},
          {t:"It stays spread across the executors",why:"That is what transformations do. collect() is an action that pulls rows back to the driver."},
          {t:"Into a Delta table",why:"Only a write action does that."},
          {t:"Into the SQL warehouse cache",why:"collect() returns Python objects to the driver."}]},
  {type:"concept", title:"Lazy evaluation: transformations and actions", body:"<ul><li><b>Transformations</b> describe a new DataFrame: <code>select</code>, <code>filter</code>, <code>withColumn</code>, <code>join</code>, <code>groupBy().agg()</code>. They return instantly.</li><li><b>Actions</b> need a result: <code>count</code>, <code>show</code>, <code>display</code>, <code>collect</code>, <code>write</code>. Each action triggers a <b>job</b>.</li><li>Because Spark sees the whole plan before running, the optimiser can push filters down, drop unused columns and pick join strategies.</li></ul><p>The catch: every action re-runs the plan from the source unless results are written or cached.</p>"},
  {type:"sort", kind:"build", title:"Transformation or action?", q:"Sort each call. Which ones start work on the cluster?",
    buckets:[{k:"t",n:"Transformation",s:"adds to the plan"},{k:"a",n:"Action",s:"runs a job"}],
    items:[
      {t:"df.filter(F.col(\"status\") == \"CLOSED\")",k:"t",why:"Filtering describes a new DataFrame. Nothing runs."},
      {t:"df.withColumn(\"cost\", ...)",k:"t",why:"Adding a column is a transformation."},
      {t:"cases.join(contracts, \"contract_id\")",k:"t",why:"Joins are transformations, even though they will cause a shuffle when run."},
      {t:"df.groupBy(\"contract_id\").agg(F.sum(\"cost\"))",k:"t",why:"Aggregation is still lazy until an action asks for the result."},
      {t:"df.count()",k:"a",why:"A number must be returned, so a job runs."},
      {t:"display(df)",k:"a",why:"Showing rows needs results: an action."},
      {t:"df.write.saveAsTable(\"gold.contract_margin_monthly\")",k:"a",why:"Writing data runs the whole plan."},
      {t:"df.collect()",k:"a",why:"Returns every row to the driver: an action, and often a dangerous one."}]},
  {type:"concept", title:"Jobs, stages and tasks", body:"<p>When you call an action, the driver turns the plan into a <b>job</b>. The job is split into <b>stages</b> wherever data must be <b>shuffled</b> (moved between executors so rows with the same key meet). Each stage runs as many <b>tasks</b> as there are partitions.</p><ul><li><b>Narrow</b> operations (filter, select, withColumn) keep each partition where it is.</li><li><b>Wide</b> operations (groupBy, join without broadcast, window, distinct) need a shuffle, so they start a new stage.</li><li>In the Spark UI, start with the longest stage, then look for skew (one task much slower than the rest) and spill (data written to disk because memory ran out).</li></ul>", diagram:"jst"},
  {type:"order", kind:"build", title:"From action to result", q:"Put the steps in the order Spark performs them after you call an action.",
    items:["You call an action such as write or count","The driver builds and optimises the plan","The plan is split into stages at shuffle boundaries","Each stage runs as tasks, one per partition, on the executors","Results return to the driver or are written to storage"],
    why:"Nothing happens before the action. The driver plans, cuts the plan into stages at shuffles, and executors run one task per partition. Only then does a result exist."},
  {type:"mcq", q:"Which line in the service margin code forces a shuffle?",
    opts:[{t:"cases.groupBy(\"contract_id\").agg(F.sum(\"cost\"))",ok:true,why:"Right. All rows for a contract must meet on one executor to be summed, so the data is repartitioned by contract_id."},
          {t:"cases.filter(F.col(\"status\") == \"CLOSED\")",why:"A filter is narrow: each partition is filtered where it sits."},
          {t:"cases.withColumn(\"status\", F.upper(F.trim(\"status\")))",why:"Row-by-row column changes are narrow."},
          {t:"cases.select(\"case_id\", \"cost\")",why:"Selecting columns never moves rows."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Driver","Runs your code, builds the plan, schedules tasks. Results of collect() land here."],
    ["Executor","A worker process that runs tasks on partitions of data."],
    ["Lazy evaluation","Transformations build a plan; nothing runs until an action."],
    ["Job","The work triggered by one action."],
    ["Stage","A set of tasks with no shuffle inside it. Shuffles separate stages."],
    ["Shuffle","Moving rows between executors so equal keys meet. Needed for groupBy, joins, windows."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Raj's analyst runs the service-margin notebook by hand. It calls <code>display()</code> nine times and <code>count()</code> after almost every step, on top of a sensor join of ~41M readings a day. The notebook takes 50 minutes. A data scientist also copies the joined data to pandas with <code>toPandas()</code> to plot it.</p>",
    qs:[
      {q:"Why is the notebook so slow?",opts:[
        {t:"Each display() and count() is an action that re-runs the plan from the source",ok:true,why:"Right. Nine displays and a dozen counts mean the same reads and joins run again and again. Remove debug actions and write intermediate results once."},
        {t:"Spark is slower than SQL Server",why:"The engine is not the issue. The same work is repeated many times."},
        {t:"The cluster has too few executors",why:"More executors would make repeated work cheaper, not unnecessary."}]},
      {q:"What should the data scientist do instead of toPandas() on the joined data?",opts:[
        {t:"Aggregate in Spark to the grain the plot needs, then convert the small result",ok:true,why:"Right. toPandas() is like collect(): everything goes to the driver. Reduce first, then convert."},
        {t:"Use a bigger driver and keep the same code",why:"Buys time, not a fix. Data grows every day."},
        {t:"Export to CSV and open it in Excel",why:"That is the PII-in-spreadsheets problem Halvorsen is trying to end."}]}]}
  ]},
{ id:"lesson-2", short:"DataFrames & Joins", title:"DataFrame API, Window Functions & Joins", badge:"DF", badgeName:"DataFrame Craftsman",
  goal:"Write readable DataFrame and SQL transformations, use window functions for dedupe and ranking, and choose broadcast or shuffle joins.",
  blocks:[
  {type:"poll", kind:"hook", q:"Raj's SQL developers know <code>ROW_NUMBER() OVER (PARTITION BY ...)</code> well. How different is the same logic in PySpark?",
    opts:["Completely different","Same logic, different syntax","PySpark cannot do it"],
    reveal:"Same logic. SQL and the DataFrame API compile to the same plan on the same engine. That is your best argument with a SQL-first team: their skills carry over."},
  {type:"concept", title:"One engine, two languages", body:"<ul><li><code>spark.sql(\"...\")</code> and the DataFrame API produce the same optimised plan. Pick the one that is clearer for the team and the task.</li><li>Use built-in functions from <code>pyspark.sql.functions</code> (as <code>F</code>) before writing a Python UDF. Built-ins stay inside the engine; Python UDFs move every row to Python and back.</li><li>Readable code: one transformation per line, named intermediate DataFrames, column names in one place, no magic numbers.</li></ul>"},
  {type:"mcq", q:"You need to trim and upper-case a status column on 95K cases a year. What should you use?",
    opts:[{t:"F.upper(F.trim(\"status\"))",ok:true,why:"Right. Built-in functions run inside the engine and the optimiser understands them."},
          {t:"A Python UDF that calls .strip().upper()",why:"It works, but every row is serialised to Python and back, and the optimiser cannot see inside it."},
          {t:"collect() the rows and fix them in a Python loop",why:"That pulls all data to the driver and loses parallelism."},
          {t:"toPandas(), fix, then convert back",why:"Same problem as collect(): everything goes through the driver."}]},
  {type:"concept", title:"Window functions", body:"<p>A window function computes a value for each row from a group of related rows, without collapsing them like <code>groupBy</code> does.</p><ul><li><code>row_number()</code>: unique 1, 2, 3 within the group. Use it to keep the latest version of a record.</li><li><code>rank()</code> / <code>dense_rank()</code>: ties share a number. Use when ties matter.</li><li><code>sum().over(...)</code>: group total on every row, or a running total with a frame.</li><li><code>lag()</code> / <code>lead()</code>: the previous or next row's value.</li></ul>", diagram:"win"},
  {type:"mcq", q:"Salesforce sends case CS-004 twice: once with 12 labour hours, then a correction with 14. How do you keep only the latest version?",
    opts:[{t:"row_number() over partitionBy(case_id).orderBy(last_modified desc), keep row 1",ok:true,why:"Right. One row per case, the most recently modified wins. This is the standard dedupe pattern."},
          {t:"dropDuplicates([\"case_id\"])",why:"It keeps one row per case, but which one is not defined. You might keep the stale 12 hours."},
          {t:"groupBy(case_id).agg(max(labour_hours))",why:"That picks the largest hours, not the latest record. A correction downward would be lost."},
          {t:"distinct()",why:"The two rows differ in hours and timestamp, so both survive."}]},
  {type:"concept", title:"Join strategies: broadcast or shuffle", body:"<ul><li><b>Broadcast hash join</b>: the small side is copied to every executor; the large side stays put. No shuffle. Ideal for dimension and reference tables.</li><li><b>Shuffle (sort-merge) join</b>: both sides are repartitioned by the key. Works at any size but costs network and disk.</li><li><b>Adaptive query execution</b> is on by default in Databricks. At run time it can switch a sort-merge join to a broadcast join when one side turns out small (default threshold 30 MB), coalesce small partitions and split skewed ones.</li><li>Hint with <code>F.broadcast(df)</code> when you know a table is small; never broadcast a large table.</li></ul>", diagram:"joins"},
  {type:"sort", kind:"build", title:"Pick the join", q:"For each Halvorsen join, choose the strategy you expect.",
    buckets:[{k:"b",n:"Broadcast",s:"small side copied"},{k:"s",n:"Shuffle join",s:"both sides large"}],
    items:[
      {t:"Service cases × labour rates (2 rows, one per region)",k:"b",why:"A two-row reference table is the textbook broadcast."},
      {t:"Service cases × contracts (12,000 rows)",k:"b",why:"12,000 contracts is a few MB at most. Broadcast it."},
      {t:"Sensor readings (~41M a day) × plant list (9 rows)",k:"b",why:"Tiny dimension, huge fact. Broadcast avoids moving 41M rows."},
      {t:"Today's sensor readings × yesterday's sensor readings",k:"s",why:"Both sides are tens of millions of rows. Neither fits in executor memory."},
      {t:"Two years of SAP order lines × two years of deliveries",k:"s",why:"Two large fact tables: shuffle by the key."},
      {t:"MES runs for a year × MES stoppages for a year",k:"s",why:"Both large and growing; shuffle join, and watch for skew on busy lines."}]},
  {type:"mcq", q:"The messy notebook joins <code>contracts.join(cost, \"contract_id\")</code>. Contract C-2002 had no cases in October. What happens to it?",
    opts:[{t:"It disappears, because the default join is inner",ok:true,why:"Right. A contract with zero cost should show 100% margin; an inner join silently drops it. Start from contracts and left join the cost, then coalesce nulls to 0."},
          {t:"It shows a margin of 0",why:"It does not appear at all."},
          {t:"It shows null cost but stays in the result",why:"That would be a left join. The default is inner."},
          {t:"Spark raises an error",why:"Spark never errors on unmatched keys. That is why this bug is silent."}]},
  {type:"spot", title:"Spot the mistakes", q:"A pull request contains these claims in its description. Tap every wrong one, then check.",
    items:[
      {t:"Broadcasting the 2-row labour rates table avoids shuffling the cases.",bad:false,ex:"True."},
      {t:"We broadcast the 40 GB sensor history to speed up the join.",bad:true,ex:"Wrong. A broadcast table must fit in every executor's memory. Large tables need a shuffle join."},
      {t:"rank() gives tied rows the same number; row_number() does not.",bad:false,ex:"True."},
      {t:"dropDuplicates(['case_id']) always keeps the latest version.",bad:true,ex:"Wrong. Which row survives is not defined. Use row_number with an explicit order."},
      {t:"A Python UDF is the fastest way to upper-case a column.",bad:true,ex:"Wrong. Built-in functions stay in the engine and are faster."},
      {t:"spark.sql and the DataFrame API run on the same optimiser.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>The service-margin notebook computes October margin per contract. It hard-codes labour rates by contract-ID prefix (<code>C-1</code> = 85, else 95), uses <code>dropDuplicates</code> on case ID, and inner-joins contracts to cost.</p>",
    qs:[
      {q:"What is the best fix for the labour rates?",opts:[
        {t:"A small rates reference table keyed by region, joined with a broadcast",ok:true,why:"Right. Finance can change a rate without a code change, and the join is cheap."},
        {t:"Add more prefixes to the when() chain",why:"Business data stays buried in code, and the next contract numbering change breaks it."},
        {t:"Ask analysts to edit the notebook each quarter",why:"Untracked manual edits are how margin numbers drift."}]},
      {q:"Which change makes the margin table complete?",opts:[
        {t:"Start from contracts and left join the monthly cost, filling missing cost with 0",ok:true,why:"Right. Every one of the 12,000 contracts must appear, including the ones that needed no service."},
        {t:"Keep the inner join and add missing contracts by hand",why:"Manual patches do not survive the next run."},
        {t:"Use a cross join",why:"That pairs every contract with every cost row: wrong and huge."}]}]}
  ]},
{ id:"lesson-3", short:"Modular Code", title:"Modular Code: Functions, Packages & Imports", badge:"MB", badgeName:"Module Builder",
  goal:"Turn notebook code into small, testable functions in a Python package, and import them from notebooks, jobs and pipelines.",
  blocks:[
  {type:"poll", kind:"hook", q:"Halvorsen's margin logic lives in a notebook called <code>service_margin_v3_FINAL (2)</code>. Who can safely change it?",
    opts:["Anyone with edit access","Only the analyst who wrote it","Nobody, really"],
    reveal:"Nobody. With no tests, no review and hidden run order, every change is a guess. Software engineering practice exists so that anyone on the team can change code safely."},
  {type:"concept", title:"Why notebooks rot", body:"<ul><li><b>Hidden state</b>: results depend on which cells ran, in which order.</li><li><b>Global variables</b> reused and overwritten (<code>raw = raw.withColumn(...)</code> twelve times).</li><li><b>Hard-coded values</b>: table names, rates, months.</li><li><b>No tests</b>, so nobody knows what “correct” is.</li></ul><p>Databricks' own guidance: keep functions in files (<code>myfunctions.py</code>) and tests in <code>test_myfunctions.py</code>, outside notebooks, so both notebooks and tests can call them.</p>", diagram:"repo"},
  {type:"mcq", q:"What is the single most useful first step before refactoring the margin notebook?",
    opts:[{t:"Record today's output on a fixed sample as a known answer",ok:true,why:"Right. A pinned result lets you prove the refactor changed structure, not numbers. It becomes your first test."},
          {t:"Rewrite it from scratch in a new style",why:"Without a known answer you cannot show the new code gives the same result."},
          {t:"Convert it all to SQL",why:"Language is not the problem. Structure and tests are."},
          {t:"Add more comments",why:"Comments do not stop wrong numbers."}]},
  {type:"concept", title:"Functions: DataFrame in, DataFrame out", body:"<ul><li>Each function does <b>one</b> thing: <code>standardise_cases</code>, <code>keep_latest</code>, <code>split_valid_invalid</code>, <code>contract_margin_monthly</code>.</li><li>It takes DataFrames and parameters, and returns a DataFrame. No reads, no writes, no <code>display()</code> inside.</li><li>Reading and writing stay at the <b>edges</b>: the notebook, job task or pipeline.</li><li>Values that change (month, catalog, rates) are parameters or reference tables, never literals.</li></ul>", diagram:"edges",
    analogy:"A good function is like a kitchen station: ingredients in, dish out. It does not go shopping or serve the table. That is why you can taste-test it alone."},
  {type:"order", kind:"build", title:"Refactor in order", q:"Put the refactoring steps in a safe order.",
    items:["Pin the current output on a small sample as a known answer","Extract each step into a function: DataFrame in, DataFrame out","Move the functions into modules under src/halvorsen/","Import them in the notebook; keep only reads, writes and parameters there","Write a unit test for each function","Open a pull request with the tests and a README"],
    why:"Pin the answer first, then change structure in small steps, then lock behaviour with tests, then let a reviewer see it all."},
  {type:"concept", title:"Workspace files, Git folders and imports", body:"<ul><li>Python files in the workspace and in <b>Git folders</b> can be imported like any module.</li><li>In Databricks Runtime 11.3 LTS and above, the notebook's folder is added to the Python path; in a Git folder, the <b>repo root</b> is added.</li><li>With a <code>src/</code> layout, add the absolute path of <code>src</code> to <code>sys.path</code>, or build and install the package as a wheel (week 7, with bundles).</li><li>On serverless compute the working directory is not guaranteed: use absolute paths.</li><li>While editing modules, <code>%load_ext autoreload</code> and <code>%autoreload 2</code> pick up changes without restarting.</li></ul>"},
  {type:"mcq", q:"A notebook in <code>notebooks/</code> inside your Git folder fails with <code>ModuleNotFoundError: No module named 'halvorsen'</code>. The package is in <code>src/halvorsen/</code>. What fixes it?",
    opts:[{t:"Append the absolute path of the repo's src folder to sys.path before importing",ok:true,why:"Right. Only the repo root is on the path, not src. Add src (absolute path), or install the package."},
          {t:"Copy the module files into the notebooks folder",why:"Two copies drift apart. That is the problem you are fixing."},
          {t:"Rename the folder to halvorsen_src",why:"The name is not the issue; the path is."},
          {t:"Use %run on each module file",why:"%run executes a notebook inline; it is not how you import a Python package."}]},
  {type:"sort", kind:"build", title:"Entry point or module?", q:"Where does each piece of the margin code belong?",
    buckets:[{k:"e",n:"Entry point",s:"notebook, job task, pipeline"},{k:"m",n:"Module",s:"src/halvorsen, tested"}],
    items:[
      {t:"spark.table(f\"{catalog}.bronze.sf_cases_raw\")",k:"e",why:"Reading tables is I/O. Keep it at the edge so functions can be tested with fake data."},
      {t:"Writing gold.contract_margin_monthly",k:"e",why:"Writes belong to the job or pipeline."},
      {t:"Reading the catalog name from a job parameter",k:"e",why:"Environment configuration is the entry point's job."},
      {t:"Trim and upper-case the status column",k:"m",why:"A business rule: put it in a function and test it."},
      {t:"Keep the latest version of each case",k:"m",why:"Pure DataFrame logic, ideal for a unit test."},
      {t:"Margin = revenue minus cost, as a percentage",k:"m",why:"The business definition must live once, tested, in the module."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Pure function","Same input, same output; no reads, writes or display inside."],
    ["Entry point","The notebook, job task or pipeline that reads, calls functions and writes."],
    ["src/halvorsen/","The team's Python package of tested transformation functions."],
    ["Git folder","A Databricks folder linked to a Git repo: clone, branch, commit, push, pull."],
    ["sys.path","Where Python looks for modules. The Git folder root is added automatically."],
    ["Autoreload","%autoreload 2 picks up edited modules without restarting the session."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Raj's team is 6 SQL/SSIS developers, 3 Power BI analysts and 2 data scientists, with little Python. They will own this code after the consultants leave. Some of their transformations will stay in SQL.</p>",
    qs:[
      {q:"Where should SQL-first transformations live?",opts:[
        {t:"In .sql files in the same repo, under the same review, naming and test rules",ok:true,why:"Right. Standards are about version control, review and tests, not about Python. SQL logic can be tested too, for example with SQL UDFs or known-answer checks."},
        {t:"In saved queries in each developer's workspace",why:"Untracked, unreviewed and invisible to others: the notebook problem again."},
        {t:"Rewritten in Python before go-live",why:"Forces a skill the team does not have, for no business gain."}]},
      {q:"What makes the package something Raj's team can run on their own?",opts:[
        {t:"Small named functions, a README, tests that explain the rules, and standards in docs/standards",ok:true,why:"Right. The tests double as documentation of the business rules."},
        {t:"Clever one-line chains that do everything at once",why:"Hard to read, hard to test, hard to hand over."},
        {t:"A long comment at the top of the notebook",why:"Comments drift from the code. Tests do not."}]}]}
  ]},
{ id:"lesson-4", short:"Testing & Git", title:"Testing & the Git Workflow", badge:"TG", badgeName:"Test Guardian",
  goal:"Write PySpark unit tests with pytest, place integration tests against pipelines and jobs, and ship changes through branches and pull requests.",
  blocks:[
  {type:"poll", kind:"hook", q:"A change to the margin formula ships on Friday with no tests. Who finds the bug?",
    opts:["The CI pipeline","The code reviewer","The CFO, on Monday"],
    reveal:"Without tests and review, the person who finds it is the one who trusts the number most. Tests and pull requests move that moment back to before the merge."},
  {type:"concept", title:"The test pyramid", body:"<ul><li><b>Unit tests</b> (many): one function, a tiny DataFrame built in the test, a local SparkSession, seconds to run.</li><li><b>Integration tests</b> (some): deploy to a dev target, run the real pipeline or job on a seed dataset, then check table-level facts.</li><li><b>End-to-end and reconciliation</b> (few): before release, compare with the old warehouse or a known business figure.</li></ul><p>Pipeline <b>expectations</b> are different again: they check production data quality on every run. They do not prove the code is right.</p>", diagram:"pyramid"},
  {type:"sort", kind:"build", title:"Which kind of check?", q:"Sort each check into the right category.",
    buckets:[{k:"u",n:"Unit test",s:"one function, fake data"},{k:"i",n:"Integration test",s:"real pipeline/job, dev"},{k:"q",n:"Data quality in production",s:"expectations, monitoring"}],
    items:[
      {t:"keep_latest returns 14 hours for CS-004, not 12",k:"u",why:"One function, a few rows built in the test."},
      {t:"Contracts with no cases get margin 100%",k:"u",why:"A business rule of one function on tiny data."},
      {t:"After the dev job runs on seed data, every contract has a margin row",k:"i",why:"Checks the real job writing real tables in dev."},
      {t:"Gold cost reconciles with silver case cost after a full pipeline run",k:"i",why:"Crosses tables and the pipeline, not one function."},
      {t:"Drop rows where labour_hours is negative and count them every night",k:"q",why:"An expectation on live data: monitors inputs, not code."},
      {t:"Alert if tonight's case volume is 50% below the weekly average",k:"q",why:"Production monitoring of the data itself."}]},
  {type:"concept", title:"Writing a PySpark unit test", body:"<ul><li>Put a <b>session-scoped</b> SparkSession fixture in <code>tests/conftest.py</code>. Starting Spark is slow; start it once.</li><li>Build the input with <code>spark.createDataFrame([...], columns)</code>: 2 to 10 rows that show the rule.</li><li>Call the function, collect the small result, assert on exact values. <code>pyspark.testing.assertDataFrameEqual</code> compares whole DataFrames.</li><li>Name the test after the behaviour: <code>test_contract_with_no_cases_still_appears</code>.</li><li>Every bug gets a <b>regression test</b> that fails before the fix.</li><li>In Databricks, run tests from a notebook with <code>pytest.main([...])</code> and fail the cell if the return code is not 0.</li></ul>"},
  {type:"mcq", q:"Why is the SparkSession fixture scoped to the whole test session rather than to each test?",
    opts:[{t:"Starting Spark takes seconds; doing it once keeps the suite fast",ok:true,why:"Right. Eight tests that each start Spark would take minutes instead of seconds."},
          {t:"Each test must share the same DataFrames",why:"Tests should build their own data so they stay independent."},
          {t:"pytest cannot create more than one SparkSession",why:"It can, but it is slow and wasteful."},
          {t:"So tests run in production",why:"Unit tests never touch production."}]},
  {type:"concept", title:"Integration tests with pipelines and jobs", body:"<ul><li>Keep catalog and schema names as <b>parameters</b>, so the same pipeline runs in dev, staging and prod.</li><li>Deploy to a dev target from your branch (Declarative Automation Bundles, formerly Databricks Asset Bundles, in week 7), run the Lakeflow Spark Declarative Pipeline or Lakeflow Job on a <b>fixed seed dataset</b>.</li><li>A test task then asserts table facts: row counts, no orphan keys, reconciliation between layers, a known answer.</li><li>Expectations and the pipeline event log tell you how data quality looked during the run.</li></ul>"},
  {type:"mcq", q:"A pipeline already has expectations that drop rows with negative labour hours. Does it still need unit tests for the margin function?",
    opts:[{t:"Yes. Expectations check incoming data; unit tests check that the logic is right",ok:true,why:"Right. A wrong formula on perfect data passes every expectation and still reports a false margin."},
          {t:"No. Expectations catch all bad results",why:"Expectations validate rows against rules. They do not know what margin should be."},
          {t:"No. Integration tests are enough",why:"Integration tests are slower and fewer; they will not cover every rule."},
          {t:"Only if the pipeline is in SQL",why:"Language does not change the need."}]},
  {type:"concept", title:"The Git workflow", body:"<ul><li>Each developer clones the repo into their own <b>Git folder</b> and works on a <b>feature branch</b> from main.</li><li>Commit small changes with clear messages; push to the Git provider.</li><li>Open a <b>pull request</b>: what changed, why, how it was tested. CI runs the tests.</li><li>Another pair reviews; comments are resolved; then merge.</li><li>Production code is updated only by automation after merge: a production Git folder or a bundle deployment.</li></ul>", diagram:"gitflow"},
  {type:"order", kind:"build", title:"Ship a change", q:"Order the steps for shipping the margin fix.",
    items:["Create a branch from main in your Git folder","Write a failing regression test, then fix the code","Commit and push the branch","Open a pull request with description and test results","CI runs the tests and a reviewer approves","Merge to main; automation deploys it"],
    why:"Branch first, prove the bug with a test, push, let CI and a reviewer check, then merge. People do not deploy by hand."},
  {type:"spot", title:"Spot the mistakes", q:"A teammate's notes on testing. Tap every wrong claim, then check.",
    items:[
      {t:"Unit tests should read from the production gold table so the data is realistic.",bad:true,ex:"Wrong. Unit tests build small fake DataFrames. Production data is slow, changes and may contain PII."},
      {t:"Each bug fix should come with a test that failed before the fix.",bad:false,ex:"True. That is a regression test."},
      {t:"Expectations in the pipeline make unit tests unnecessary.",bad:true,ex:"Wrong. Expectations check data, not logic."},
      {t:"Catalog names should be parameters so one pipeline runs in dev and prod.",bad:false,ex:"True."},
      {t:"Developers should share one Git folder on main to avoid merge conflicts.",bad:true,ex:"Wrong. Each developer works in their own Git folder on their own branch."},
      {t:"CI should run the tests on every pull request.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Last Friday a change to the margin calculation went straight to the shared notebook. Monday, the CFO's dashboard showed service margin up 9 points. It was not real. Priya Raman wants to know how this cannot happen again.</p>",
    qs:[
      {q:"What is the first thing to add to the code?",opts:[
        {t:"A regression test that reproduces the wrong number, then the fix",ok:true,why:"Right. The test proves you understood the bug and stops it coming back."},
        {t:"A comment warning people not to touch the code",why:"Comments do not stop anyone."},
        {t:"A manual check of the dashboard every Monday",why:"Too late and depends on someone remembering."}]},
      {q:"Which process change answers Priya's question best?",opts:[
        {t:"Protect main: changes only via pull request, CI tests must pass, one reviewer, automated deploy",ok:true,why:"Right. It turns “please be careful” into a control the CFO can audit."},
        {t:"Only senior engineers may edit the notebook",why:"Seniors make mistakes too; without tests nobody would notice."},
        {t:"Freeze all changes to finance code",why:"Halvorsen still needs margin for 12,000 contracts. Control change, do not stop it."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T04. 90 seconds. Score 6 or more to earn the T04 Data Engineer badge.",
    qs:[
      {q:"What does df.filter(...) do when called?",o:["Runs a job","Adds a step to the plan","Writes a table"],a:1},
      {q:"Where does collect() put the result?",o:["The driver","The executors","A Delta table"],a:0},
      {q:"What starts a new stage?",o:["A filter","A shuffle","A select"],a:1},
      {q:"Keep the latest version of each case?",o:["dropDuplicates","row_number over case_id, latest first","distinct"],a:1},
      {q:"Join 41M sensor rows to 9 plants?",o:["Broadcast the plants","Shuffle both sides","Cross join"],a:0},
      {q:"Where do reads and writes belong?",o:["Inside every function","At the entry point","In the tests"],a:1},
      {q:"Which test runs a real job on seed data in dev?",o:["Unit test","Integration test","Expectation"],a:1},
      {q:"How does a fix reach main?",o:["Push to main directly","Pull request with passing CI and a review","Edit the production folder"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T04",n:"T04 Data Engineer"};

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
  box.appendChild(el("h2",null,"Can you engineer it in 90 seconds?"));
  box.appendChild(el("p",null,b.q));
  const stage=el("div","opts"); const start=el("button","btn",S.badges[FINAL_BADGE.k]?"Play again":"Start the round");
  const row=el("div","btnrow"); row.append(start); box.append(row,stage);
  let timer, left, qi, score, order;
  function end(){clearInterval(timer); stage.innerHTML="";
    const pass=score>=6;
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: ${FINAL_BADGE.n}.":"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">T04 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
