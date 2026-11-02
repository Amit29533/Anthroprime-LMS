
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  arch:`<div class="stack"><div class="row"><div><b>Driver</b>Plans the query, splits it into stages and tasks, tracks progress</div><div><b>Executor 1</b>Runs tasks on its cores, holds memory, spills to disk</div><div><b>Executor 2</b>One task = one partition on one core</div><div><b>Executor N</b>Exchanges data with the others in a shuffle</div></div><div class="band uc">JOB (one action) → STAGES (split at every shuffle) → TASKS (one per partition)</div><div class="band st">DATA: Delta tables in cloud storage, read file by file</div></div>`,
  uiflow:`<div class="flow"><span><b>Step 1</b>Jobs timeline: failures, gaps, many small jobs?</span><i>→</i><span><b>Step 2</b>Open the longest stage</span><i>→</i><span><b>Step 3</b>Skew or spill?</span><i>→</i><span><b>Step 4</b>Is the stage I/O bound?</span><i>→</i><span><b>Step 5</b>Other causes of a slow stage</span></div><div class="xbands"><div style="background:var(--sunk)">CLASSIC COMPUTE: SPARK UI (JOBS · STAGES · SQL/DATAFRAME · EXECUTORS)</div><div style="background:var(--teal);color:#fff">SERVERLESS AND SQL WAREHOUSES: QUERY PROFILE (NO SPARK UI)</div></div>`,
  deltalog:`<div class="silo"><div><b>_delta_log/</b><ul><li>One JSON commit per table version: 00000000000000000000.json, …01.json</li><li>Each commit adds or removes data files</li><li>Each add carries file statistics: row count, min, max, null count per column</li><li>Parquet checkpoints summarise the log so readers do not replay every commit</li></ul></div><div><b>Data files (Parquet)</b><ul><li>The actual rows</li><li>Never edited in place; rewrites create new files</li><li>Old files stay until VACUUM removes them</li><li>A reader uses the log to decide which files to open</li></ul></div></div>`,
  layout:`<div class="ladder"><div><b>PARTITIONING</b>One folder per value. Good only for a few large partitions. Key fixed at create time.</div><div><b>Z-ORDER</b>OPTIMIZE ZORDER BY co-locates values in files. Legacy option on partitioned or unclustered tables.</div><div><b>LIQUID CLUSTERING</b>CLUSTER BY up to 4 keys. Replaces both. Keys can change without a rewrite.</div><div><b>CLUSTER BY AUTO</b>Predictive optimization picks and changes keys from query patterns.</div></div>`,
  four:`<div class="ladder"><div><b>SKEW</b>A few keys hold most rows. One task runs far longer than the rest.</div><div><b>SHUFFLE</b>Rows move between executors for joins and aggregations. Disk, network, serialization.</div><div><b>SPILL</b>A partition does not fit in memory and is written to disk and read back.</div><div><b>SERIALIZATION</b>Rows converted to cross a boundary: JVM to Python, driver to executors.</div></div>`,
  udf:`<div class="ladder"><div><b>1 · BUILT-IN / SQL UDF</b>Optimised, runs in the engine. Photon can run built-ins.</div><div><b>2 · SCALA UDF</b>Runs in the JVM. No Python hop.</div><div><b>3 · PANDAS UDF</b>Arrow batches to Python. Up to 100× faster than row-at-a-time Python UDFs.</div><div><b>4 · PYTHON UDF</b>Rows serialized one by one to a Python worker. Slowest.</div></div>`,
  method:`<div class="flow"><span><b>1 · Baseline</b>Reproduce, record time and data volume</span><i>→</i><span><b>2 · Evidence</b>Spark UI or query profile</span><i>→</i><span><b>3 · Locate</b>Longest stage or operator</span><i>→</i><span><b>4 · Name it</b>Skew, spill, shuffle, small files, UDF, I/O</span><i>→</i><span><b>5 · One fix</b>Change one thing</span><i>→</i><span><b>6 · Verify</b>Same result, new time, write it down</span></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Spark & the Spark UI", title:"Spark Architecture & Reading the Evidence", badge:"SU", badgeName:"Spark UI Reader",
  goal:"Explain how Spark turns a query into jobs, stages and tasks, and read the Spark UI or query profile as evidence before you change anything.",
  blocks:[
  {type:"poll", kind:"hook", q:"A nightly query that took 4 minutes now takes 70. What do you do first?",
    opts:["Double the number of workers","Open the Spark UI or query profile and find the longest stage","Rewrite the query from scratch"],
    reveal:"Evidence first. Bigger clusters often do nothing for a slow query, because the slow part may be one task on one core. This week you learn to find that part and prove it."},
  {type:"concept", title:"Driver, executors, tasks", body:"<p>A Spark cluster has one <b>driver</b> and several <b>executors</b>. The driver plans the work. Executors do it, in parallel, on their cores.</p><ul><li>Data is split into <b>partitions</b>. One <b>task</b> processes one partition on one core.</li><li>An <b>action</b> (write, count, display) starts a <b>job</b>.</li><li>A job is split into <b>stages</b>. A new stage starts wherever data must be re-grouped across executors: a <b>shuffle</b>.</li></ul>", diagram:"arch",
    analogy:"A head chef (driver) reads the order and hands out tickets. Each cook (core) works one ticket (task) at a time. When dishes must be regrouped by table, everything stops at the pass (shuffle)."},
  {type:"mcq", q:"A stage shows 200 tasks. The cluster has 32 cores in total. What is true?",
    opts:[{t:"Up to 32 tasks run at once; each task processes one partition",ok:true,why:"Right. Tasks run in waves of up to 32. More cores help only if there are tasks waiting."},
          {t:"Each core processes all 200 partitions",why:"No. A partition is processed by exactly one task."},
          {t:"200 executors are started for the stage",why:"Tasks are not executors. Executors are long-lived and run many tasks."},
          {t:"The driver processes the partitions the executors cannot",why:"The driver plans and coordinates. It does not process partitions for a normal query."}]},
  {type:"concept", title:"Narrow and wide: where stages split", body:"<p>Spark is <b>lazy</b>: transformations build a plan; nothing runs until an action.</p><ul><li><b>Narrow</b> transformations work row by row inside a partition: filter, select, withColumn. They stay in the same stage.</li><li><b>Wide</b> transformations need rows with the same key together: groupBy, join (unless one side is broadcast), distinct, orderBy, repartition. They cause a <b>shuffle</b>, shown as an <code>Exchange</code> in the plan, and a new stage.</li></ul><p>Most slow queries are slow in a wide step.</p>"},
  {type:"sort", kind:"build", title:"Narrow or wide?", q:"Sort each transformation. On a phone, tap an item, then tap a box.",
    buckets:[{k:"n",n:"Narrow",s:"no shuffle"},{k:"w",n:"Wide",s:"causes a shuffle"}],
    items:[
      {t:"filter(plant_code = 'A2')",k:"n",why:"A filter keeps or drops rows where they are. No data moves."},
      {t:"withColumn('value_c', (value - 32) * 5 / 9)",k:"n",why:"Computed row by row in place."},
      {t:"select('sensor_id', 'value')",k:"n",why:"Column pruning. No data moves."},
      {t:"groupBy('plant_code').agg(avg('value'))",k:"w",why:"Rows with the same plant must meet in one partition."},
      {t:"join two large tables on sensor_id",k:"w",why:"A sort-merge join shuffles both sides by the key."},
      {t:"repartition(200)",k:"w",why:"Repartition redistributes every row: a full shuffle."},
      {t:"orderBy('reading_ts')",k:"w",why:"A global sort needs a range shuffle."}]},
  {type:"concept", title:"Where the evidence lives", body:"<p>On <b>classic compute</b> (all-purpose or jobs clusters) open the <b>Spark UI</b>: Jobs, Stages, SQL/DataFrame and Executors tabs. On <b>serverless</b> compute and <b>SQL warehouses</b> the Spark UI is not available; use the <b>query profile</b> (Query History, or “See performance” under a notebook cell). It shows each operator with time spent, rows, memory peak and data read, plus a Top operators list.</p><p>The Databricks Spark UI guide gives a five-step order. Follow it every time.</p>", diagram:"uiflow"},
  {type:"order", kind:"build", title:"Follow the guide", q:"Put the Spark UI diagnosis steps in the order the Databricks guide uses.",
    items:["Check the jobs timeline for failures, gaps and many small jobs","Open the longest stage","Look for skew or spill in that stage","Check whether the stage is I/O bound","Look for other causes of a slow stage"],
    why:"Start wide (the whole timeline), then narrow to the stage that costs the most time, then test the common causes in order."},
  {type:"mcq", q:"A stage's Summary Metrics show task duration: Min 2 s, 25th percentile 3 s, Median 3 s, 75th percentile 4 s, Max 38 min. What does it suggest?",
    opts:[{t:"Data skew: one partition is far larger than the others",ok:true,why:"Right. The guide flags possible skew when Max exceeds the 75th percentile by 50% or more. Here it is hundreds of times larger."},
          {t:"The cluster is too small",why:"Most tasks finish in seconds. More cores would not speed up the one long task."},
          {t:"Small files",why:"Small files show as many short tasks and high scheduling overhead, not one giant task."},
          {t:"The driver is overloaded",why:"Driver problems show as gaps between jobs, not one long task inside a stage."}]},
  {type:"mcq", q:"Raj's team runs the gold query on a serverless job. Where do they look for operator-level evidence?",
    opts:[{t:"The query profile for that run",ok:true,why:"Right. Serverless compute has no Spark UI. The query profile shows operators, time, rows and memory."},
          {t:"The Spark UI on the serverless compute page",why:"The Spark UI is not available on serverless compute."},
          {t:"DESCRIBE HISTORY on the gold table",why:"History shows table versions and operations, not where query time went."},
          {t:"The billing usage system table",why:"Billing shows cost per job, not which operator was slow."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Driver","Plans the query, splits it into stages and tasks, and coordinates executors."],
    ["Task","Processes one partition on one core."],
    ["Stage","A set of tasks with no shuffle inside. Stages split at shuffles."],
    ["Shuffle","Re-grouping rows across executors by key. Shown as Exchange."],
    ["Skew signal","Max task duration far above the 75th percentile (50%+ per the guide)."],
    ["Query profile","Operator-level evidence on SQL warehouses and serverless, where there is no Spark UI."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p><b>The 07:00 OEE deadline was missed twice this week.</b> The gold OEE job took about 4 minutes until plants A4 and A5 were onboarded. Now it takes about 70. It runs on a classic jobs cluster. Shift handover is at 07:30.</p>",
    qs:[
      {q:"Raj proposes doubling the cluster tonight. What do you say first?",opts:[
        {t:"Let's open last night's Spark UI and find the longest stage before we spend money",ok:true,why:"Right. If one task is the bottleneck, doubling the cluster adds cost and changes nothing."},
        {t:"Agreed, bigger is always faster",why:"Not when the time is spent in one task on one core."},
        {t:"Move the job to 05:00 and hope it finishes",why:"It hides the problem and it will grow with every new plant."}]},
      {q:"In the longest stage, 199 tasks finish in about 20 s and one runs for 52 minutes. What is your working diagnosis?",opts:[
        {t:"Skew on the join or grouping key, probably data from the new plants",ok:true,why:"Right. One huge partition means one key holds a large share of rows. The new plants are the obvious suspect to check."},
        {t:"Not enough shuffle partitions",why:"More partitions do not split a single hot key; all its rows still go to one partition."},
        {t:"A network outage",why:"Then many tasks would be slow, not exactly one."}]},
      {q:"Which evidence do you attach to the incident note for Raj?",opts:[
        {t:"Stage summary metrics (Max vs 75th percentile), spill and shuffle sizes for that stage, and the row count per key",ok:true,why:"Right. Numbers from the run plus the data profile prove the cause."},
        {t:"A screenshot of the cluster configuration",why:"Configuration does not show where time went."},
        {t:"The job's final status: Succeeded",why:"It succeeded slowly. Status is not evidence of the cause."}]}]}
  ]},
{ id:"lesson-2", short:"Delta Internals & Layout", title:"Delta Internals, Data Skipping & Table Layout", badge:"DL", badgeName:"Layout Engineer",
  goal:"Explain how the Delta transaction log and file statistics let queries skip files, fix small-file problems, and choose between partitioning, Z-order and liquid clustering.",
  blocks:[
  {type:"poll", kind:"hook", q:"A sensor table has 180,000 files of about 40 KB each. A query asks for one plant on one day. How many files does Spark open?",
    opts:["Only the files for that plant and day","It depends on the file statistics and how rows are laid out","All 180,000"],
    reveal:"The honest answer is the middle one. Delta can skip files whose min/max range excludes your filter. If every file holds every plant and day, nothing can be skipped, and you pay the overhead of 180,000 tiny files."},
  {type:"concept", title:"The transaction log is the table", body:"<p>A Delta table is Parquet data files plus a <b>transaction log</b> in <code>_delta_log/</code>. Each commit is a numbered JSON file that adds or removes files. Readers build the current snapshot from the log, helped by Parquet checkpoints.</p><p>Each <b>add</b> action records <b>file statistics</b>: row count, and min, max and null count per column. That is what makes skipping possible without opening files.</p>", diagram:"deltalog"},
  {type:"mcq", q:"Where does Databricks get the min and max values it uses to skip files?",
    opts:[{t:"From statistics stored with each file's entry in the transaction log",ok:true,why:"Right. Statistics are collected on write and stored in the log, so the planner can rule files out before reading them."},
          {t:"By opening every Parquet footer at query time",why:"That would cost as much as reading the files. The log already holds the statistics."},
          {t:"From Unity Catalog lineage",why:"Lineage records dependencies, not column values."},
          {t:"From the partition folder names only",why:"Partition values are one source, but file-level min/max statistics work on any column with stats."}]},
  {type:"concept", title:"Data skipping needs a good layout", body:"<ul><li>Statistics are collected automatically on write. For Unity Catalog external tables they cover the <b>first 32 columns</b> by default. For managed tables, predictive optimization can also collect stats on frequently filtered columns.</li><li>Change the columns with <code>delta.dataSkippingStatsColumns</code>; recompute with <code>ANALYZE TABLE … COMPUTE DELTA STATISTICS</code>.</li><li>Stats only help when each file covers a <b>narrow range</b>. If every file holds plants A1 to B4, a filter on A2 skips nothing. Layout (clustering) narrows the ranges.</li></ul>"},
  {type:"mcq", q:"An external table filters on serial_number, the 41st column. The query profile shows almost no files pruned. What is the likely cause?",
    opts:[{t:"No statistics on that column: only the first 32 are collected by default",ok:true,why:"Right. Add it to delta.dataSkippingStatsColumns and recompute statistics, then cluster on it if it is a common filter."},
          {t:"Delta cannot skip files on string columns",why:"Min/max statistics work on strings."},
          {t:"The table needs VACUUM",why:"VACUUM removes unreferenced old files. It does not create statistics."},
          {t:"Data skipping only works on partition columns",why:"File-level statistics work on any column that has them."}]},
  {type:"concept", title:"The small-file problem", body:"<p>Every file costs a listing, an open, metadata and often a task. Thousands of tiny files make queries slow even when the data is small.</p><ul><li><b>Causes</b>: frequent streaming micro-batches, many tiny appends, over-partitioning, <code>repartition(2000)</code> before a write.</li><li><b>Find it</b>: <code>DESCRIBE DETAIL</code> gives numFiles and sizeInBytes, so you can work out the average file size.</li><li><b>Fix it</b>: <code>OPTIMIZE</code> compacts files. Optimized writes and auto compaction reduce new small files. <b>Predictive optimization</b> runs OPTIMIZE, VACUUM and ANALYZE for Unity Catalog managed tables, which also tune file size automatically.</li></ul>"},
  {type:"mcq", q:"DESCRIBE DETAIL on silver.sensor_reading_1min shows numFiles = 184,000 and sizeInBytes ≈ 7.4 GB. What is the first fix?",
    opts:[{t:"Run OPTIMIZE to compact the files, then make sure predictive optimization or scheduled OPTIMIZE keeps it that way",ok:true,why:"Right. The average file is about 40 KB. Compaction comes first; then stop the problem coming back."},
          {t:"Partition the table by sensor_id",why:"2,400 sensors × days would create even more, even smaller files."},
          {t:"Run VACUUM",why:"VACUUM deletes old unreferenced files. It does not merge the current small ones."},
          {t:"Add more workers",why:"More cores do not remove per-file overhead."}]},
  {type:"concept", title:"Partitioning, Z-order or liquid clustering", body:"<p>Databricks documents <b>liquid clustering</b> as the replacement for partitioning and <code>ZORDER</code>, and recommends it for all new tables.</p><ul><li><code>CLUSTER BY (col1, col2)</code>, up to four keys. Not compatible with partitioning or ZORDER on the same table.</li><li>Keys can be changed with <code>ALTER TABLE … CLUSTER BY</code> without rewriting existing data.</li><li><code>OPTIMIZE</code> clusters incrementally; <code>OPTIMIZE FULL</code> reclusters all data (Runtime 16.0+).</li><li><code>CLUSTER BY AUTO</code> lets predictive optimization choose keys from your query patterns.</li></ul>", diagram:"layout",
    analogy:"Partitioning is building a fixed shelf per letter. Liquid clustering is a librarian who keeps similar books together and can re-shelve by a new rule without emptying the library."},
  {type:"sort", kind:"build", title:"Which layout?", q:"Match each statement to the layout it describes.",
    buckets:[{k:"p",n:"Partitioning",s:"folders per value"},{k:"z",n:"Z-order",s:"OPTIMIZE ZORDER BY"},{k:"l",n:"Liquid clustering",s:"CLUSTER BY"}],
    items:[
      {t:"Creates one directory per distinct value of the key",k:"p",why:"Partitioning is physical folders per value."},
      {t:"A high-cardinality key produces thousands of tiny partitions",k:"p",why:"The classic over-partitioning failure."},
      {t:"The key is fixed; changing it means rewriting the table",k:"p",why:"Partition columns are part of the physical layout."},
      {t:"Applied as part of an OPTIMIZE command on a table without clustering",k:"z",why:"OPTIMIZE … ZORDER BY (cols) co-locates values in files."},
      {t:"Cannot be combined with liquid clustering",k:"z",why:"The docs state ZORDER cannot be used with liquid clustering."},
      {t:"Up to four keys, changeable without rewriting existing data",k:"l",why:"That flexibility is liquid clustering's main advantage."},
      {t:"Recommended by Databricks for all new tables",k:"l",why:"The clustering docs say exactly that."}]},
  {type:"spot", title:"Spot the mistakes", q:"Tap every statement that is wrong, then check.",
    items:[
      {t:"Each commit in _delta_log adds or removes data files.",bad:false,ex:"True. The log is a list of file-level actions."},
      {t:"VACUUM compacts small files into larger ones.",bad:true,ex:"Wrong. OPTIMIZE compacts. VACUUM deletes unreferenced old files."},
      {t:"After ALTER TABLE … CLUSTER BY, existing data is reclustered immediately.",bad:true,ex:"Wrong. New keys apply to later OPTIMIZE and writes; OPTIMIZE FULL reclusters existing data."},
      {t:"Predictive optimization runs OPTIMIZE, VACUUM and ANALYZE on Unity Catalog managed tables.",bad:false,ex:"True."},
      {t:"You can use ZORDER and liquid clustering on the same table.",bad:true,ex:"Wrong. They are not compatible."},
      {t:"File statistics include min, max and null counts per column.",bad:false,ex:"True, plus a row count per file."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Silver <code>sensor_reading_1min</code> is appended every minute by a streaming pipeline. Nobody has run OPTIMIZE since go-live. Analysts filter by plant and time; maintenance engineers sometimes filter by one sensor. A colleague wants to partition by <code>sensor_id</code> “to make sensor lookups fast”.</p>",
    qs:[
      {q:"What is wrong with partitioning by sensor_id?",opts:[
        {t:"About 2,400 sensors would create thousands of small partitions, making the small-file problem worse",ok:true,why:"Right. High-cardinality partition keys are the classic over-partitioning mistake."},
        {t:"Nothing; partitioning is always fastest",why:"Not for high-cardinality keys or small partitions."},
        {t:"Delta does not allow string partition keys",why:"It does. The issue is cardinality and file size."}]},
      {q:"Which layout do you propose?",opts:[
        {t:"Liquid clustering on plant_code and reading time, with sensor_id as an optional third key if lookups matter, and OPTIMIZE kept running",ok:true,why:"Right. It serves the common filters, can change later without a rewrite, and stays compact."},
        {t:"Partition by plant_code and Z-order by sensor_id",why:"Workable on older tables, but Databricks recommends liquid clustering for new tables and it is more flexible."},
        {t:"No layout; rely on more compute",why:"Without layout, statistics cannot skip files."}]},
      {q:"How do you prove the change helped?",opts:[
        {t:"Compare numFiles from DESCRIBE DETAIL and files read or pruned in the query profile, before and after, on the same query",ok:true,why:"Right. Same query, same data, measured both ways."},
        {t:"Ask analysts whether it feels faster",why:"Opinions are not evidence for an ADR."},
        {t:"Check that OPTIMIZE appears in DESCRIBE HISTORY",why:"That proves it ran, not that it helped."}]}]}
  ]},
{ id:"lesson-3", short:"Skew, Shuffle, Spill", title:"Skew, Shuffle, Spill & Serialization", badge:"SS", badgeName:"Shuffle Surgeon",
  goal:"Recognise skew, shuffle, spill and serialization from their evidence, and choose the right fix: AQE, broadcast, salting, better partitions or less data.",
  blocks:[
  {type:"poll", kind:"hook", q:"199 tasks finish in 20 seconds. One task runs for 50 minutes. You add 10 more workers. What happens?",
    opts:["It gets about 10 times faster","Almost nothing changes","It fails"],
    reveal:"Almost nothing changes. The long task processes one huge partition on one core. Extra workers sit idle while it finishes. You must split the partition, not add cores."},
  {type:"concept", title:"Four causes, four signatures", body:"<p>Most slow Spark stages come down to four mechanical causes. Each leaves a different trace in the Spark UI or query profile.</p>", diagram:"four"},
  {type:"sort", kind:"build", title:"Read the symptom", q:"Match each piece of evidence to its most likely cause.",
    buckets:[{k:"k",n:"Skew"},{k:"h",n:"Shuffle"},{k:"p",n:"Spill"},{k:"z",n:"Serialization"}],
    items:[
      {t:"Max task 40 min, 75th percentile 30 s",k:"k",why:"One partition far bigger than the rest."},
      {t:"Plan shows SortMergeJoin with isSkew = true",k:"k",why:"AQE detected and split a skewed partition."},
      {t:"An Exchange writes hundreds of GB of shuffle data",k:"h",why:"Large shuffle write and read sizes."},
      {t:"Join of two big tables on a key neither is clustered by",k:"h",why:"Both sides must be shuffled by the key."},
      {t:"Stage details show Spill (Disk) in the tens of GB",k:"p",why:"Spill statistics appear at the top of the stage page when a stage spills."},
      {t:"A Python UDF node (BatchEvalPython) in the plan",k:"z",why:"Rows are serialized out of the JVM to a Python worker."},
      {t:"collect() pulls 50 million rows to the driver",k:"z",why:"All rows are serialized and sent to one machine."}]},
  {type:"concept", title:"Shuffles: cut them or shrink them", body:"<ul><li>A shuffle writes data to disk, sends it over the network and reads it back. It is often the most expensive step.</li><li><b>Broadcast</b> a small table to every executor and the big side is not shuffled at all. AQE switches to a broadcast join at runtime when a side is small enough.</li><li><b>Fewer rows and columns</b> before the shuffle: filter early, select only what you need.</li><li><b>Right number of partitions</b>: the default <code>spark.sql.shuffle.partitions</code> is 200; <code>auto</code> lets Databricks choose. AQE also coalesces small shuffle partitions.</li></ul>"},
  {type:"mcq", q:"The gold query joins 41M sensor readings a day to a 2,401-row sensor dimension with a sort-merge join. What removes the shuffle of the big side?",
    opts:[{t:"Broadcast the sensor dimension",ok:true,why:"Right. Every executor gets the small table, so the big side is joined where it sits."},
          {t:"Increase spark.sql.shuffle.partitions to 2,000",why:"That changes how the shuffle is split; it still happens."},
          {t:"Repartition the readings by sensor_id first",why:"That is itself a shuffle."},
          {t:"Cache the readings table",why:"Caching avoids re-reading; it does not remove the shuffle."}]},
  {type:"concept", title:"Skew and how to split it", body:"<ul><li><b>AQE skew join</b> splits a skewed partition into smaller tasks in sort-merge and shuffle-hash joins. A partition counts as skewed only if it is more than <b>5×</b> the median <b>and</b> larger than <b>256 MB</b> (defaults). Below that, adjust the thresholds.</li><li><b>Broadcast joins are never skew-optimised</b>, but they do not need to be: the big side is not shuffled.</li><li><b>Salting</b>: add a random suffix to hot keys on the big side, replicate the matching rows on the other side, join on key + salt, then aggregate.</li><li><b>Fix the data</b>: a hot key is often a data-quality bug (unmapped tags, nulls, a default value).</li></ul>",
    analogy:"One checkout lane gets every customer with a trolley. AQE opens extra lanes for that queue. Salting hands those customers numbered tickets so they spread across lanes."},
  {type:"order", kind:"build", title:"Salt a hot key", q:"Put the salting steps in order.",
    items:["Profile row counts per key and name the hot keys","On the big side, add a random salt 0 to N−1 to rows with a hot key","On the small side, replicate each hot-key row N times, one per salt value","Join on key and salt","Aggregate the result, dropping the salt"],
    why:"You spread the hot key over N partitions, make sure every salted row still finds its match, then remove the salt before the business result."},
  {type:"mcq", q:"AQE skew join is on, but the Spark UI still shows one 30-minute task. The skewed partition is about 180 MB. Why did AQE not split it?",
    opts:[{t:"It is under the 256 MB skewed-partition threshold, so AQE does not treat it as skewed",ok:true,why:"Right. Both conditions must hold. Lower spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes, or broadcast or salt instead."},
          {t:"AQE only works on SQL warehouses",why:"AQE runs on Databricks Runtime and SQL warehouses."},
          {t:"AQE needs a cluster restart for every query",why:"It works per query at runtime."},
          {t:"Skew handling only applies to aggregations",why:"It applies to sort-merge and shuffle-hash joins."}]},
  {type:"concept", title:"Spill and serialization", body:"<ul><li><b>Spill</b>: when a task's data does not fit in memory, Spark writes it to disk and reads it back. The stage page shows spill statistics only when a stage spills. Fixes: <code>spark.sql.shuffle.partitions=auto</code>, process fewer rows and columns, fix skew (spill often sits in the skewed task), or use workers with more memory.</li><li><b>Serialization</b>: converting rows to bytes to cross a boundary. Python UDFs, <code>collect()</code>, <code>toPandas()</code> and oversized broadcasts all pay it. Keep work inside the engine where you can.</li></ul>"},
  {type:"mcq", q:"Only the longest task in a join stage shows spill. Other tasks show none. What is the best first move?",
    opts:[{t:"Treat it as skew: fix the oversized partition, then re-check spill",ok:true,why:"Right. Spill in one task is a symptom of that task's partition being too big. Fix the cause first."},
          {t:"Buy workers with twice the memory",why:"It may hide the symptom but costs more and the skew remains."},
          {t:"Turn off AQE",why:"AQE is part of the solution, not the problem."},
          {t:"Increase the driver size",why:"The driver does not run the join tasks."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Broadcast join","Small table copied to every executor; the big side is not shuffled."],
    ["AQE skew join","Splits a partition more than 5× the median and over 256 MB (defaults)."],
    ["Salting","Random suffix on hot keys to spread them over several partitions."],
    ["Spill","Data written to disk because a task's partition did not fit in memory."],
    ["shuffle.partitions = auto","Databricks chooses the shuffle partition count from the plan and input size."],
    ["Serialization","Converting rows to bytes to cross the JVM–Python or executor–driver boundary."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Profiling the readings since A4 and A5 went live shows one tag, <code>A4-UNMAPPED</code>, holding a very large share of all rows: the A4 gateway sends readings with missing tag mapping under one default ID. The gold job joins readings to the 2,401-row sensor dimension with a sort-merge join because a past engineer turned broadcast off.</p>",
    qs:[
      {q:"What is the quickest safe fix for tonight's run?",opts:[
        {t:"Broadcast the sensor dimension, so the readings are not shuffled by sensor_id",ok:true,why:"Right. The dimension is tiny; broadcasting removes the shuffle that concentrates the hot key."},
        {t:"Salt every sensor ID with 64 salts",why:"Works, but adds complexity everywhere when only one key is hot and the other side is tiny."},
        {t:"Delete all A4 data",why:"That loses real readings. The fix must keep the data."}]},
      {q:"What is the lasting fix?",opts:[
        {t:"Fix the A4 tag mapping at ingestion and quarantine unmapped readings, so one default ID cannot swallow a plant",ok:true,why:"Right. The skew is a data-quality defect. Fix it at the source and keep evidence of it."},
        {t:"Keep AQE thresholds as low as possible forever",why:"It treats the symptom and can add overhead to every query."},
        {t:"Move A4 to its own workspace",why:"That splits the platform instead of fixing the data."}]},
      {q:"Tomás asks why adding plants made the job 17 times slower, not just a bit slower. What do you tell him?",opts:[
        {t:"Most of the new data piled onto one machine's to-do list, so everyone else waited for it",ok:true,why:"Right. Plain words, true to the mechanism, no jargon."},
        {t:"Spark's AQE skew thresholds were not tuned for the sort-merge join",why:"Accurate but meaningless to a Head of Operations."},
        {t:"The cloud got slower this week",why:"Not true, and it destroys trust when the real cause appears."}]}]}
  ]},
{ id:"lesson-4", short:"UDFs & the Method", title:"UDFs, Code Optimisation & a Troubleshooting Method", badge:"TS", badgeName:"Troubleshooter",
  goal:"Know when UDFs hurt and what to use instead, spot common code anti-patterns, and follow a repeatable method from symptom to verified fix.",
  blocks:[
  {type:"poll", kind:"hook", q:"A data scientist wrote a Python UDF that converts °F to °C on 41 million rows a day. What is the main cost?",
    opts:["The arithmetic","Moving every row out of the engine to Python and back","Storing the result"],
    reveal:"The arithmetic is trivial. The cost is serialization: every row leaves the JVM for a Python worker and comes back. A built-in expression does the same maths inside the engine."},
  {type:"concept", title:"The UDF ladder", body:"<p>The Databricks UDF guide ranks the options:</p><ul><li><b>Built-in functions and SQL UDFs</b> are the most efficient.</li><li><b>Scala UDFs</b> are generally faster than Python UDFs; they run in the JVM.</li><li><b>pandas UDFs</b> use Apache Arrow to move batches and are up to 100× faster than row-at-a-time Python UDFs.</li><li><b>Python UDFs</b> serialize data out of the JVM to the Python interpreter.</li></ul><p><b>Photon</b> does not support UDFs; that part of the plan falls back to the standard engine.</p>", diagram:"udf"},
  {type:"order", kind:"build", title:"Rank the options", q:"Order from fastest (1) to slowest (4) for a simple per-row calculation at scale.",
    items:["Built-in Spark function","Scala UDF","pandas UDF","Row-at-a-time Python UDF"],
    why:"Stay in the engine first. If you must write Python, use vectorised pandas UDFs, not row-by-row ones."},
  {type:"mcq", q:"Which replaces this Python UDF best? <code>@udf('double') def f_to_c(v): return (v - 32) * 5 / 9</code>",
    opts:[{t:"<code>(col('value') - 32) * 5 / 9</code> as a built-in expression",ok:true,why:"Right. Same result, no serialization, and Photon can run it."},
          {t:"A pandas UDF doing the same maths",why:"Better than a Python UDF, but still slower than a built-in for simple arithmetic."},
          {t:"<code>toPandas()</code> then convert in pandas",why:"Pulls all rows to the driver. Worse at scale."},
          {t:"A Python loop over <code>collect()</code>",why:"The slowest option of all."}]},
  {type:"concept", title:"Code habits that hurt", body:"<ul><li><b>Read too much</b>: select only needed columns and filter as early as possible so pruning and skipping work.</li><li><b>Pull to the driver</b>: <code>collect()</code> or <code>toPandas()</code> on large data.</li><li><b>Repeat actions</b>: <code>count()</code> or <code>display()</code> in a loop re-runs the whole plan each time. Cache only what is reused.</li><li><b>Force file counts</b>: <code>repartition(n)</code> or <code>coalesce(n)</code> right before a write fights optimized writes.</li><li><b>Row loops</b>: Python loops over rows instead of joins, windows and set-based logic.</li></ul>"},
  {type:"spot", title:"Spot the mistakes", q:"A pull request contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"Filtering before a join reduces the data that is shuffled.",bad:false,ex:"True."},
      {t:"Calling count() three times on the same DataFrame reads the data once.",bad:true,ex:"Wrong. Each action re-runs the plan unless the data is cached."},
      {t:"pandas UDFs use Arrow to cut serialization cost.",bad:false,ex:"True."},
      {t:"Photon accelerates Python UDFs.",bad:true,ex:"Wrong. Photon does not support UDFs; it falls back for that part."},
      {t:"repartition(1) before writing a big table makes the write faster.",bad:true,ex:"Wrong. One task writes everything; it also fights optimized writes."},
      {t:"A SQL UDF is among the most efficient UDF options.",bad:false,ex:"True, per the Databricks UDF guide."}]},
  {type:"concept", title:"A repeatable troubleshooting method", body:"<p>Under pressure, people change five settings at once and cannot say which one helped. Use the same six steps every time, and write each one down.</p>", diagram:"method"},
  {type:"order", kind:"build", title:"Run the method", q:"Put the troubleshooting steps in order.",
    items:["Reproduce and record a baseline time and data volume","Collect evidence in the Spark UI or query profile","Locate the longest stage or operator","Name the cause: skew, spill, shuffle, small files, UDF or I/O","Change one thing","Verify the result is identical, record the new time, write the ADR or runbook entry"],
    why:"Baseline first or you cannot prove improvement. One change at a time or you cannot explain it. Verify the result, not just the speed."},
  {type:"mcq", q:"A pair changed broadcast, shuffle partitions and cluster size at once. The job is now 5 minutes. What is the problem?",
    opts:[{t:"They cannot say which change fixed it, or whether the cost increase was needed",ok:true,why:"Right. Revert to the baseline and apply one change at a time. The ADR needs a reason, not luck."},
          {t:"Nothing; faster is all that matters",why:"The CFO will ask why the cluster grew, and the next incident will repeat the guesswork."},
          {t:"Five minutes is still too slow",why:"Maybe, but the method problem comes first."},
          {t:"They should have changed more settings",why:"More simultaneous changes make it worse."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Raj's team is SQL-first. After the incident, Marcus wants to know it will not happen again when the next plant is onboarded. Priya wants to know whether the fix costs more money.</p>",
    qs:[
      {q:"What do you leave behind for Raj's team?",opts:[
        {t:"A runbook with the six-step method, the queries to profile key skew and file counts, and the evidence from this incident",ok:true,why:"Right. The internal team must be able to run it without you."},
        {t:"A larger cluster and a note to call you",why:"It creates dependency and cost."},
        {t:"A Python framework only you understand",why:"The team has little Python; they could not maintain it."}]},
      {q:"What do you tell Priya about cost?",opts:[
        {t:"The fix removed wasted work, so the job uses less compute; here are the before and after run times from the job history",ok:true,why:"Right. Evidence, in her terms, with no inflated promises."},
        {t:"Performance work is free",why:"Engineering time and OPTIMIZE compute are not free. Be honest."},
        {t:"We doubled the cluster, so cost went up but it's worth it",why:"You did not need to; the evidence pointed elsewhere."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T05 part 1. 90 seconds. Score 6 or more to earn the T05 Performance Detective badge.",
    qs:[
      {q:"Where does Spark start a new stage?",o:["At every filter","At a shuffle","At every column"],a:1},
      {q:"Skew signal in stage summary metrics?",o:["Max far above the 75th percentile","Min equals Max","Many short tasks"],a:0},
      {q:"No Spark UI on serverless. What do you use?",o:["DESCRIBE HISTORY","Query profile","Billing system table"],a:1},
      {q:"What lets Delta skip files without opening them?",o:["File statistics in the transaction log","VACUUM","The driver's cache"],a:0},
      {q:"Which command compacts small files?",o:["VACUUM","ANALYZE","OPTIMIZE"],a:2},
      {q:"Layout Databricks recommends for new tables?",o:["Partitioning","Liquid clustering","Z-order"],a:1},
      {q:"2,401-row dimension in a shuffle join. Best fix?",o:["Broadcast it","Salt it","Repartition to 2,000"],a:0},
      {q:"Fastest way to do simple per-row maths?",o:["Python UDF","pandas UDF","Built-in function"],a:2}]}
  ]}
];
const FINAL_BADGE = {k:"T05",n:"T05 Performance Detective"};

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
  box.appendChild(el("h2",null,"Can you diagnose it in 90 seconds?"));
  box.appendChild(el("p",null,b.q));
  const stage=el("div","opts"); const start=el("button","btn",S.badges[FINAL_BADGE.k]?"Play again":"Start the round");
  const row=el("div","btnrow"); row.append(start); box.append(row,stage);
  let timer, left, qi, score, order;
  function end(){clearInterval(timer); stage.innerHTML="";
    const pass=score>=6;
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: "+FINAL_BADGE.n+".":"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">T05 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
