
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  batch:`<div class="flow"><span><b>Files</b>UC volume · ADLS</span><i>→</i><span><b>read_files</b>explore, infer schema</span><i>→</i><span><b>CTAS</b>create or rebuild a table</span><i>→</i><span><b>COPY INTO</b>append only new files</span><i>→</i><span><b>Delta table</b>bronze</span></div><div class="xbands"><div style="background:var(--sunk)">CTAS REBUILDS EVERYTHING ON RERUN · COPY INTO SKIPS FILES IT HAS ALREADY LOADED</div></div>`,
  al:`<div class="flow"><span><b>Land</b>new files arrive in a volume</span><i>→</i><span><b>Discover</b>Auto Loader lists only new files</span><i>→</i><span><b>Infer</b>schema stored in schema location</span><i>→</i><span><b>Write</b>append to a bronze table</span></div><div class="xbands"><div style="background:var(--teal);color:#fff">CHECKPOINT: REMEMBERS EVERY FILE ALREADY PROCESSED</div><div style="background:var(--sunk)">IN SQL: CREATE STREAMING TABLE … FROM STREAM read_files(…) USES AUTO LOADER</div></div>`,
  modes:`<div class="ladder"><div><b>addNewColumns</b>Default with no schema. Stream stops, adds the column, continues on restart.</div><div><b>rescue</b>Schema never changes. New columns go to _rescued_data. Never fails.</div><div><b>failOnNewColumns</b>Stream stops and stays stopped until someone updates the schema.</div><div><b>none</b>Default when you give a schema. New columns are ignored.</div></div>`,
  lc:`<div class="flow"><span><b>Source</b>Salesforce · SQL Server · Workday</span><i>→</i><span><b>Connection</b>UC object holding credentials</span><i>→</i><span><b>Gateway</b>databases only: captures changes</span><i>→</i><span><b>Pipeline</b>serverless ingestion</span><i>→</i><span><b>Tables</b>bronze, governed in UC</span></div><div class="xbands"><div style="background:var(--sunk)">FIRST RUN LOADS EVERYTHING · LATER RUNS LOAD ONLY CHANGES WHERE THE SOURCE ALLOWS</div></div>`,
  stream:`<div class="flow"><span><b>Source</b>files · Kafka / Event Hubs · Delta</span><i>→</i><span><b>Transform</b>select, cast, add metadata</span><i>→</i><span><b>Sink</b>Delta table</span></div><div class="xbands"><div style="background:var(--sunk)">TRIGGER: WHEN TO RUN (DEFAULT · processingTime · availableNow · real-time)</div><div style="background:var(--teal);color:#fff">CHECKPOINT: WHAT HAS BEEN DONE, SO A RESTART CONTINUES WITHOUT DUPLICATES</div></div>`,
  pick:`<div class="ladder"><div><b>Batch SQL</b>COPY INTO / CTAS. One-off or nightly files, SQL team, simple.</div><div><b>Auto Loader</b>Many files arriving all day, schema drift, scale.</div><div><b>Lakeflow Connect</b>SaaS apps and databases with a managed connector.</div><div><b>Streaming</b>Kafka / Event Hubs events, minutes or seconds.</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Batch ingestion", title:"Batch Ingestion: CTAS, COPY INTO and read_files", badge:"BL", badgeName:"Batch Loader",
  goal:"Load files into Delta tables with CTAS, COPY INTO or read_files, and say which one keeps a rerun safe.",
  blocks:[
  {type:"poll", kind:"hook", q:"A nightly job loads the SAP extract folder with INSERT INTO … SELECT. It fails halfway and the operator reruns it. What happens?",
    opts:["Nothing bad. Delta handles it","Some rows load twice","It depends on whether the load remembers which files it already read"],
    reveal:"The third answer is the one to give. Delta makes each write atomic, but a plain INSERT re-reads every file in the folder, so a rerun can load rows twice. Safe reruns are a design choice, not a default."},
  {type:"concept", title:"Three batch tools", body:"<ul><li><b>read_files</b>: a SQL table-valued function. It reads CSV, JSON, Parquet and more from a path, infers a schema, and adds a <code>_rescued_data</code> column by default.</li><li><b>CTAS</b> (<code>CREATE TABLE … AS SELECT</code>): creates a table from a query in one step. Rerun with <code>CREATE OR REPLACE</code> and it rebuilds the whole table.</li><li><b>COPY INTO</b>: loads files into an <b>existing</b> Delta table. It remembers which files it loaded and skips them on a rerun. Set <code>force</code> to reload.</li></ul>", diagram:"batch"},
  {type:"mcq", q:"Which statement about COPY INTO is accurate?",
    opts:[{t:"Files already loaded are skipped on a rerun unless you set force",ok:true,why:"Right. Databricks documents COPY INTO as retryable and idempotent: it tracks loaded files in the target table."},
          {t:"It creates a new table on every run",why:"No. It loads into an existing Delta table."},
          {t:"It reloads every file in the folder each run",why:"That is what a plain INSERT … SELECT over the folder does."},
          {t:"It only reads Parquet",why:"It reads CSV, JSON, Avro, ORC, Parquet, text and binary files."}]},
  {type:"concept", title:"Where the files live: volumes", body:"<p>A <b>Unity Catalog volume</b> is a governed folder for files, inside a schema. You address it as <code>/Volumes/&lt;catalog&gt;/&lt;schema&gt;/&lt;volume&gt;/path</code>. Access is granted like tables, so the same permissions and audit cover files and tables.</p><p>Every file read can also expose a hidden <code>_metadata</code> column: <code>file_path</code>, <code>file_name</code>, <code>file_size</code>, <code>file_modification_time</code>. It does not appear in <code>SELECT *</code>. You must select it by name.</p>",
    analogy:"A volume is the post room of the building. Same security desk as the offices, but it holds parcels, not filing cabinets."},
  {type:"order", kind:"build", title:"Build a safe first load", q:"Put the steps of a safe first load of the nightly SAP order extract in order.",
    items:["Land the extract files in a Unity Catalog volume","Explore them with SELECT … FROM read_files(…) LIMIT 10","Create the bronze Delta table with explicit column types","COPY INTO the table, adding _metadata.file_path","Rerun COPY INTO and confirm 0 new rows"],
    why:"Land first, look before you design, create the target, load with lineage to the file, then prove the rerun is harmless."},
  {type:"mcq", q:"You need the source file name in every bronze row, but SELECT * does not return it. Why?",
    opts:[{t:"_metadata is a hidden column and must be selected explicitly",ok:true,why:"Right. Write SELECT *, _metadata.file_path AS source_file in the read query."},
          {t:"File names are only available in Auto Loader",why:"_metadata works for all file formats in batch and streaming reads."},
          {t:"The file name is lost once data is in Delta",why:"It is lost only if you did not capture it during the load."},
          {t:"You must enable it at workspace level",why:"No setting is needed. You just select it."}]},
  {type:"sort", kind:"build", title:"Pick the batch tool", q:"Match each task to the tool you would use.",
    buckets:[{k:"ctas",n:"CTAS",s:"create or rebuild"},{k:"copy",n:"COPY INTO",s:"append new files"},{k:"rf",n:"read_files (ad hoc)",s:"look first"}],
    items:[
      {t:"One-off copy of a historical reference file into a table",k:"ctas",why:"A single create-and-fill is exactly CTAS."},
      {t:"Rebuild a small plant lookup table from scratch each night",k:"ctas",why:"Full rebuild each run: CREATE OR REPLACE TABLE AS SELECT."},
      {t:"Append each night's new SAP extract files to an existing bronze table",k:"copy",why:"Existing table, only new files: COPY INTO."},
      {t:"Rerun a failed nightly load without duplicating rows",k:"copy",why:"COPY INTO skips files it has already loaded."},
      {t:"See a new supplier file's columns before designing a table",k:"rf",why:"Query the file directly with read_files before you commit to a schema."},
      {t:"Count the rows in a folder of JSON files",k:"rf",why:"A quick SELECT count(*) FROM read_files(…) needs no table."}]},
  {type:"mcq", q:"SAP re-sends last night's file with the same name after correcting it. What does COPY INTO do by default?",
    opts:[{t:"Skips it, because a file with that name was already loaded",ok:true,why:"Right. Files already loaded are skipped even if they have changed. Plan for corrections: new file names, or a deliberate reload with force and a clean-up."},
          {t:"Loads the new version and replaces the old rows",why:"COPY INTO appends. It never replaces earlier rows."},
          {t:"Fails with an error",why:"It succeeds and loads nothing, which is more dangerous."},
          {t:"Loads it twice",why:"It loads it zero times."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["read_files","SQL table-valued function that reads files, infers a schema and adds _rescued_data by default."],
    ["CTAS","CREATE TABLE … AS SELECT. One step create and fill. Rerun with OR REPLACE rebuilds the table."],
    ["COPY INTO","Loads files into an existing Delta table and skips files already loaded. Retryable and idempotent."],
    ["force","COPY_OPTIONS setting that turns off the skip and reloads files."],
    ["Volume","Unity Catalog object for governed files: /Volumes/catalog/schema/volume/…"],
    ["_metadata","Hidden column with file_path, file_name, file_size, file_modification_time. Select it by name."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>SAP S/4HANA must stay untouched. Its nightly extracts (about 2M order lines a year, 180K materials) will land as files in Azure storage. Raj’s team is mostly SQL and SSIS developers. The SQL Server warehouse keeps running in parallel until each workload is reconciled.</p>",
    qs:[
      {q:"How should the nightly SAP extracts reach bronze for now?",opts:[
        {t:"Land the files in a volume and load them into a bronze table with a tool that tracks loaded files, recording the source file",ok:true,why:"Right. COPY INTO or Auto Loader both track files. SAP is never touched and reruns are safe."},
        {t:"Query SAP directly from Databricks every night",why:"That breaks the read-only constraint and puts load on SAP."},
        {t:"CREATE OR REPLACE the table every night from all historical files",why:"The rebuild grows every night and gets slower and more costly."}]},
      {q:"Why record _metadata.file_path on every bronze row at Halvorsen?",opts:[
        {t:"So any row can be traced to the extract file it came from when reconciling against the warehouse",ok:true,why:"Right. During the parallel run, finance will ask why numbers differ. The file path answers it."},
        {t:"Because Power BI needs it",why:"Reports do not use it. Audit and reconciliation do."},
        {t:"To make queries faster",why:"It adds lineage, not speed."}]}]}
  ]},
{ id:"lesson-2", short:"Auto Loader", title:"Auto Loader & Schema Evolution", badge:"SW", badgeName:"Schema Wrangler",
  goal:"Set up Auto Loader to pick up only new files, choose a schema evolution mode, and read the rescued data and file metadata columns.",
  blocks:[
  {type:"poll", kind:"hook", q:"A supplier adds a column to their file without telling you. What should your pipeline do?",
    opts:["Stop and wait for a person","Add the column and carry on","Keep running and park the new data somewhere safe"],
    reveal:"All three are real Auto Loader modes. The wrong answer is not deciding, then finding out from a blank report. This lesson shows how to choose per source."},
  {type:"concept", title:"How Auto Loader works", body:"<p><b>Auto Loader</b> (the <code>cloudFiles</code> source) processes new files incrementally as they land in cloud storage or a volume. It records every processed file in the stream's <b>checkpoint</b>, so a restart continues where it stopped. It stores the inferred schema in a <b>schema location</b> so it can detect changes.</p><p>In SQL you rarely write <code>cloudFiles</code>. A <b>streaming table</b> defined as <code>SELECT … FROM STREAM read_files(…)</code> uses Auto Loader for you.</p>", diagram:"al"},
  {type:"mcq", q:"An Auto Loader stream restarts after a cluster failure. Which files does it process?",
    opts:[{t:"Only files not yet recorded in its checkpoint",ok:true,why:"Right. The checkpoint is its memory. That is why each stream needs its own checkpoint and why you do not delete it casually."},
          {t:"Every file in the folder again",why:"That would duplicate rows. The checkpoint prevents it."},
          {t:"Only files that arrived in the last hour",why:"It works on what is new since the checkpoint, not a time window."},
          {t:"None until someone resets it",why:"It resumes automatically when restarted."}]},
  {type:"concept", title:"Inference: what type is each column?", body:"<ul><li><b>Auto Loader in Python</b> infers every CSV and JSON column as <b>string</b> unless you set <code>cloudFiles.inferColumnTypes</code> to true.</li><li><b>read_files</b> in SQL infers types by default.</li><li><b>Schema hints</b> fix the types you care about and let the rest be inferred, for example <code>schemaHints =&gt; 'inspected_qty INT, inspection_date DATE'</code>.</li><li>Inference samples the first 50 GB or 1,000 files, whichever comes first.</li></ul>"},
  {type:"mcq", q:"You need inspected_qty as INT and defect_count as INT, and are happy for everything else to be inferred. What do you use?",
    opts:[{t:"Schema hints",ok:true,why:"Right. Hints pin the columns that matter. A value that does not fit the hinted type goes to the rescued data column."},
          {t:"A full schema for all 30 columns",why:"Possible, but then new columns are ignored by default and you maintain every column by hand."},
          {t:"CAST in every downstream report",why:"That spreads the rule across reports, the opposite of one governed definition."},
          {t:"Nothing. Inference always gets it right",why:"One bad value in the sample can turn a numeric column into a string."}]},
  {type:"concept", title:"Four schema evolution modes", body:"<p>Set with <code>cloudFiles.schemaEvolutionMode</code> (or <code>schemaEvolutionMode</code> in read_files). A fifth mode, <code>addNewColumnsWithTypeWidening</code>, also widens types such as int to long (Public Preview, Databricks Runtime 16.4 and above).</p><p>In a pipeline or streaming table, a new column makes the flow <b>restart automatically</b> with the new schema. A plain Auto Loader stream in a job stops first; the job must restart it (set retries).</p>", diagram:"modes"},
  {type:"sort", kind:"build", title:"Pick the mode", q:"Match each situation to the schema evolution mode you would choose.",
    buckets:[{k:"add",n:"addNewColumns"},{k:"res",n:"rescue"},{k:"fail",n:"failOnNewColumns"},{k:"none",n:"none"}],
    items:[
      {t:"Supplier files change often; analysts want new fields within a day",k:"add",why:"Let the schema grow and alert on each change."},
      {t:"Bronze must never stop overnight; changes are reviewed each morning",k:"res",why:"The schema stays fixed and nothing is lost: new columns wait in _rescued_data."},
      {t:"A regulated feed where every change needs sign-off before loading",k:"fail",why:"Stop and stay stopped until someone approves the new schema."},
      {t:"You give the schema yourself and only want the agreed columns",k:"none",why:"None is the default with a provided schema: extra columns are ignored."}]},
  {type:"concept", title:"Rescued data and file metadata", body:"<ul><li><code>_rescued_data</code> holds values that did not fit: <b>type mismatches</b>, <b>columns missing from the schema</b> and <b>case mismatches</b>. It is a JSON string that also records the source file path.</li><li><code>_metadata.file_path</code> and <code>_metadata.file_modification_time</code> tell you which file and which version a row came from.</li><li>A typical bronze row adds <code>source_file</code> and <code>ingested_at</code> to the raw columns.</li></ul>",
    analogy:"Rescued data is the lost-property office. Nothing is thrown away, but someone has to go and look."},
  {type:"mcq", q:"A CSV row has defect_count = '3O' (letter O) and the schema hint says INT. With rescued data on, what lands in bronze?",
    opts:[{t:"defect_count is NULL and '3O' is kept in _rescued_data with the file path",ok:true,why:"Right. The row is kept, the typed column stays clean, and the original value is recoverable."},
          {t:"The whole row is dropped",why:"Rescued data exists so you do not lose rows to one bad value."},
          {t:"The stream fails",why:"Type mismatches are rescued, not fatal."},
          {t:"defect_count becomes a string column",why:"The hint fixes it as INT."}]},
  {type:"spot", title:"Spot the mistakes", q:"Tap every wrong statement, then check.",
    items:[
      {t:"With addNewColumns, a plain Auto Loader stream stops when it finds a new column, then continues after restart.",bad:false,ex:"True. That is the documented behaviour."},
      {t:"In rescue mode, new columns are added to the table.",bad:true,ex:"Wrong. Rescue never evolves the schema; new columns go to _rescued_data."},
      {t:"SELECT * returns the _metadata column.",bad:true,ex:"Wrong. It is hidden and must be selected by name."},
      {t:"A renamed source column arrives as a new column, and the old column is NULL for new rows.",bad:false,ex:"True. Auto Loader cannot tell a rename from a drop plus an add."},
      {t:"Two streams can share one checkpoint folder to save storage.",bad:true,ex:"Wrong. Each stream needs its own checkpoint."},
      {t:"Schema hints work when you do not supply a full schema.",bad:false,ex:"True. Hints apply only when no schema is provided."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>The supplier quality portal drops about 300 CSV and JSON files a day into cloud storage. Columns change without notice. The quality team uses the data to rate suppliers.</p>",
    qs:[
      {q:"Which design fits the supplier portal bronze tables?",opts:[
        {t:"Auto Loader streaming tables per format, schema hints for key columns, schema changes alerted, rescued data monitored",ok:true,why:"Right. Drift is expected, so it is designed for, and nothing is silently lost."},
        {t:"A fixed schema with mode none, so nothing ever changes",why:"New columns would be silently ignored and nobody would know."},
        {t:"A nightly CTAS over all files ever received",why:"Cost grows every day and changed columns break the rebuild."}]},
      {q:"The quality team asks which file an odd inspection came from. What answers it?",opts:[
        {t:"The source_file column captured from _metadata.file_path",ok:true,why:"Right. Every bronze row points to its file."},
        {t:"The Delta table history",why:"History shows table versions, not which file each row came from."},
        {t:"Asking the supplier",why:"Slow, and you should already know."}]}]}
  ]},
{ id:"lesson-3", short:"Lakeflow Connect & existing tables", title:"Lakeflow Connect & Ingesting into Existing Tables", badge:"CP", badgeName:"Connector Pro",
  goal:"Decide when a managed connector beats custom code, name its parts, and load into an existing Delta table without breaking it.",
  blocks:[
  {type:"poll", kind:"hook", q:"Your team must pull Salesforce cases every day. What is your first move?",
    opts:["Write Python against the REST API","Ask the analyst to keep exporting weekly","Check for a managed connector first"],
    reveal:"Check first. Custom API code is code your client must maintain forever. A managed connector moves that burden to the platform."},
  {type:"concept", title:"What Lakeflow Connect gives you", body:"<p><b>Lakeflow Connect</b> offers managed connectors governed by Unity Catalog and run on serverless compute. Examples:</p><ul><li><b>SaaS</b>: Salesforce, Workday, HubSpot, Jira</li><li><b>Databases</b> with change capture: SQL Server, MySQL, PostgreSQL</li><li><b>Files</b>: SharePoint, Google Drive</li></ul><p>The first run loads all selected data. Later runs load only changes where the source allows it.</p>", diagram:"lc"},
  {type:"mcq", q:"What does the Unity Catalog connection object hold in Lakeflow Connect?",
    opts:[{t:"The authentication details for the source, as a governed securable",ok:true,why:"Right. Credentials live in one governed object, not in notebooks."},
          {t:"A copy of the source data",why:"Data lands in tables. The connection only stores how to authenticate."},
          {t:"The pipeline schedule",why:"The schedule belongs to the pipeline or job."},
          {t:"The target table's schema",why:"Schemas are on the tables."}]},
  {type:"order", kind:"build", title:"Trace a database connector", q:"Put the parts of a managed database connector in the order data passes through them.",
    items:["Source database","Ingestion gateway captures changes","Staging storage","Ingestion pipeline","Destination tables in Unity Catalog"],
    why:"The gateway reads changes continuously into staging; the pipeline applies them to governed tables. SaaS connectors skip the gateway."},
  {type:"concept", title:"Managed, custom or code?", body:"<ul><li><b>Managed connector</b>: least code, platform maintains it. First choice when one exists and fits.</li><li><b>Community or custom connector</b>: for sources with no managed connector.</li><li><b>SQL and Spark APIs</b> (Auto Loader, read_files, Structured Streaming): more control, broader source support, more to run.</li></ul><p>For a client whose team is small and SQL-first, every line of custom code is a running cost.</p>"},
  {type:"sort", kind:"build", title:"Connector or code?", q:"Match each Halvorsen source to its ingestion route.",
    buckets:[{k:"lc",n:"Lakeflow Connect"},{k:"al",n:"Auto Loader"},{k:"ss",n:"Structured Streaming"}],
    items:[
      {t:"Salesforce Service Cloud cases and accounts",k:"lc",why:"Managed Salesforce connector, no API code."},
      {t:"An on-premises SQL Server database with change capture",k:"lc",why:"Managed database connector with an ingestion gateway."},
      {t:"Supplier portal CSV and JSON files in storage",k:"al",why:"Files landing all day with drift: Auto Loader."},
      {t:"MES daily CSV exports from each plant",k:"al",why:"Files again: Auto Loader picks up each new export."},
      {t:"Historian sensor readings published to Event Hubs",k:"ss",why:"An event stream: Structured Streaming via the Kafka-compatible endpoint."}]},
  {type:"concept", title:"Loading into an existing Delta table", body:"<ul><li><b>INSERT INTO</b>: appends whatever you select. No memory of what was loaded.</li><li><b>COPY INTO</b>: appends only files not loaded before.</li><li><b>MERGE INTO</b>: upserts on a key. Running it twice with the same data gives the same result.</li><li><b>Streaming write</b> (<code>toTable</code>) with a checkpoint: appends each new record once.</li></ul><p><b>Schema enforcement</b>: Delta rejects a write whose columns do not match. <code>mergeSchema</code> lets new columns in. It only adds columns; renames, drops and type changes need separate handling.</p>"},
  {type:"mcq", q:"Last night's load into an existing bronze table failed with a schema mismatch: the source added a column. What is the safest fix?",
    opts:[{t:"Confirm the column is expected, then enable mergeSchema for that write",ok:true,why:"Right. The table evolves by adding the column; earlier rows get NULL. Nothing is rewritten."},
          {t:"Overwrite the table with the new file",why:"You lose all earlier history in bronze."},
          {t:"Turn off schema checks for the whole workspace",why:"That removes the protection for every table."},
          {t:"Drop the column from the source file by hand every night",why:"Manual, error-prone and loses data."}]},
  {type:"mcq", q:"Which load gives the same result if the same supplier master file is processed twice?",
    opts:[{t:"MERGE INTO keyed on supplier_id",ok:true,why:"Right. Matching rows are updated, not added again."},
          {t:"INSERT INTO … SELECT",why:"It appends the rows a second time."},
          {t:"CREATE TABLE … AS SELECT without OR REPLACE",why:"It fails the second time because the table exists."},
          {t:"A streaming write with a new checkpoint each run",why:"A fresh checkpoint has no memory, so it reprocesses everything."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Lakeflow Connect","Managed connectors for SaaS apps, databases and file sources, governed by Unity Catalog, run on serverless."],
    ["Connection","Unity Catalog securable that stores the source's authentication details."],
    ["Ingestion gateway","Database connectors only: captures changes continuously into staging."],
    ["Schema enforcement","Delta rejects writes whose columns do not match the table."],
    ["mergeSchema","Lets a write add new columns to an existing Delta table. Adds only."],
    ["MERGE INTO","Upsert on a key. Idempotent when the key is stable."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Salesforce Service Cloud holds accounts, cases, field visits and contacts (personal data), about 95K cases a year. Today an analyst exports it weekly into spreadsheets. Dana Okafor (DPO) wants zero PII in spreadsheets and auditable access. EU personal data must stay in the EU.</p>",
    qs:[
      {q:"How should Salesforce data reach bronze?",opts:[
        {t:"The Lakeflow Connect Salesforce connector, writing to a bronze schema in the EU catalog, replacing the weekly export",ok:true,why:"Right. No custom code, governed from the first row, and the spreadsheet copy can be retired."},
        {t:"Keep the weekly export and upload the spreadsheets to a volume",why:"PII stays in spreadsheets, the opposite of Dana’s goal."},
        {t:"A Python script calling the Salesforce API from a notebook",why:"Works, but Raj’s team would maintain API code they cannot easily support."}]},
      {q:"A nightly INSERT INTO of the supplier master into an existing Delta table created duplicates after a rerun last week. What do you change?",opts:[
        {t:"Switch to MERGE INTO on supplier_id",ok:true,why:"Right. A keyed upsert is safe to rerun."},
        {t:"Ask operators never to rerun",why:"Failures happen about twice a month today. Reruns must be safe."},
        {t:"Delete the table and reload everything each night",why:"Costly, and loses the history bronze is there to keep."}]}]}
  ]},
{ id:"lesson-4", short:"Streaming & choosing", title:"Structured Streaming Fundamentals & Choosing the Pattern", badge:"SP", badgeName:"Stream Pilot",
  goal:"Explain source, sink, trigger and checkpoint, make a stream safe to rerun, and choose an ingestion pattern for any source.",
  blocks:[
  {type:"poll", kind:"hook", q:"A Structured Streaming job runs once an hour, processes what is new, then stops. Is that streaming?",
    opts:["Yes","No, it is batch","Only if it runs for more than a minute"],
    reveal:"Yes. Structured Streaming is an incremental processing model, not a promise to run all day. With the availableNow trigger, the same code runs as a scheduled incremental batch."},
  {type:"concept", title:"Four parts of every stream", body:"<ul><li><b>Source</b>: where new records come from: files (Auto Loader), Kafka or Event Hubs, a Delta table.</li><li><b>Sink</b>: where they go, usually a Delta table.</li><li><b>Trigger</b>: when to process.</li><li><b>Checkpoint</b>: what has already been processed, so a restart neither skips nor repeats records.</li></ul>", diagram:"stream"},
  {type:"mcq", q:"What does a streaming checkpoint store?",
    opts:[{t:"Progress through the source (offsets or files) and any state, so a restart continues exactly where it stopped",ok:true,why:"Right. With a Delta sink, this is what gives each record exactly one write."},
          {t:"A backup copy of the data",why:"It stores progress, not data."},
          {t:"The table's schema only",why:"Schema lives with the table (and Auto Loader's schema location)."},
          {t:"Query results for dashboards",why:"Not related to serving."}]},
  {type:"concept", title:"Triggers", body:"<ul><li><b>Default</b> (no trigger set): micro-batches run back to back, about every few seconds.</li><li><b>processingTime</b>, e.g. <code>'1 minute'</code>: a micro-batch at a fixed interval.</li><li><b>availableNow</b>: process everything available now, in one or more batches, then stop. Made for scheduled jobs. Replaces the deprecated <code>Trigger.Once</code>.</li><li><b>Real-time mode</b>: sub-second latency for operational cases such as fraud scoring.</li></ul><p>Serverless notebooks and jobs support only availableNow (and Once).</p>"},
  {type:"tradeoff", kind:"build", title:"Turn the dials", q:"Supplier files arrive all day (about 300). The quality team reads its report at 08:00 and 14:00. Pick a pattern and watch the dials.",
    opts:[
      {n:"Always-on stream (default trigger)",m:[95,80,55],verdict:"Fresh to the second, but nobody reads it between 08:00 and 14:00. You pay for compute all day for nothing.",ok:false},
      {n:"Hourly job, availableNow trigger",m:[70,25,25],verdict:"Best fit. Fresh for both readings, compute only runs for minutes an hour, and the code can switch trigger later.",ok:true},
      {n:"Nightly CTAS over all files",m:[20,35,20],verdict:"The 14:00 report shows yesterday, and the rebuild reads every file ever received, every night.",ok:false}]},
  {type:"concept", title:"Safe to rerun", body:"<ul><li><b>One checkpoint per stream, per target.</b> Never share one; never delete one unless you mean to reprocess everything.</li><li><b>Batch loads</b>: COPY INTO (skips loaded files) or MERGE INTO (keyed upsert), never plain INSERT for reruns.</li><li><b>Record lineage</b>: source_file and ingested_at on every bronze row.</li><li><b>Full refresh</b> of a streaming table reprocesses all source data. For short-retention sources such as Kafka or Event Hubs, the old data may be gone.</li></ul>"},
  {type:"mcq", q:"A colleague deletes the checkpoint of a stuck Auto Loader stream that appends into bronze. What happens on the next run?",
    opts:[{t:"Every file in the folder is processed again, so bronze gets duplicates",ok:true,why:"Right. Without its memory the stream starts from scratch."},
          {t:"Nothing changes",why:"The checkpoint was what prevented reprocessing."},
          {t:"Only new files are processed",why:"It no longer knows which files are new."},
          {t:"The table is truncated first",why:"Deleting a checkpoint does not touch the table."}]},
  {type:"concept", title:"Choosing the pattern", body:"<p>Ask four questions per source: <b>What shape</b> is it (files, app, database, events)? <b>How fresh</b> must it be? <b>How often</b> does its schema change? <b>Who will run it</b>? Pick the simplest pattern that meets the need.</p>", diagram:"pick"},
  {type:"sort", kind:"build", title:"Choose the pattern", q:"Match each source to the pattern you would choose.",
    buckets:[{k:"b",n:"Batch SQL",s:"COPY INTO / CTAS"},{k:"al",n:"Auto Loader"},{k:"lc",n:"Lakeflow Connect"},{k:"ss",n:"Structured Streaming"}],
    items:[
      {t:"A one-time historical export of the 8 TB warehouse as Parquet",k:"b",why:"One-off and well-structured: a batch load."},
      {t:"A plant reference list that changes twice a year",k:"b",why:"Small and rare: CTAS or COPY INTO is plenty."},
      {t:"Supplier portal CSV/JSON whose columns change without notice",k:"al",why:"Many files plus drift: Auto Loader with schema evolution."},
      {t:"MES daily CSV files from nine plants",k:"al",why:"Files arriving daily across plants: Auto Loader."},
      {t:"Salesforce Service Cloud cases",k:"lc",why:"Managed connector exists."},
      {t:"Sensor readings on Event Hubs, needed within minutes",k:"ss",why:"Event stream via the Kafka-compatible endpoint."}]},
  {type:"spot", title:"Spot the mistakes", q:"An ingestion design contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"availableNow processes all available data and then stops.",bad:false,ex:"True."},
      {t:"Trigger.Once is the recommended trigger for new incremental jobs.",bad:true,ex:"Wrong. It is deprecated; use availableNow."},
      {t:"Event Hubs can be read with the Kafka connector.",bad:false,ex:"True. Event Hubs exposes a Kafka-compatible endpoint."},
      {t:"A full refresh is a safe way to fix a streaming table fed from a 7-day Kafka topic.",bad:true,ex:"Wrong. Data older than the retention period cannot be reprocessed."},
      {t:"Plain INSERT INTO is idempotent if the job is scheduled.",bad:true,ex:"Wrong. Scheduling does not stop a rerun from appending rows again."},
      {t:"The same Structured Streaming code can run hourly or continuously by changing the trigger.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>About 2,400 sensors report every 5 seconds, roughly 41M readings a day. Readings reach Azure Event Hubs. Group OEE must be ready by 07:00; the predictive-maintenance pilot on plant A2’s compressor line will later need alerts within minutes.</p>",
    qs:[
      {q:"How should sensor readings land in bronze?",opts:[
        {t:"Structured Streaming from Event Hubs (Kafka endpoint) into an append-only bronze table, with its own checkpoint",ok:true,why:"Right. Raw readings are kept once and replayable; the trigger can start at a few minutes and tighten when alerts need it."},
        {t:"Export from each historian to CSV nightly",why:"Nine stale copies, and it cannot support alerts later."},
        {t:"Lakeflow Connect Salesforce connector",why:"Wrong source type entirely."}]},
      {q:"OEE is needed by 07:00 only. Which trigger for the sensor stream today?",opts:[
        {t:"A scheduled availableNow or a processingTime of several minutes, tightened when the alerting pilot starts",ok:true,why:"Right. Pick the slowest trigger that meets today’s need; changing it later is a configuration change."},
        {t:"Real-time mode from day one",why:"Sub-second latency is not needed for a 07:00 report and costs more."},
        {t:"No checkpoint, to keep it simple",why:"Without a checkpoint every restart reprocesses or loses data."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T02 part 1. 90 seconds. Score 6 or more to earn the T02 Ingestion Expert badge.",
    qs:[
      {q:"Which tool skips files it has already loaded?",o:["INSERT INTO","COPY INTO","CREATE OR REPLACE TABLE"],a:1},
      {q:"How do you get the source file path into a row?",o:["SELECT * returns it","Select _metadata.file_path","Enable lineage"],a:1},
      {q:"Default Auto Loader mode with no schema given?",o:["addNewColumns","rescue","none"],a:0},
      {q:"Which mode never changes the schema and keeps new columns?",o:["failOnNewColumns","none","rescue"],a:2},
      {q:"A type mismatch with rescued data on lands in…",o:["_rescued_data","A dropped row","A stream failure"],a:0},
      {q:"Best route for Salesforce cases?",o:["Auto Loader","Lakeflow Connect","Structured Streaming"],a:1},
      {q:"Trigger for an hourly scheduled incremental job?",o:["availableNow","Default","Real-time mode"],a:0},
      {q:"What stops a restarted stream reprocessing data?",o:["The schema location","The checkpoint","The trigger"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T02",n:"T02 Ingestion Expert"};

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
  const head=el("header","head",`<span class="mono eyebrow">T02 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
