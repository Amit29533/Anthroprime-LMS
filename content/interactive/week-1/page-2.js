
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  silo:`<div class="silo"><div><b>Data warehouse</b><ul><li>Structured tables, fast SQL</li><li>Strong governance, transactions</li><li>Costly for raw or unstructured data</li><li>Proprietary storage format</li></ul></div><div><b>Data lake</b><ul><li>Cheap files in object storage</li><li>Any data: logs, images, JSON</li><li>No transactions or schema rules</li><li>Quality decays into a “swamp”</li></ul></div></div>`,
  stack:`<div class="stack"><div class="row"><div><b>Data engineering</b>Lakeflow · Spark · Photon</div><div><b>Warehousing / BI</b>SQL warehouses · Dashboards</div><div><b>Data science &amp; ML</b>Notebooks · MLflow</div><div><b>Real time</b>Streaming · Model Serving</div></div><div class="band uc">UNITY CATALOG: access control, lineage, audit for every engine above</div><div class="band st">OPEN STORAGE: Delta Lake / Apache Iceberg tables in your cloud object storage</div></div>`,
  med:`<div class="med"><div style="background:var(--bronze)"><b>BRONZE</b>Raw, as landed. Minimal checks. Kept for replay and audit.</div><span class="ar">→</span><div style="background:var(--silver)"><b>SILVER</b>Cleaned, deduplicated, conformed. Schema enforced.</div><span class="ar">→</span><div style="background:var(--gold)"><b>GOLD</b>Business-ready aggregates, metrics and ML feature tables.</div></div>`,
  flow:`<div class="flow"><span><b>Source</b>ERP · CRM · IoT</span><i>→</i><span><b>Ingest</b>Lakeflow Connect · Auto Loader</span><i>→</i><span><b>Process</b>Spark · Photon</span><i>→</i><span><b>Store</b>Delta / Iceberg medallion</span><i>→</i><span><b>Serve</b>SQL · Model Serving</span><i>→</i><span><b>Analyse</b>BI · Genie</span></div><div class="xbands"><div style="background:var(--sunk)">IDENTITY &amp; ORCHESTRATION</div><div style="background:var(--teal);color:#fff">UNITY CATALOG GOVERNANCE (CROSS-CUTTING)</div><div style="background:var(--sunk)">MONITORING &amp; COST: SYSTEM TABLES</div></div>`,
  couple:`<div class="silo"><div><b>Coupled</b><ul><li>Storage and compute live on the same machines</li><li>Need more storage? Buy more compute too</li><li>One cluster, sized for the busiest hour, runs all day</li></ul></div><div><b>Separated (Databricks)</b><ul><li>Data sits once in object storage</li><li>Each workload starts its own compute, then stops</li><li>Many engines read the same governed tables</li></ul></div></div>`,
  ladder:`<div class="ladder"><div><b>BATCH · hours</b>Scheduled runs. Cheapest, simplest. Month-end, nightly loads.</div><div><b>INCREMENTAL · minutes</b>Process only what is new, on a schedule or file arrival.</div><div><b>STREAMING · seconds</b>Always-on pipeline. Alerts, live monitoring.</div><div><b>REAL TIME · milliseconds</b>Model Serving answers one request at a time.</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Lakehouse & Medallion", title:"Lakehouse & Medallion", badge:"LB", badgeName:"Lakehouse Builder",
  goal:"Explain why the lakehouse exists, build its layers from memory, and place any dataset in bronze, silver or gold.",
  blocks:[
  {type:"poll", kind:"hook", q:"Your BI team and your ML team both need “customer orders”. In a typical company before a lakehouse, how many copies of that data exist?",
    opts:["One shared copy","Two or three","Nobody actually knows"],
    reveal:"Most architects answer “nobody knows”. Every team that couldn’t get what it needed made its own extract. This lesson is about ending that."},
  {type:"concept", title:"Two silos, one problem", body:"<p>Companies usually grew two platforms. A <b>data warehouse</b> serves BI with fast, governed SQL. A <b>data lake</b> stores everything else cheaply as files for data science. Each is good at what the other is bad at, so data gets copied between them and governed twice.</p>", diagram:"silo"},
  {type:"mcq", q:"A data lake of Parquet files gives the ML team cheap access to raw data. What does it typically lack that the warehouse provides?",
    opts:[{t:"ACID transactions and reliable governance",ok:true,why:"Right. Plain files can be half-written, overwritten or read inconsistently, and access rules are hard to enforce per table."},
          {t:"Support for unstructured data",why:"Lakes are good at this. Images, logs and JSON are why lakes exist."},
          {t:"Low storage cost",why:"Object storage is the cheapest place to keep data. Cost is a lake strength."},
          {t:"Open file formats",why:"Parquet is open. Proprietary formats are a warehouse trait."}]},
  {type:"concept", title:"The lakehouse: one copy, many engines", body:"<p>A lakehouse keeps <b>one governed copy</b> of data in open storage and lets every workload bring the right compute to it. Three layers make that work:</p><ul><li><b>Open storage</b>: Delta Lake or Apache Iceberg tables on cloud object storage. The table format adds transactions, schema enforcement and time travel to plain files.</li><li><b>Unity Catalog</b>: one layer for permissions, lineage and audit, applied to every engine.</li><li><b>Workload engines</b>: SQL warehouses, Spark pipelines, ML, streaming, each sized for its own job.</li></ul>", diagram:"stack",
    analogy:"Think of an airport. Every flight shares the runway and the control tower (storage and governance). Cargo jets and short hops still use different gates and fuel loads (compute)."},
  {type:"order", kind:"build", title:"Build the stack", q:"Put the lakehouse layers in order, starting with the foundation at position 1.",
    items:["Cloud object storage","Open table format (Delta Lake / Iceberg)","Unity Catalog governance","Workload engines (SQL, Spark, ML, streaming)"],
    why:"Files sit in object storage. The table format makes them reliable tables. Unity Catalog governs those tables. Engines run on top and inherit the governance."},
  {type:"mcq", q:"What does the open table format layer add on top of plain files in object storage?",
    opts:[{t:"Transactions, schema enforcement and time travel",ok:true,why:"Right. Delta Lake and Iceberg keep a transaction log next to the files, which is what makes them behave like database tables."},
          {t:"Compute to run queries",why:"Compute is a separate layer. The table format is just files plus a log."},
          {t:"Dashboards for business users",why:"Dashboards belong to the BI engine on top."},
          {t:"User sign-in and identity",why:"Identity comes from the client’s identity provider, enforced through Unity Catalog."}]},
  {type:"concept", title:"Inside storage: bronze, silver, gold", body:"<p>The <b>medallion architecture</b> organises tables by how refined they are. Data flows left to right and quality rises at every hop. Bronze keeps the original so you can always rebuild silver and gold if logic changes.</p>", diagram:"med"},
  {type:"sort", kind:"build", title:"Refinery sort", q:"Drag each dataset into its medallion layer. On a phone, tap a dataset, then tap a layer.",
    buckets:[{k:"b",n:"Bronze",s:"raw, as landed"},{k:"s",n:"Silver",s:"cleaned, conformed"},{k:"g",n:"Gold",s:"business-ready"}],
    items:[
      {t:"IoT sensor JSON, exactly as received",k:"b",why:"Unchanged source data lands in bronze."},
      {t:"Nightly ERP extract plus a load timestamp",k:"b",why:"Adding load metadata doesn’t refine the data. It is still raw."},
      {t:"Sensor readings deduplicated, units converted to °C",k:"s",why:"Cleaning and standardising is the silver step."},
      {t:"ERP orders joined to plant master data",k:"s",why:"Conforming records to shared reference data is silver work."},
      {t:"Customer rows with invalid emails quarantined",k:"s",why:"Applying quality rules happens on the way into silver."},
      {t:"Daily OEE by plant for the dashboard",k:"g",why:"An aggregated business metric is gold."},
      {t:"Feature table for the maintenance model",k:"g",why:"Purpose-built ML features are a gold product."},
      {t:"Monthly revenue by region",k:"g",why:"A reporting aggregate is gold."}]},
  {type:"concept", title:"A default, not a law", body:"<p>Databricks documents medallion as a <b>recommended pattern</b>, not a mandate. A good architect can say when a dataset legitimately skips a layer and why. Examples: a small, already-validated reference file can be treated as silver quality on arrival; some teams add an extra layer for curated data products. Either way, the reason must be stated.</p>"},
  {type:"mcq", q:"A vendor sends an already-validated list of country codes. A colleague insists it must sit in bronze and go through a full silver pipeline. What is the best response?",
    opts:[{t:"Land it once with lineage, treat it as silver quality, and keep a raw copy only if audit or replay needs it",ok:true,why:"Right. The pattern serves a purpose. Here, the purpose (cleaning) is already met, so you justify the shortcut instead of adding empty steps."},
          {t:"Agree. Every dataset must pass through all three layers",why:"That treats a recommendation as a rule and adds cost with no benefit."},
          {t:"Load it straight into a BI tool and skip Databricks",why:"Then it is ungoverned and can’t be joined to governed tables."},
          {t:"Put it in gold because it is small",why:"Size doesn’t decide the layer. Refinement level and purpose do."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Lakehouse","One governed copy of data in open storage, with the right compute per workload on top."],
    ["Delta Lake","Open table format: files plus a transaction log, giving ACID, schema enforcement and time travel."],
    ["Unity Catalog","Single governance layer: permissions, lineage and audit across engines and workspaces."],
    ["Bronze","Raw data as landed. Kept so silver and gold can be rebuilt."],
    ["Silver","Cleaned, deduplicated, conformed data. Ready for analysts and data scientists."],
    ["Gold","Aggregated, business-ready metrics and feature tables."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p><b>9 plants, no single OEE.</b> 2,400 sensors stream into per-plant historians and are never joined to ERP or maintenance data. SAP data loads nightly into a SQL Server warehouse. Each plant builds OEE in spreadsheets, using three different definitions.</p><p>The monthly group OEE takes 4 working days to reconcile, and unplanned downtime costs an estimated $38M a year.</p>",
    qs:[
      {q:"Where should raw sensor data from all 9 plants land first?",opts:[
        {t:"A bronze table, ingested incrementally as received",ok:true,why:"Right. Land it once, untouched, so every downstream use reads the same source and you can replay it."},
        {t:"Straight into the gold OEE table",why:"You’d lose the raw record and couldn’t fix a bad calculation later."},
        {t:"Leave it in the historians and extract weekly",why:"That is the current problem: stale, per-plant copies."}]},
      {q:"Which layer should hold the single agreed definition of OEE?",opts:[
        {t:"Gold",ok:true,why:"Right. A business metric with one agreed formula is a gold product, owned and governed in one place."},
        {t:"Bronze",why:"Bronze holds raw data. No metrics are calculated there."},
        {t:"Each plant’s spreadsheet",why:"That is how Halvorsen ended up with three definitions."}]},
      {q:"How should Halvorsen’s two data scientists get sensor data for the predictive-maintenance model?",opts:[
        {t:"Train from gold feature tables built on the same governed data",ok:true,why:"Right. No extract, no copy: the model reads current, governed features."},
        {t:"Give them CSV exports from each historian",why:"A copy per plant, ungoverned, and stale as soon as it is made."},
        {t:"Let them query the historians directly",why:"Per-plant, ungoverned, and it loads production systems."}]}]}
  ]},
{ id:"lesson-2", short:"Reference Architecture", title:"Reference & Platform Architecture", badge:"PM", badgeName:"Platform Mapper",
  goal:"Draw the six-layer reference flow, choose the right ingestion door, and explain how Unity Catalog governs all of it.",
  blocks:[
  {type:"poll", kind:"hook", q:"A client CIO asks: “So what does Databricks replace?” What is the safest first answer?",
    opts:["“Your data warehouse and BI tools”","“Probably nothing on day one. It becomes the shared layer between your sources and your users.”","“Everything in your data stack”"],
    reveal:"The second answer wins trust. Source systems, identity and existing BI usually stay. Databricks becomes the governed layer in the middle. Promising replacement before discovery is how architects lose rooms."},
  {type:"concept", title:"The six-layer flow", body:"<p>Every Databricks reference architecture reads left to right in six steps, with three concerns that cut across all of them. Learn it so you can redraw it, then adapt it to each client by naming what stays outside Databricks.</p>", diagram:"flow"},
  {type:"order", kind:"build", title:"Rebuild the flow", q:"Put the six layers in the order data travels.",
    items:["Source","Ingest","Process","Store","Serve","Analyse"],
    why:"Data starts in source systems, is brought in, transformed, stored as medallion tables, served through SQL or model endpoints, and finally consumed by people and tools."},
  {type:"concept", title:"Three doors for ingestion", body:"<ul><li><b>Lakeflow Connect</b>: managed connectors for SaaS apps and databases (for example Salesforce, Workday, SQL Server). No custom API code.</li><li><b>Auto Loader</b>: picks up new files as they land in cloud storage, processing only what is new and handling schema changes.</li><li><b>Structured Streaming</b>: reads event streams such as Kafka, Kinesis or Event Hubs with second-level latency.</li></ul>",
    analogy:"Connect is the delivery service with an account at each supplier. Auto Loader is the mailroom that opens only new post. Streaming is the conveyor belt that never stops."},
  {type:"sort", kind:"build", title:"Pick the door", q:"Match each source to the ingestion tool you would choose.",
    buckets:[{k:"c",n:"Lakeflow Connect",s:"managed connectors"},{k:"a",n:"Auto Loader",s:"new files in storage"},{k:"st",n:"Structured Streaming",s:"event streams"}],
    items:[
      {t:"Salesforce opportunities synced daily, no API code",k:"c",why:"A SaaS source with a managed connector is Lakeflow Connect’s job."},
      {t:"Changes from an on-prem SQL Server ERP database",k:"c",why:"Lakeflow Connect includes database connectors that capture changes."},
      {t:"CSV files dropped hourly into a storage bucket",k:"a",why:"Files arriving in cloud storage is exactly what Auto Loader watches for."},
      {t:"Partner JSON files that sometimes gain new columns",k:"a",why:"Auto Loader handles schema inference and evolution for files."},
      {t:"Clickstream events from Kafka, needed within seconds",k:"st",why:"A continuous event bus with low latency needs Structured Streaming."},
      {t:"Machine telemetry published to Event Hubs",k:"st",why:"Event Hubs is a streaming source."}]},
  {type:"concept", title:"Governance wraps everything", body:"<p><b>Unity Catalog</b> is the cross-cutting layer. One metastore per region can be attached to many workspaces, so a permission is set once and holds everywhere.</p><ul><li><b>Three-level names</b>: catalog.schema.table, for example <code>plants.berlin.oee_daily</code>.</li><li><b>Lineage</b>: tracked automatically down to column level.</li><li><b>System tables</b>: audit logs, billing usage and job history you can query with SQL.</li></ul>"},
  {type:"mcq", q:"Finance asks which dashboards will break if a column in silver.orders is renamed. Where do you find out?",
    opts:[{t:"Unity Catalog lineage for that column",ok:true,why:"Right. Column-level lineage shows every downstream table, notebook and dashboard that reads it."},
          {t:"Ask each BI developer",why:"Slow and incomplete. Lineage answers it in seconds."},
          {t:"The cloud storage access logs",why:"Those show file reads, not which dashboard depends on which column."},
          {t:"Rename it and watch for errors",why:"That finds out in production, the most expensive place."}]},
  {type:"mcq", q:"Which team’s jobs drove last month’s spend? Where do you look first?",
    opts:[{t:"The billing usage system table",ok:true,why:"Right. System tables record usage by workspace, job and tag, queryable with plain SQL."},
          {t:"The cloud provider invoice",why:"It shows the total, not which team or job caused it."},
          {t:"Unity Catalog lineage",why:"Lineage tracks data dependencies, not cost."},
          {t:"Each cluster’s Spark UI",why:"Useful for tuning one job, not for spend across teams."}]},
  {type:"sort", title:"Inside or outside?", q:"For a typical client, which of these become part of the Databricks platform and which usually stay where they are?",
    buckets:[{k:"in",n:"Inside Databricks",s:"built or governed there"},{k:"out",n:"Usually stays outside",s:"integrated, not replaced"}],
    items:[
      {t:"Source ERP and CRM systems",k:"out",why:"Sources keep running. Databricks reads from them."},
      {t:"Corporate identity provider (Entra ID, Okta)",k:"out",why:"Identity stays; users and groups sync into Databricks."},
      {t:"An existing Power BI or Tableau estate",k:"out",why:"BI tools connect to SQL warehouses. Replacing them is optional."},
      {t:"Bronze, silver and gold tables",k:"in",why:"The medallion tables are the heart of the platform."},
      {t:"Table and column permissions",k:"in",why:"Access control lives in Unity Catalog."},
      {t:"Ingestion and transformation pipelines",k:"in",why:"Lakeflow pipelines run inside Databricks."}]},
  {type:"spot", title:"Spot the mistakes", q:"Tap every statement that is wrong, then check.",
    items:[
      {t:"Unity Catalog applies one set of permissions across workspaces attached to the same metastore.",bad:false,ex:"True. That is the point of a shared metastore."},
      {t:"Adopting Databricks means replacing the client’s BI tool.",bad:true,ex:"Wrong. BI tools connect to SQL warehouses and often stay."},
      {t:"Auto Loader is designed for files landing in cloud storage.",bad:false,ex:"True."},
      {t:"Lineage is tracked only at table level, not for columns.",bad:true,ex:"Wrong. Unity Catalog captures column-level lineage."},
      {t:"System tables can be queried with SQL like any other table.",bad:false,ex:"True."},
      {t:"Each workspace needs its own copy of the data to be governed.",bad:true,ex:"Wrong. One copy, governed once, shared across workspaces."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>SAP must not be changed and the plant historians stay where they are. EU personal data must stay in the EU, while group reporting needs OEE across both regions.</p>",
    qs:[
      {q:"Where do the plant historians sit in the six-layer flow?",opts:[
        {t:"Source",ok:true,why:"Right. They stay put and become a source that Databricks ingests from."},
        {t:"Store",why:"Store is the medallion tables in Databricks, not the historians."},
        {t:"Serve",why:"Serve is how refined data reaches users."}]},
      {q:"How should Unity Catalog be laid out?",opts:[
        {t:"Catalogs per region and environment, EU data stored in an EU region, with group reporting granted read access to the gold tables it needs",ok:true,why:"Right. Location rules are met by design, and group reporting gets one governed read path."},
        {t:"One catalog everyone can write to",why:"No ownership, no control. Errors from one plant affect all."},
        {t:"A separate workspace and data copy per plant",why:"That rebuilds the silos the lakehouse removes, nine times over."}]}]}
  ]},
{ id:"lesson-3", short:"Compute & Data Intelligence", title:"Compute/Storage Separation & the Data Intelligence Platform", badge:"CS", badgeName:"Compute Strategist",
  goal:"Show why separating compute from storage cuts cost, match each workload to the right compute, and explain what makes the platform ‘intelligent’.",
  blocks:[
  {type:"poll", kind:"hook", q:"A cluster is sized for the Monday 9 a.m. reporting rush and runs 24/7. What is it doing at 3 a.m. on Sunday?",
    opts:["Processing overnight jobs","Sitting idle and still billing","Shutting itself down"],
    reveal:"In most estates, it is idle and still billing. Separating compute from storage is what lets you stop paying for the quiet hours."},
  {type:"concept", title:"Coupled vs separated", body:"<p>In older warehouses and Hadoop clusters, storage and compute lived on the same machines. Growth in one forced growth in the other, and the cluster ran all day at peak size. In Databricks, data sits once in object storage. Compute starts when a workload needs it, scales with the load, and stops afterwards.</p>", diagram:"couple"},
  {type:"calc", kind:"build", title:"Idle-cost calculator", q:"Drag the slider to the number of hours per day the cluster is actually busy.",
    note:"Illustrative: one cluster at $30 per hour, 30-day month. Real rates vary by cloud, size and contract."},
  {type:"mcq", q:"Using the calculator’s logic, what mostly drives the saving from separating compute?",
    opts:[{t:"Paying only for the hours each workload runs",ok:true,why:"Right. Auto-stop and per-workload compute remove the idle hours from the bill."},
          {t:"Cheaper storage",why:"Storage costs barely change. The idle compute is the big number."},
          {t:"Faster queries",why:"Speed helps, but the main saving is not paying when nothing runs."},
          {t:"Fewer users",why:"User count isn’t what the calculator changed."}]},
  {type:"concept", title:"The compute menu", body:"<ul><li><b>Serverless SQL warehouse</b>: for BI and SQL. Starts in seconds, scales with concurrent users, stops when idle.</li><li><b>Jobs compute</b>: for scheduled pipelines. Created for the run, terminated when it ends.</li><li><b>All-purpose compute</b>: for interactive notebook work during development.</li><li><b>Model Serving</b>: endpoints that return predictions in milliseconds.</li></ul><p><b>Photon</b> is the vectorised engine that speeds up SQL and DataFrame work on these.</p>"},
  {type:"sort", kind:"build", title:"Right-size it", q:"Match each workload to the compute you would recommend.",
    buckets:[{k:"sql",n:"Serverless SQL warehouse"},{k:"job",n:"Jobs compute"},{k:"ap",n:"All-purpose compute"},{k:"ms",n:"Model Serving"}],
    items:[
      {t:"Analysts refreshing dashboards in bursts all day",k:"sql",why:"Spiky SQL concurrency is what serverless warehouses scale for."},
      {t:"Nightly ETL that runs for 40 minutes",k:"job",why:"Scheduled work belongs on compute that exists only for the run."},
      {t:"A data scientist exploring data in a notebook",k:"ap",why:"Interactive development is the all-purpose use case."},
      {t:"A fraud score returned to a payment app in 50 ms",k:"ms",why:"Per-request, millisecond predictions need a serving endpoint."}]},
  {type:"mcq", q:"Why is running nightly ETL on a shared all-purpose cluster usually a poor choice?",
    opts:[{t:"Jobs compute costs less, isolates the run and shuts down when done",ok:true,why:"Right. Isolation avoids noisy neighbours, and you don’t pay for the cluster after the job ends."},
          {t:"All-purpose clusters can’t run Spark",why:"They can. The issue is cost and isolation."},
          {t:"ETL must always use SQL warehouses",why:"SQL warehouses are for SQL serving. Pipelines usually use jobs compute."},
          {t:"There is no difference",why:"Price and lifecycle differ significantly."}]},
  {type:"concept", title:"What makes it a Data Intelligence Platform", body:"<p>Because every table, column, owner, lineage edge and usage record lives in Unity Catalog, AI features can understand your data in business terms. <b>Genie</b> answers natural-language questions by generating SQL against governed tables. The <b>Databricks Assistant</b> writes and explains code with knowledge of your schemas.</p><p>All of it runs <b>under the asking user’s permissions</b>. Unified metadata is what makes this possible; skipping governance breaks it.</p>",
    analogy:"A good librarian can answer “what do we have on X?” only because the catalogue is complete. Genie is the librarian; Unity Catalog is the catalogue."},
  {type:"mcq", q:"A sales manager asks Genie for revenue by plant, including plants she isn’t allowed to see. What happens?",
    opts:[{t:"She gets only the rows her Unity Catalog permissions allow",ok:true,why:"Right. Genie’s queries run under her identity, so row filters, column masks and grants all apply."},
          {t:"Genie returns everything because it is an admin tool",why:"Genie doesn’t bypass governance."},
          {t:"Genie refuses all questions about revenue",why:"It answers within her permissions."},
          {t:"She gets a copy of the data exported to her laptop",why:"No copy is created. It is a governed query."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Compute/storage separation","Data stored once; compute starts, scales and stops per workload."],
    ["Serverless SQL warehouse","Elastic SQL compute for BI, fast to start, stops when idle."],
    ["Jobs compute","Compute created for a scheduled run and terminated after."],
    ["Photon","Vectorised query engine that accelerates SQL and DataFrame workloads."],
    ["Genie","Natural-language questions answered as governed SQL over Unity Catalog tables."],
    ["System tables","Queryable records of audit, billing usage and job runs."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Plant managers open the OEE report in Power BI in a burst before 07:00. The maintenance model will retrain once a week. Raj’s data team develops new pipelines in notebooks.</p>",
    qs:[
      {q:"Which compute plan fits?",opts:[
        {t:"Serverless SQL warehouse for dashboards, jobs compute for weekly retraining, all-purpose for development",ok:true,why:"Right. Each workload gets compute shaped to its pattern, all reading the same governed tables."},
        {t:"One large always-on cluster for everything",why:"That is the idle-cost problem from the calculator."},
        {t:"Model Serving for the dashboards",why:"Model Serving returns predictions, not dashboard queries."}]},
      {q:"The CIO wants to ask “which plant had the worst OEE last week?” in plain English. What must be true first?",opts:[
        {t:"Gold OEE tables are governed and described in Unity Catalog",ok:true,why:"Right. Genie is only as good as the metadata and definitions underneath it."},
        {t:"Each plant exports a CSV to Genie",why:"That bypasses governance and the single definition."},
        {t:"The data must be moved into a separate AI tool",why:"Genie works on the governed tables in place."}]}]}
  ]},
{ id:"lesson-4", short:"Workloads & Trade-offs", title:"Workload Patterns & Architecture Trade-offs", badge:"TT", badgeName:"Trade-off Thinker",
  goal:"Choose the latency pattern each requirement really needs and defend the cost and complexity you accept for it.",
  blocks:[
  {type:"poll", kind:"hook", q:"When a client says they need “real time”, what do they usually mean?",
    opts:["Milliseconds","A few seconds","Fresher than what they have today"],
    reveal:"Usually the third. “Real time” often means “not tomorrow morning”. Your first job is to ask which decision changes if the data is fresher, and by how much."},
  {type:"concept", title:"Four latency patterns", body:"<p>Each step down the ladder buys fresher data and costs more money and operational effort. Pick the slowest pattern that still meets the business need.</p>", diagram:"ladder"},
  {type:"sort", kind:"build", title:"Latency ladder", q:"Place each requirement on the pattern it really needs.",
    buckets:[{k:"b",n:"Batch",s:"hours"},{k:"i",n:"Incremental",s:"minutes"},{k:"s",n:"Streaming",s:"seconds"},{k:"r",n:"Real time",s:"milliseconds"}],
    items:[
      {t:"Month-end finance close",k:"b",why:"Runs on a fixed calendar; hours are fine."},
      {t:"Nightly ERP reconciliation",k:"b",why:"Once a night by definition."},
      {t:"Hourly OEE dashboard refresh",k:"i",why:"Process only new data each hour. No need for an always-on stream."},
      {t:"Pick up partner files every 15 minutes",k:"i",why:"Scheduled incremental ingestion with Auto Loader fits."},
      {t:"Alert if a machine’s vibration spikes within 10 seconds",k:"s",why:"A continuous condition check needs streaming."},
      {t:"Approve or decline a card payment in 50 ms",k:"r",why:"A per-request decision needs Model Serving."}]},
  {type:"concept", title:"The trade-off triangle", body:"<p>Every architecture choice moves three dials: <b>freshness</b>, <b>cost</b> and <b>complexity</b>. Lower latency means compute running for longer and more moving parts to monitor. A strong architect names the dial they turned and why the business pays for it.</p>"},
  {type:"tradeoff", kind:"build", title:"Turn the dials", q:"Halvorsen’s plant managers need group OEE by 07:00 each morning and check it again after lunch. Pick a pattern and watch the dials.",
    opts:[
      {n:"Continuous streaming",m:[95,85,80],verdict:"Fresh to the second, but nobody looks more than twice a day. You pay for an always-on pipeline that adds nothing.",ok:false},
      {n:"Hourly incremental",m:[70,30,30],verdict:"Best fit. Fresh enough for every viewing, cheap, and only new data is processed.",ok:true},
      {n:"Nightly batch",m:[20,10,15],verdict:"Cheapest, but the after-lunch check shows yesterday’s numbers. That misses the requirement.",ok:false}]},
  {type:"mcq", q:"A client wants streaming for everything “to be future-proof”. What is the strongest response?",
    opts:[{t:"Stream only where a decision needs seconds; run the rest incrementally, which can switch to streaming later with little change",ok:true,why:"Right. The same Structured Streaming code can run on a schedule or continuously by changing the trigger, so you don’t pay for streaming before you need it."},
          {t:"Agree; streaming is always better",why:"It costs more and adds operational load without business benefit."},
          {t:"Refuse streaming entirely",why:"Some needs, like machine alerts, really do need it."},
          {t:"Tell them to decide later and build nothing",why:"Delays value. You can build incrementally now."}]},
  {type:"spot", title:"Spot the mistakes", q:"An architect’s proposal contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"Medallion layers are mandatory for every dataset.",bad:true,ex:"Wrong. Recommended pattern, deviate with a reason."},
      {t:"Serverless SQL warehouses suit spiky BI load.",bad:false,ex:"True."},
      {t:"Real-time fraud scoring can read from a nightly batch export.",bad:true,ex:"Wrong. A nightly export is up to a day old."},
      {t:"Incremental processing handles only data that is new since the last run.",bad:false,ex:"True."},
      {t:"One governed copy can serve BI and ML at the same time.",bad:false,ex:"True. That is the lakehouse."},
      {t:"To keep ML fast, give data science its own unmanaged copy of gold tables.",bad:true,ex:"Wrong. That recreates the silo and breaks governance."}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of T01. 90 seconds. Score 6 or more to earn the T01 Architect badge.",
    qs:[
      {q:"What gives files in object storage transactions and time travel?",o:["An open table format like Delta Lake","Unity Catalog","A SQL warehouse"],a:0},
      {q:"Which layer holds data exactly as received?",o:["Gold","Bronze","Silver"],a:1},
      {q:"New CSV files land in a bucket every hour. Which tool?",o:["Model Serving","Lakeflow Connect","Auto Loader"],a:2},
      {q:"Where do you check which dashboards use a column?",o:["Unity Catalog lineage","Billing system table","Spark UI"],a:0},
      {q:"Best compute for a nightly 40-minute pipeline?",o:["All-purpose cluster","Jobs compute","Model Serving"],a:1},
      {q:"Genie answers run under whose permissions?",o:["A workspace admin’s","The asking user’s","Nobody’s; it is read-only"],a:1},
      {q:"Hourly dashboard refresh needs which pattern?",o:["Streaming","Real time","Incremental"],a:2},
      {q:"What mostly drives savings from compute/storage separation?",o:["Cheaper storage","Not paying for idle compute","Fewer tables"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"T01",n:"T01 Architect"};

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
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: T01 Architect.":"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">T01 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
