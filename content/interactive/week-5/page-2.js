
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  cdcflow:`<div class="flow"><span><b>Source</b>SAP change feed or nightly snapshot</span><i>→</i><span><b>Bronze</b>Append-only change rows: key, op, sequence</span><i>→</i><span><b>AUTO CDC</b>KEYS · SEQUENCE BY · APPLY AS DELETE WHEN</span><i>→</i><span><b>Silver</b>SCD1 current or SCD2 history</span><i>→</i><span><b>Gold</b>Margin, service, Power BI</span></div>`,
  scd:`<div class="silo"><div><b>SCD type 1: overwrite</b><ul><li>One row per key, always the latest values</li><li>A delete removes the row</li><li>Answers “what is true now?”</li><li>Use for corrections and fields you must not keep history of</li></ul></div><div><b>SCD type 2: keep history</b><ul><li>A new row per change, with __START_AT and __END_AT</li><li>The current row has __END_AT = NULL</li><li>A delete closes the open row; no new row</li><li>Answers “what was true on that date?”</li></ul></div></div>`,
  cdf:`<div class="med"><div style="background:var(--bronze)"><b>SILVER TABLE</b>Change data feed on. Every commit records row-level changes.</div><span class="ar">→</span><div style="background:var(--silver)"><b>READ CHANGES</b>table_changes() or readChangeFeed: insert, update_preimage, update_postimage, delete.</div><span class="ar">→</span><div style="background:var(--gold)"><b>APPLY DOWNSTREAM</b>Drop preimages, keep latest per key, MERGE: delete, update, insert.</div></div>`,
  uch:`<div class="ladder"><div><b>METASTORE</b>One per region. Halvorsen: EU and North America.</div><div><b>CATALOG</b>Environment + region, e.g. hal_prod_eu. Bound to workspaces.</div><div><b>SCHEMA</b>Layer + domain, e.g. silver_service, gold_finance.</div><div><b>OBJECTS</b>Tables, views, volumes, functions (masks and filters).</div></div>`,
  pii:`<div class="silo"><div><b>Pseudonymise</b><ul><li>Replace identifiers with a token or keyed hash</li><li>Reversible by whoever holds the key or lookup table</li><li>Still personal data under GDPR</li><li>Keeps joins working across tables</li></ul></div><div><b>Anonymise</b><ul><li>Aggregate, generalise or suppress so no one can be singled out</li><li>Irreversible, by design</li><li>No longer personal data if done properly</li><li>Loses row-level detail</li></ul></div></div>`,
  erase:`<div class="flow"><span><b>Request</b>Logged in an erasure control table</span><i>→</i><span><b>Bronze</b>DELETE or MERGE … WHEN MATCHED THEN DELETE</span><i>→</i><span><b>Propagate</b>Change data feed carries deletes to silver and gold</span><i>→</i><span><b>Purge</b>REORG TABLE … APPLY (PURGE), then VACUUM</span><i>→</i><span><b>Prove</b>Control table + audit log as evidence</span></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Change Data & SCD", title:"Change Data and SCD Type 1 vs Type 2 with AUTO CDC", badge:"CD", badgeName:"Change Tracker",
  goal:"Explain what a change feed contains, choose SCD type 1 or type 2 per attribute, and write an AUTO CDC flow that handles late events and deletes.",
  blocks:[
  {type:"poll", kind:"hook", q:"SAP records that customer C200 moved from “Standard” to “Key account” on 5 October. In November, finance asks which segment C200 was in when its September contract was priced. Halvorsen overwrites the customer table every night. What can it answer?",
    opts:["The September segment","Only today’s segment","It depends on the report"],
    reveal:"Only today’s segment. A nightly overwrite keeps no history, so every past margin calculation silently uses today’s values. Keeping history on purpose is what this lesson is about."},
  {type:"concept", title:"What change data capture is", body:"<p>A <b>change feed</b> sends one row per change instead of the whole table. Each row carries:</p><ul><li>the <b>key</b> (for example <code>customer_id</code>)</li><li>the <b>operation</b>: insert, update or delete</li><li>a <b>sequence</b>: a source timestamp or log number that orders the changes</li><li>the new column values</li></ul><p>Rows can arrive late, twice or out of order. The sequence column, not the arrival time, decides which change is the latest. If the source only gives full snapshots, you can still derive changes by comparing one snapshot with the next.</p>", diagram:"cdcflow"},
  {type:"mcq", q:"Why does an AUTO CDC flow require a SEQUENCE BY column?",
    opts:[{t:"To order changes by when they happened in the source, even if they arrive out of order",ok:true,why:"Right. Network retries and batch files mean arrival order is not change order. The sequence column decides which version wins and where history rows start and end."},
          {t:"To partition the target table for speed",why:"Partitioning is a separate choice. SEQUENCE BY is about ordering events."},
          {t:"To generate a surrogate key",why:"AUTO CDC uses the KEYS columns you give it; it does not need a surrogate key."},
          {t:"To decide which rows are deletes",why:"That is APPLY AS DELETE WHEN."}]},
  {type:"concept", title:"SCD type 1 or type 2", body:"<p>A <b>slowly changing dimension</b> is a table of things that change now and then: customers, contracts, materials. You choose per table, and sometimes per column, whether to keep history.</p>", diagram:"scd",
    analogy:"Type 1 is a whiteboard: you wipe it and write the new value. Type 2 is a logbook: you never erase a line, you add a new one with today’s date."},
  {type:"sort", kind:"build", title:"History or overwrite?", q:"For Halvorsen’s customer table, sort each attribute change into SCD type 2 (keep history) or SCD type 1 (overwrite).",
    buckets:[{k:"h",n:"SCD type 2",s:"keep history"},{k:"o",n:"SCD type 1",s:"overwrite"}],
    items:[
      {t:"Customer segment (Standard → Key account)",k:"h",why:"Contract pricing and margin depend on the segment at the time. Finance needs the past value."},
      {t:"Sales region / responsible plant",k:"h",why:"Revenue and service margin are reported by region. Moving a customer must not rewrite last year’s regional figures."},
      {t:"Payment terms (30 → 60 days)",k:"h",why:"Working-capital analysis needs the terms that applied when each invoice was raised."},
      {t:"Spelling fix in the customer name",k:"o",why:"A correction, not a business change. History of a typo has no value."},
      {t:"Contact email address",k:"o",why:"Personal data. Keeping every past email multiplies the PII you must protect and erase. Keep only the current value."},
      {t:"Contact phone number",k:"o",why:"Same reason: data minimisation. Exclude it from tracked history."}]},
  {type:"concept", title:"AUTO CDC INTO, clause by clause", body:"<p>In Lakeflow Spark Declarative Pipelines (formerly DLT), the <b>AUTO CDC</b> APIs (formerly APPLY CHANGES INTO) turn a change feed into SCD type 1 or type 2. In SQL you first declare a streaming table, then a flow that fills it:</p><ul><li><code>CREATE OR REFRESH STREAMING TABLE customer_scd2;</code></li><li><code>CREATE FLOW customer_flow AS AUTO CDC INTO customer_scd2</code></li><li><code>FROM stream(bronze.sap_customer_changes)</code></li><li><code>KEYS (customer_id)</code>: what identifies a row</li><li><code>APPLY AS DELETE WHEN op = 'DELETE'</code>: which events are deletes</li><li><code>SEQUENCE BY change_ts</code>: the order of events</li><li><code>COLUMNS * EXCEPT (op, change_ts)</code>: what to store</li><li><code>STORED AS SCD TYPE 2</code>: keep history (type 1 is the default)</li><li><code>TRACK HISTORY ON * EXCEPT (email, phone)</code>: optional, which columns create new versions</li></ul><p>For type 2 the target gets <code>__START_AT</code> and <code>__END_AT</code>, with the same data type as the sequence column.</p>"},
  {type:"order", kind:"build", title:"Assemble the flow", q:"Put the parts of the AUTO CDC statement in the order you write them.",
    items:["CREATE OR REFRESH STREAMING TABLE customer_scd2","CREATE FLOW … AS AUTO CDC INTO customer_scd2","FROM stream(bronze.sap_customer_changes)","KEYS (customer_id)","APPLY AS DELETE WHEN op = 'DELETE'","SEQUENCE BY change_ts","STORED AS SCD TYPE 2"],
    why:"Declare the target, start the flow, name the streaming source, then the key, the delete rule and the ordering column, and finally the SCD type. COLUMNS and TRACK HISTORY ON sit between SEQUENCE BY and STORED AS when you need them."},
  {type:"concept", title:"Late events and deletes", body:"<ul><li><b>Late event</b>: an update dated 20 September arrives after one dated 5 October. In type 2 it becomes a history row from 20 September to 5 October. The current row does not change. In type 1 it is ignored because a newer change already won.</li><li><b>Delete in type 2</b>: the open row gets an <code>__END_AT</code>; no new row is added, so the key has no current version. History stays.</li><li><b>Delete in type 1</b>: the row disappears.</li><li><b>Tombstones</b>: AUTO CDC keeps deleted keys briefly in the underlying table so a late update cannot bring a deleted customer back.</li><li><b>Current flag</b>: AUTO CDC does not add one. Derive it: <code>__END_AT IS NULL</code>.</li></ul>"},
  {type:"mcq", q:"In an SCD type 2 table, customer C300 is deleted in SAP at 16:45 on 10 October. What does the AUTO CDC target show afterwards?",
    opts:[{t:"C300’s open row now ends at 10 October 16:45, and C300 has no current row",ok:true,why:"Right. The delete closes the open version. History is kept, which is also why a right-to-erasure request needs extra steps later in this week."},
          {t:"All of C300’s rows are removed",why:"That is type 1 behaviour. Type 2 keeps history."},
          {t:"A new current row with all columns NULL",why:"No new row is written for a delete."},
          {t:"Nothing; deletes are ignored unless you run a full refresh",why:"APPLY AS DELETE WHEN makes the flow treat matching events as deletes."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Change feed","One row per insert, update or delete, with a key, an operation and a sequence."],
    ["SEQUENCE BY","The column that orders events, so late or out-of-order rows land correctly."],
    ["SCD type 1","Overwrite: one row per key with the latest values."],
    ["SCD type 2","History: a row per version with __START_AT and __END_AT; current row has __END_AT NULL."],
    ["TRACK HISTORY ON","Limits which columns create new SCD2 versions."],
    ["AUTO CDC FROM SNAPSHOT","Derives inserts, updates and deletes by comparing full snapshots, when no change feed exists."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>SAP S/4HANA customer data arrives as nightly full extracts. Halvorsen already licenses an SAP change feed but has never used it. Service margin for all 12,000 contracts is due in 9 months, and margin depends on the customer’s segment and region at the time of each contract.</p>",
    qs:[
      {q:"Until the change feed is evaluated, how can you still build customer history from the nightly extracts?",opts:[
        {t:"Use AUTO CDC from snapshot to compare each night’s extract with the target and derive the changes",ok:true,why:"Right. Snapshot comparison infers inserts, updates and deletes. It only sees one state per night, so changes within a day are lost; that is one argument for the change feed."},
        {t:"Overwrite the silver customer table each night",why:"That is SCD type 1 and loses the history margin needs."},
        {t:"Ask SAP to add a history table",why:"SAP must stay untouched."}]},
      {q:"Which column should the flow SEQUENCE BY?",opts:[
        {t:"The change timestamp or sequence number that SAP writes into the feed",ok:true,why:"Right. Order comes from the source. Ingestion time reflects when a file arrived, not when the change happened."},
        {t:"The time the file landed in cloud storage",why:"A late file would then overwrite newer data."},
        {t:"customer_id",why:"That is the key, not an ordering column."}]},
      {q:"Should every past contact email be kept in the SCD2 history?",opts:[
        {t:"No. Exclude email and phone from tracked history and keep only current values",ok:true,why:"Right. History of personal data has little business value and every copy is something Dana must protect, audit and erase."},
        {t:"Yes, full history is always safer",why:"Not for personal data. Minimisation is a GDPR principle."},
        {t:"Yes, but in a spreadsheet",why:"Spreadsheets are exactly the PII problem Halvorsen wants to end."}]}]}
  ]},
{ id:"lesson-2", short:"Change Data Feed", title:"Change Data Feed, Deletes and Propagation", badge:"CF", badgeName:"Change Propagator",
  goal:"Read row-level changes from a Delta table, apply them downstream including deletes, and choose how streaming tables cope with updates and deletes.",
  blocks:[
  {type:"poll", kind:"hook", q:"You delete one customer from the silver customer table. Without extra work, how many downstream tables still hold that customer?",
    opts:["None. Deletes flow downstream automatically","Every table built from silver that is not a full recompute","Only gold"],
    reveal:"Every incremental table built from silver. Materialized views recompute and catch it on refresh. Append-only streams and incremental MERGE jobs do not see a delete unless you give them one. That is the job of the change data feed."},
  {type:"concept", title:"Change data feed (CDF)", body:"<p>The <b>change data feed</b> records row-level changes for every commit to a Delta table. You read it alongside the data columns plus three metadata columns:</p><ul><li><code>_change_type</code>: <code>insert</code>, <code>update_preimage</code>, <code>update_postimage</code> or <code>delete</code></li><li><code>_commit_version</code>: the table version of the change</li><li><code>_commit_timestamp</code>: when it was committed</li></ul><p>On older runtimes you enable it per table with <code>delta.enableChangeDataFeed = true</code>. Newer runtimes provide it automatically for eligible Unity Catalog tables with row tracking. Check the current docs for your runtime.</p>", diagram:"cdf"},
  {type:"mcq", q:"You MERGE CDF rows into a downstream table. Which change types do you apply?",
    opts:[{t:"insert, update_postimage and delete",ok:true,why:"Right. The postimage is the new value. The preimage is the old value; it is useful for audit, but applying it would overwrite the update."},
          {t:"All four change types",why:"Applying update_preimage would write the old value back."},
          {t:"Only insert",why:"Then updates and deletes never reach the downstream table."},
          {t:"Only update_preimage and delete",why:"The preimage is the value before the change."}]},
  {type:"concept", title:"Reading and processing changes", body:"<ul><li><b>Batch, SQL</b>: <code>SELECT * FROM table_changes('silver.customer', 12)</code> returns every change from version 12 onwards. You can also pass an end version or timestamps.</li><li><b>Streaming</b>: <code>spark.readStream.option(\"readChangeFeed\", \"true\").table(...)</code>. The first run returns the current rows as inserts, then later changes.</li><li><b>Process</b>: drop preimages, keep the latest change per key (several commits can touch the same key), then MERGE.</li><li><b>Not a permanent history</b>: change data follows table retention. Once VACUUM removes old versions, their changes are gone. If you need permanent history, write it to a table, for example SCD type 2.</li></ul>"},
  {type:"order", kind:"build", title:"Propagate a change", q:"Order the steps to apply silver changes to a downstream gold copy with the change data feed.",
    items:["Make sure the silver table records changes","Read changes since the last version you processed","Drop update_preimage rows","Keep only the latest change per key","MERGE: delete, update or insert","Store the last processed version"],
    why:"Without the stored version you either reprocess or miss changes. Without the per-key step, two commits for the same customer in one run make the MERGE fail or apply the wrong one."},
  {type:"concept", title:"Streaming tables, updates and deletes", body:"<p>A streaming table that reads a Delta table expects <b>append-only</b> input. An update or delete in the source breaks the stream. You have three options:</p><ul><li><b>skipChangeCommits</b>: the stream ignores commits that update or delete. It keeps running, but the deleted rows stay downstream until you delete them there yourself.</li><li><b>Full refresh</b>: rebuild the streaming table. Only safe if the full source history still exists.</li><li><b>Stream the change feed</b> and handle updates and deletes in your own processing code.</li></ul><p><b>Materialized views</b> handle source deletes automatically when they refresh.</p>"},
  {type:"mcq", q:"A pipeline’s streaming table reads silver.customer. To honour an erasure request you DELETE a customer’s rows from silver. The next run fails. What is the documented fix?",
    opts:[{t:"Delete the rows in the streaming table too, and set skipChangeCommits on its streaming read",ok:true,why:"Right. The stream then skips the delete commit, and you have removed the data downstream yourself. Alternatively, propagate deletes from the change feed."},
          {t:"Restore the deleted rows so the stream keeps working",why:"That would undo the erasure."},
          {t:"Switch the pipeline to continuous mode",why:"The trigger mode does not make deletes appendable."},
          {t:"Nothing; it will recover on the next run",why:"It will keep failing on the same commit."}]},
  {type:"concept", title:"Multiplex bronze and Iceberg reads", body:"<ul><li><b>Multiplex</b>: one bronze table holds many event types, for example every SAP change topic, with a column naming the type. Streams fan out from it into one silver table per type. One ingestion path, many consumers.</li><li><b>Iceberg reads</b> (formerly called UniForm): a Delta table can publish Iceberg metadata so Iceberg clients read the same files. It cannot be combined with deletion vectors on that table, which matters when you purge deleted rows.</li></ul>"},
  {type:"tradeoff", kind:"build", title:"Turn the dials", q:"Dana needs erased customers removed from every downstream table within 7 days. Pick how silver deletes reach gold and watch the dials.",
    opts:[
      {n:"Rebuild every downstream table from scratch nightly",m:[40,85,25],verdict:"It works today, but cost grows with history size and the 340-package nightly window is already fragile. It also re-reads data you meant to forget.",ok:false},
      {n:"Read the change feed and MERGE incrementally",m:[80,30,55],verdict:"Best fit. Only changed rows are processed, deletes are explicit, and you can show which version carried each deletion.",ok:true},
      {n:"Set skipChangeCommits everywhere and move on",m:[90,10,10],verdict:"Cheap and green, but every deleted customer stays in gold. That fails the erasure requirement.",ok:false}]},
  {type:"spot", title:"Spot the mistakes", q:"Tap every wrong statement, then check.",
    items:[
      {t:"update_postimage holds the new value of an updated row.",bad:false,ex:"True."},
      {t:"The change data feed is a permanent audit history you never need to copy.",bad:true,ex:"Wrong. It follows table retention; VACUUM removes old change data."},
      {t:"A streaming table reading a Delta source fails when the source has deletes, unless you handle them.",bad:false,ex:"True. Use skipChangeCommits, a full refresh, or the change feed."},
      {t:"Materialized views need custom code to handle source deletes.",bad:true,ex:"Wrong. They handle deletes when they refresh."},
      {t:"Before a MERGE, keep only the latest change per key.",bad:false,ex:"True. Several commits can change the same key."},
      {t:"skipChangeCommits removes deleted rows from the downstream table.",bad:true,ex:"Wrong. It only skips the commit. You must delete downstream yourself."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Silver holds <code>customer</code> as SCD type 2. Gold holds <code>contract_margin_monthly</code> and a customer dimension that Power BI reads through a SQL warehouse. Dana Okafor (DPO) wants proof that a deleted customer disappears from every layer.</p>",
    qs:[
      {q:"How should a delete in silver reach the gold customer dimension?",opts:[
        {t:"Read silver’s change feed and MERGE deletes into gold, logging the commit version processed",ok:true,why:"Right. Explicit, incremental, and the version log is evidence for Dana."},
        {t:"Wait for the next quarterly rebuild",why:"Far too slow for an erasure request."},
        {t:"Ask Power BI users to filter the customer out",why:"The data would still be there and still visible."}]},
      {q:"contract_margin_monthly aggregates margin per customer and month. What should happen to an erased customer’s rows?",opts:[
        {t:"Remove or anonymise their customer-level rows; group totals can stay if no one can be identified from them",ok:true,why:"Right. Aggregates without identifiers are not personal data. Customer-level rows still identify the customer."},
        {t:"Keep them; gold is reporting, not personal data",why:"A row keyed by customer still identifies them."},
        {t:"Delete the whole month for everyone",why:"Over-deletion destroys valid reporting."}]}]}
  ]},
{ id:"lesson-3", short:"Permissions & Isolation", title:"Unity Catalog Permission Model and Isolation", badge:"AM", badgeName:"Access Modeller",
  goal:"Design catalogs, schemas, groups and grants for a regulated client, and isolate environments and regions so access mistakes cannot spread.",
  blocks:[
  {type:"poll", kind:"hook", q:"Halvorsen has about 900 report users. If every permission is granted to individual people, roughly how many grants will Raj’s team maintain?",
    opts:["About 10","About 900","Thousands, and nobody can review them"],
    reveal:"Thousands. Per-person grants grow with people × tables and become impossible to audit. Grant to groups that already exist in the identity provider, and the number of grants follows the number of roles instead."},
  {type:"concept", title:"The securable hierarchy", body:"<p>Unity Catalog names everything <code>catalog.schema.object</code> under a regional <b>metastore</b>. Privileges granted on a parent are <b>inherited</b> by everything inside it.</p><ul><li>To read a table you need <code>USE CATALOG</code> on its catalog, <code>USE SCHEMA</code> on its schema, and <code>SELECT</code> on it (or on a parent).</li><li><code>USE CATALOG</code> and <code>USE SCHEMA</code> do not give access to data by themselves.</li><li><code>BROWSE</code> lets people find objects and read metadata without data access.</li></ul>", diagram:"uch"},
  {type:"mcq", q:"An analyst has SELECT on hal_prod_eu.gold_service.case_daily but gets “permission denied”. What is the most likely cause?",
    opts:[{t:"She lacks USE CATALOG on hal_prod_eu or USE SCHEMA on gold_service",ok:true,why:"Right. SELECT is not enough. She must be able to enter the catalog and schema."},
          {t:"SELECT only works on views",why:"SELECT works on tables, views and materialized views."},
          {t:"She needs MODIFY to read",why:"MODIFY is for writing."},
          {t:"Gold tables can only be read by admins",why:"There is no such rule."}]},
  {type:"concept", title:"Principals, owners and least privilege", body:"<ul><li><b>Groups</b> come from Entra ID and sync into the Databricks account. Grant to groups, never to named people.</li><li><b>Service principals</b> run production pipelines and jobs. People do not write to production tables directly.</li><li><b>Owners</b> should be groups too, so access does not break when someone leaves.</li><li><b>MANAGE</b> lets a principal grant access, rename or drop an object. Give it to data owners, not to every user.</li><li><b>Least privilege</b>: grant at the lowest level that keeps the model simple, usually the schema.</li></ul>"},
  {type:"sort", kind:"build", title:"Pick the privilege", q:"Match each need to the privilege that meets it. Assume USE CATALOG and USE SCHEMA are already granted where needed.",
    buckets:[{k:"br",n:"BROWSE",s:"discover only"},{k:"se",n:"SELECT",s:"read data"},{k:"mo",n:"MODIFY",s:"write data"},{k:"ma",n:"MANAGE",s:"administer"}],
    items:[
      {t:"A new analyst wants to find out which customer tables exist before asking for access",k:"br",why:"BROWSE shows objects and metadata without any data."},
      {t:"Plant managers read gold_operations.oee_daily_plant in Power BI",k:"se",why:"Reading data is SELECT."},
      {t:"The production pipeline service principal writes silver_service tables",k:"mo",why:"Inserting, updating and deleting rows is MODIFY."},
      {t:"The finance data owner grants a new auditor group read access",k:"ma",why:"Granting privileges on an object needs MANAGE or ownership."},
      {t:"Dana’s team reads the erasure control table",k:"se",why:"Read-only access is SELECT."}]},
  {type:"concept", title:"Isolation: regions, environments, workspaces", body:"<ul><li><b>Region</b>: one metastore per region keeps metadata and governance regional. Each catalog gets its own managed storage location in that region. EU personal data stays in EU storage.</li><li><b>Environment</b>: separate catalogs per environment (<code>hal_dev_eu</code>, <code>hal_prod_eu</code>), so a test job cannot overwrite production.</li><li><b>Workspace-catalog binding</b>: set a catalog to ISOLATED and bind it only to the workspaces that need it. A binding can be read-only. Access from an unbound workspace is denied even if the user has grants.</li></ul>"},
  {type:"mcq", q:"Engineers in the dev workspace must read production gold to test reports, but must never write to it. What is the cleanest control?",
    opts:[{t:"Bind hal_prod_eu to the dev workspace read-only, and grant SELECT to the engineer group",ok:true,why:"Right. Even a mistaken grant cannot lead to a write from the dev workspace."},
          {t:"Copy production gold into the dev catalog every night",why:"A second copy of production data, PII included, to govern and erase."},
          {t:"Trust engineers not to write",why:"Not a control. The DPO and auditors want it enforced."},
          {t:"Give engineers MANAGE on production",why:"The opposite of least privilege."}]},
  {type:"spot", title:"Spot the mistakes", q:"A draft permission model for Halvorsen contains these lines. Tap every wrong one.",
    items:[
      {t:"Grants go to Entra ID groups such as hal_service_eu, not to named users.",bad:false,ex:"True. Groups scale and can be reviewed."},
      {t:"Each catalog uses its own managed storage location in its region.",bad:false,ex:"True. It keeps data where residency rules require."},
      {t:"Analysts get MODIFY on gold so they can fix numbers themselves.",bad:true,ex:"Wrong. Gold is written by pipelines. Fixes go through code review."},
      {t:"The production pipeline runs as a service principal.",bad:false,ex:"True."},
      {t:"USE SCHEMA on silver_service lets analysts read every table in it.",bad:true,ex:"Wrong. USE SCHEMA gives no data access without SELECT."},
      {t:"Table owner is set to the engineer who created it.",bad:true,ex:"Wrong. Owners should be groups so access survives staff changes."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>9 plants in two regions, 11 data staff, ~900 report users. Groups needed: plant users, operations, finance, service, the DPO’s team and the platform team. EU personal data must stay in the EU, and Dana wants access to be auditable.</p>",
    qs:[
      {q:"Which catalog layout fits?",opts:[
        {t:"Catalogs per environment and region (hal_prod_eu, hal_prod_na, hal_dev_eu …) with schemas per layer and domain",ok:true,why:"Right. It matches the week 1 standards, keeps regions apart and gives each domain a schema to own."},
        {t:"One catalog per plant",why:"Nine copies of the same structure and no group-wide view."},
        {t:"One catalog for everything, with folders per region",why:"Location and access separation would rely on discipline, not design."}]},
      {q:"Where should service analysts’ SELECT grant sit?",opts:[
        {t:"On the gold_service schema in their region’s catalog, to the regional service group",ok:true,why:"Right. One grant covers current and future tables in the schema, and the group follows Entra ID."},
        {t:"On every table, to each analyst",why:"Unreviewable and breaks with every new table or joiner."},
        {t:"On the whole metastore",why:"Far too broad; they would see finance and HR data."}]}]}
  ]},
{ id:"lesson-4", short:"PII & Audit", title:"PII Protection, Auditing and Compliance", badge:"PG", badgeName:"Privacy Guardian",
  goal:"Protect personal data with masks, row filters and tag-based policies, tell pseudonymised from anonymised data, prove who accessed what, and carry out an erasure request.",
  blocks:[
  {type:"poll", kind:"hook", q:"Dana Okafor asks: “Who looked at customer email addresses last quarter?” With today’s spreadsheet exports, how long would Halvorsen take to answer?",
    opts:["A few minutes","A few days of asking around","It cannot be answered"],
    reveal:"It cannot be answered. Once data sits in a spreadsheet, nobody logs who opens it. Governed tables with masks and audit logs make the question answerable with one query."},
  {type:"concept", title:"Column masks and row filters", body:"<p>Both are SQL functions attached to a table. They run on every query, from any tool: notebooks, SQL warehouses, Power BI, Genie.</p><ul><li><b>Column mask</b>: a function that returns the real or a masked value. <code>ALTER TABLE t ALTER COLUMN email SET MASK mask_email</code>. One mask per column.</li><li><b>Row filter</b>: a function that returns true or false per row. <code>ALTER TABLE t SET ROW FILTER region_filter ON (region)</code>. Rows that return false are not returned.</li><li>Use <code>is_account_group_member('group')</code> inside the function to decide who sees what.</li></ul>"},
  {type:"mcq", q:"What must a row filter function return?",
    opts:[{t:"A boolean: true keeps the row, false hides it",ok:true,why:"Right. The function receives the columns you name in ON (…) and decides per row."},
          {t:"A masked copy of the row",why:"That is closer to what a column mask does, for one column."},
          {t:"A list of allowed users",why:"Membership is checked inside the function, but it returns a boolean."},
          {t:"A view name",why:"Row filters are attached to tables, not resolved to views."}]},
  {type:"concept", title:"Policies at scale: governed tags and ABAC", body:"<p>Attaching functions table by table does not scale to hundreds of tables. <b>Attribute-based access control (ABAC)</b> applies row filter and column mask policies by <b>governed tags</b>:</p><ul><li>Tag columns once, for example <code>pii = email</code>. Data classification can suggest tags by scanning for personal data.</li><li>Create one policy on the catalog: “mask every column tagged pii for all users except the DPO group”.</li><li>New tables that carry the tag are covered automatically, and table owners cannot remove the policy.</li></ul><p>ABAC row filter and column mask policies, governed tags and data classification became generally available in May 2026.</p>"},
  {type:"sort", kind:"build", title:"Choose the control", q:"Match each Halvorsen need to the control that fits best.",
    buckets:[{k:"m",n:"Column mask",s:"one column"},{k:"f",n:"Row filter",s:"which rows"},{k:"a",n:"ABAC policy",s:"by tag, many tables"},{k:"g",n:"Grant / no grant",s:"whole object"}],
    items:[
      {t:"Service analysts see only the domain of a contact’s email",k:"m",why:"Changing how one column’s values appear is a mask."},
      {t:"NA analysts see only North American customers",k:"f",why:"Hiding rows by attribute is a row filter."},
      {t:"Mask every column tagged pii across 200 silver and gold tables",k:"a",why:"One tag-based policy instead of 200 manual masks."},
      {t:"Plant users must not see the customer table at all",k:"g",why:"No SELECT grant. A filter is unnecessary when there is no access."},
      {t:"Finance sees phone numbers as *** except the last two digits",k:"m",why:"Partial masking of one column."}]},
  {type:"concept", title:"Pseudonymise or anonymise", body:"<p>Both reduce risk, but the law treats them differently.</p><ul><li>A <b>plain hash</b> of an email can be reversed by hashing a list of known emails. Use a <b>keyed hash or token</b>, with the key held by a separate team.</li><li>Pseudonymised data still needs grants, audit and erasure.</li><li>Anonymised data, such as monthly case counts per region with small groups suppressed, can be shared more widely.</li></ul>", diagram:"pii"},
  {type:"mcq", q:"The data science team replaces contact emails with sha2(email, 256), with no secret key. How should Dana classify the result?",
    opts:[{t:"Pseudonymised, and weakly: still personal data",ok:true,why:"Right. Anyone with a list of emails can hash them and match. A keyed hash or token is stronger, but even that is still pseudonymised."},
          {t:"Anonymised, so GDPR no longer applies",why:"Hashing an identifier without more does not anonymise it."},
          {t:"Encrypted, so it is safe to share externally",why:"Hashing is not encryption, and the values can be matched."},
          {t:"Deleted",why:"The record and its link to a person remain."}]},
  {type:"concept", title:"Auditing with system tables", body:"<ul><li><code>system.access.audit</code>: who did what, when. Key columns: <code>event_date</code>, <code>event_time</code>, <code>user_identity.email</code>, <code>service_name</code>, <code>action_name</code>, <code>request_params</code>. Unity Catalog events such as <code>getTable</code> name the table in <code>request_params['full_name_arg']</code>.</li><li><code>system.access.table_lineage</code> and <code>column_lineage</code>: which notebooks, jobs and queries read a table and where they wrote the result. A new target table built from customer data is a copy.</li><li>Filter on <code>event_date</code> for speed. Audit data is regional, like the workspaces.</li></ul>"},
  {type:"concept", title:"Right to erasure", body:"<p>A DELETE alone is not the end of the story. Delta keeps old file versions for time travel, and deletion vectors can mark rows deleted without rewriting files.</p>", diagram:"erase"},
  {type:"order", kind:"build", title:"Carry out an erasure", q:"Order the steps for a customer contact’s right-to-erasure request.",
    items:["Log the request in the erasure control table","Delete the person’s rows in bronze with MERGE against the control table","Propagate the deletes to silver and gold through the change feed","Run REORG TABLE … APPLY (PURGE) where deletion vectors are used","VACUUM so old file versions are removed after retention","Mark the request done and keep the evidence"],
    why:"Start at the source layer so a rebuild cannot bring the data back, propagate, then physically remove old files, and close with evidence the DPO can show a regulator."},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Column mask","Function on one column returning the real or masked value per user."],
    ["Row filter","Boolean function deciding which rows a user sees."],
    ["ABAC policy","Mask or filter applied by governed tag across many tables, set at catalog level."],
    ["Pseudonymised","Identifiers replaced but re-linkable; still personal data."],
    ["system.access.audit","System table of who did what and when, across the account."],
    ["REORG … APPLY (PURGE)","Rewrites files so rows marked by deletion vectors are physically removed."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Service analysts export Salesforce contacts to spreadsheets every week. The goal: zero PII in spreadsheets and auditable access. A former purchasing contact at an EU customer has asked to be erased.</p>",
    qs:[
      {q:"What replaces the weekly spreadsheet export?",opts:[
        {t:"A governed gold table with masks on contact columns, read through Power BI on a SQL warehouse",ok:true,why:"Right. Analysts keep their reports, PII stays masked unless they need it, and every query is logged."},
        {t:"A password on the spreadsheet",why:"Still a copy, still unlogged, still un-erasable."},
        {t:"Ban analysis of service data",why:"It kills the service-margin goal."}]},
      {q:"How do you show Dana the analysts stopped copying PII?",opts:[
        {t:"Lineage shows no new tables built from the customer table outside the pipeline, and the audit log shows reads only through approved paths",ok:true,why:"Right. Lineage reveals copies; the audit log reveals access. Together they are evidence, not a promise."},
        {t:"Ask analysts to confirm by email",why:"A promise, not evidence."},
        {t:"Count the Power BI reports",why:"Says nothing about copies."}]},
      {q:"The erased person appears in SCD2 history rows too. What do you do?",opts:[
        {t:"Delete or anonymise every version of their record, not only the current one, then purge and vacuum",ok:true,why:"Right. SCD2 deliberately keeps history; erasure must reach those rows too."},
        {t:"Close the current row; history is exempt",why:"History rows still hold their personal data."},
        {t:"Mask the column for analysts",why:"Masking hides it from some users but does not erase it."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T06 and change data. 90 seconds. Score 6 or more to earn the T06 Governance Guardian badge.",
    qs:[
      {q:"Which clause orders change events in AUTO CDC?",o:["KEYS","SEQUENCE BY","TRACK HISTORY ON"],a:1},
      {q:"In SCD type 2, what marks the current row?",o:["__END_AT is NULL","__START_AT is NULL","A row named current"],a:0},
      {q:"Which CDF change type do you NOT apply in a MERGE?",o:["update_postimage","delete","update_preimage"],a:2},
      {q:"Analyst has SELECT but no USE SCHEMA. Result?",o:["Query works","Permission denied","Read-only access"],a:1},
      {q:"Dev workspace may read prod but never write. Control?",o:["Read-only workspace binding","Nightly copy","MODIFY grant"],a:0},
      {q:"Mask every pii-tagged column in 200 tables. Tool?",o:["200 column masks","An ABAC policy","A view per table"],a:1},
      {q:"An email hashed with sha2, no key, is…",o:["Anonymised","Pseudonymised","Deleted"],a:1},
      {q:"Which system table shows who read a table?",o:["system.billing.usage","system.access.audit","system.compute.clusters"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T06",n:"T06 Governance Guardian"};

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
  box.appendChild(el("h2",null,"Can you govern it in 90 seconds?"));
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
  const head=el("header","head",`<span class="mono eyebrow">T06 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
