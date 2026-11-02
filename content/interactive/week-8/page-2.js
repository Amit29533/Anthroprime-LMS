
/* ---------- LESSON DATA (authoring layer: new modules only change this) ---------- */
const DIAG = {
  topo:`<div class="stack"><div class="band st">DATABRICKS ACCOUNT: identities, metastores, networking and policies are managed here, once</div><div class="row" style="grid-template-columns:1fr 1fr"><div><b>Metastore · EU region</b>Top-level Unity Catalog container for the region</div><div><b>Metastore · NA region</b>One per region you operate in</div></div><div class="row" style="grid-template-columns:1fr 1fr 1fr 1fr"><div><b>Workspace</b>eu-dev</div><div><b>Workspace</b>eu-prod</div><div><b>Workspace</b>na-dev</div><div><b>Workspace</b>na-prod</div></div><div class="band uc">CATALOGS live in a metastore; bindings decide which workspace can see which catalog</div></div>`,
  net:`<div class="flow"><span><b>Users</b>Offices and plants over ExpressRoute</span><i>→</i><span><b>Front-end</b>Private Link to the workspace UI and APIs</span><i>→</i><span><b>Control plane</b>Run by Databricks</span><i>→</i><span><b>Back-end</b>Private Link from compute to control plane</span><i>→</i><span><b>Classic compute</b>Your VNet (VNet injection), no public IPs</span><i>→</i><span><b>Storage</b>ADLS via private endpoint</span></div><div class="xbands"><div style="background:var(--sunk)">EGRESS: HUB FIREWALL FOR CLASSIC COMPUTE · NETWORK POLICY FOR SERVERLESS</div><div style="background:var(--teal);color:#fff">SERVERLESS: NETWORK CONNECTIVITY CONFIGURATION (NCC) WITH PRIVATE ENDPOINT RULES</div></div>`,
  netsilo:`<div class="silo"><div><b>Classic compute</b><ul><li>Runs in your Azure subscription</li><li>VNet injection puts it in your VNet</li><li>Secure cluster connectivity: no public IPs</li><li>Egress through your hub firewall</li></ul></div><div><b>Serverless compute</b><ul><li>Runs in Databricks’ subscription, same region</li><li>Reaches your storage through an NCC</li><li>NCC private endpoint rules, approved on the storage account</li><li>Egress limited by a network policy</li></ul></div></div>`,
  ident:`<div class="flow"><span><b>Entra ID</b>Users, groups, service principals</span><i>→</i><span><b>Automatic identity mgmt</b>Syncs into the account</span><i>→</i><span><b>Account groups</b>Assigned to workspaces</span><i>→</i><span><b>Unity Catalog grants</b>To groups, never to people</span></div><div class="xbands"><div style="background:var(--sunk)">SERVICE PRINCIPALS RUN PRODUCTION JOBS · MANAGED IDENTITIES REACH STORAGE</div></div>`,
  chain:`<div class="flow"><span><b>Managed identity</b>Held by an Access Connector</span><i>→</i><span><b>Storage credential</b>UC object that wraps it</span><i>→</i><span><b>External location</b>Credential + one ADLS path</span><i>→</i><span><b>Uses</b>Catalog managed storage, volumes, external tables</span></div><div class="xbands"><div style="background:var(--teal);color:#fff">GRANTS ON THE EXTERNAL LOCATION DECIDE WHO MAY USE THE PATH</div></div>`,
  cloud:`<div class="silo" style="grid-template-columns:1fr 1fr 1fr"><div><b>Azure</b><ul><li>VNet injection</li><li>Private Link</li><li>ADLS Gen2</li><li>Managed identity via Access Connector</li><li>Entra ID</li></ul></div><div><b>AWS</b><ul><li>Customer-managed VPC</li><li>AWS PrivateLink</li><li>Amazon S3</li><li>IAM role</li><li>Your IdP via SSO + SCIM</li></ul></div><div><b>GCP</b><ul><li>Customer-managed VPC</li><li>Private Service Connect</li><li>Cloud Storage</li><li>Google service account</li><li>Your IdP via SSO + SCIM</li></ul></div></div>`,
  mlops:`<div class="flow"><span><b>Train</b>Notebook or job on governed features</span><i>→</i><span><b>Track</b>MLflow run: params, metrics, model</span><i>→</i><span><b>Register</b>Unity Catalog model, new version</span><i>→</i><span><b>Alias</b>@champion points at a version</span><i>→</i><span><b>Serve</b>Batch job or Model Serving endpoint</span><i>→</i><span><b>Monitor</b>Inputs, predictions, outcomes</span></div><div class="xbands"><div style="background:var(--teal);color:#fff">UNITY CATALOG: ONE PERMISSION MODEL AND LINEAGE FOR DATA AND MODELS</div></div>`,
  serve:`<div class="ladder"><div><b>BATCH · nightly or hourly</b>Score a table with the @champion model. Cheapest.</div><div><b>STREAMING · seconds</b>Score new readings as they arrive.</div><div><b>ENDPOINT · milliseconds</b>Model Serving answers one request at a time.</div><div><b>MONITOR · always</b>Track drift and accuracy once outcomes arrive.</div></div>`
};

const LESSONS = [
{ id:"lesson-1", short:"Topology", title:"Account, Workspace & Metastore Topology", badge:"TP", badgeName:"Topology Planner",
  goal:"Lay out a client’s Databricks account, metastores, workspaces and catalogs per region, and explain why each boundary exists.",
  blocks:[
  {type:"poll", kind:"hook", q:"A client with plants in Europe and North America asks: “How many Databricks workspaces do we need?” What is the best first answer?",
    opts:["One, to keep it simple","One per plant","It depends on regions, environments and isolation needs. Let me ask three questions first."],
    reveal:"The third. Workspaces are cheap to create but each one adds networking, policies and admin work. The count follows from regions, environments (dev/prod) and the few hard isolation needs, not from org charts."},
  {type:"concept", title:"Four levels, four jobs", body:"<p>Learn the hierarchy top-down:</p><ul><li><b>Account</b>: one per company per cloud. Holds identities, metastores, network configurations and policies.</li><li><b>Metastore</b>: the top Unity Catalog container. Databricks recommends <b>one per cloud region</b>, and not reading metastores across regions.</li><li><b>Workspace</b>: where people and jobs work. Attached to exactly one metastore in its region.</li><li><b>Catalog</b>: the main unit of data separation inside a metastore, often per environment or domain.</li></ul>", diagram:"topo",
    analogy:"A company (account) has one head office per country (metastore). Each head office has several floors (workspaces). The filing cabinets (catalogs) belong to the office; locks decide which floor can open which cabinet."},
  {type:"mcq", q:"Halvorsen runs plants in the EU and North America on Azure. How many Unity Catalog metastores fit the recommended pattern?",
    opts:[{t:"Two: one for the EU region, one for the NA region",ok:true,why:"Right. One metastore per cloud region. Workspaces in each region attach to their own region’s metastore."},
          {t:"One global metastore for everything",why:"A metastore is regional. Reaching it from another region adds latency and complicates residency."},
          {t:"Nine, one per plant",why:"Plants are not regions. Use catalogs, schemas and grants to separate plant data inside a regional metastore."},
          {t:"One per workspace",why:"That was the old Hive metastore world. Unity Catalog shares one metastore across a region’s workspaces."}]},
  {type:"concept", title:"Why separate workspaces at all", body:"<p>Split workspaces only for a reason you can name:</p><ul><li><b>Environment</b>: dev and prod, so a test job cannot break production.</li><li><b>Region / residency</b>: data must be processed where it lives.</li><li><b>Network or compliance isolation</b>: a unit with different rules.</li><li><b>Blast radius and limits</b>: very large estates.</li></ul><p>Do not split by team or plant by default. Each workspace adds networking, policies and admin work for the 11-person team that has to run it.</p>"},
  {type:"sort", kind:"build", title:"Split or not?", q:"Sort each request: does it justify a separate workspace, or is it handled inside a workspace with catalogs and grants?",
    buckets:[{k:"w",n:"Separate workspace",s:"a real boundary"},{k:"c",n:"Catalogs and grants",s:"same workspace"}],
    items:[
      {t:"Production jobs must not be affected by developers’ experiments",k:"w",why:"Environment separation is the classic reason for a prod workspace."},
      {t:"EU personal data must be processed in the EU; NA data in NA",k:"w",why:"Residency is regional, and workspaces are regional."},
      {t:"Plant A3’s engineers should only see A3 tables",k:"c",why:"Grants and row filters do this inside one workspace."},
      {t:"Finance wants its own schema for margin tables",k:"c",why:"A schema or catalog with grants, not a workspace."},
      {t:"The service team wants a different colour theme",k:"c",why:"Not an isolation need at all."},
      {t:"A subsidiary under a separate regulator needs its own network rules",k:"w",why:"Different network and compliance rules are a valid workspace boundary."}]},
  {type:"concept", title:"Binding catalogs to workspaces", body:"<p>By default, every workspace attached to a metastore can reach every catalog in it (if the user has grants). <b>Workspace-catalog binding</b> limits a catalog to named workspaces. A user with SELECT on a prod table still cannot read it from the dev workspace. You can also bind a catalog <b>read-only</b> to a workspace, and bind external locations and storage credentials the same way.</p>"},
  {type:"mcq", q:"A developer has SELECT on hal_prod_eu tables. hal_prod_eu is bound only to the EU prod workspace. What happens when she queries it from the EU dev workspace?",
    opts:[{t:"Access is denied from dev, despite her grant",ok:true,why:"Right. Binding is checked before grants. That is the point: prod data is reachable only from prod."},
          {t:"The query works because she has SELECT",why:"Grants are necessary but not enough once a catalog is bound."},
          {t:"The query works but returns masked values",why:"Binding blocks access; it does not mask."},
          {t:"The catalog is copied to dev",why:"Nothing is copied. Binding is an access rule."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Account","Top level: identities, metastores, network configurations, policies. One per company per cloud."],
    ["Metastore","Top Unity Catalog container. Recommended: one per cloud region."],
    ["Workspace","Where users and jobs work. Attached to one metastore in its region."],
    ["Catalog","Main unit of data separation inside a metastore, e.g. hal_prod_eu."],
    ["Workspace-catalog binding","Limits a catalog to named workspaces, optionally read-only."],
    ["Delta Sharing","Shares tables across metastores, regions or accounts without copying pipelines."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Halvorsen has <b>five EU plants (A1–A5)</b> and <b>four NA plants (B1–B4)</b>. EU personal data must stay in the EU. Raj Bhatt’s 11-person team must run the platform. Group reporting needs all nine plants’ OEE in one place.</p>",
    qs:[
      {q:"Which layout fits?",opts:[
        {t:"One account; a metastore per region; dev and prod workspaces in each region",ok:true,why:"Right. Two real boundaries (region, environment) give four workspaces. Small enough for Raj’s team to run."},
        {t:"One workspace per plant per environment (18 workspaces)",why:"Plants are not boundaries. Eighteen networks and policy sets would swamp an 11-person team."},
        {t:"One EU workspace for everything, including NA data",why:"Possible legally for NA data, but it ignores latency, NA ownership and the regional pattern."}]},
      {q:"How does group reporting get NA plants’ OEE without moving NA raw data?",opts:[
        {t:"Share NA gold aggregates to the EU metastore with Delta Sharing",ok:true,why:"Right. Only the agreed gold tables cross; raw and personal data stay home."},
        {t:"Copy the NA bronze tables to EU nightly",why:"Moves far more data than needed, including anything personal."},
        {t:"Point the EU workspace at the NA metastore",why:"A workspace attaches to one metastore in its own region."}]}]}
  ]},
{ id:"lesson-2", short:"Network & Identity", title:"Networking & Identity on Azure (with AWS and GCP)", badge:"NI", badgeName:"Network & Identity Lead",
  goal:"Design private connectivity, egress control and identity for an Azure Databricks estate, and name the AWS and GCP equivalents.",
  blocks:[
  {type:"poll", kind:"hook", q:"A security architect asks: “Does any Databricks traffic touch the public internet?” What do you need to know before answering?",
    opts:["Nothing. The answer is always no","Whether compute is classic or serverless, and how users and storage are connected","Only the pricing tier"],
    reveal:"The second. Classic and serverless compute are connected differently, and user access, compute-to-control-plane and compute-to-storage are three separate paths. Answer each path."},
  {type:"concept", title:"Three paths to secure", body:"<p>Think in paths, not products:</p><ul><li><b>Front-end</b>: users and tools to the workspace. Private Link (front-end) keeps it off the internet.</li><li><b>Back-end</b>: classic compute to the Databricks control plane. Needs <b>VNet injection</b> and <b>secure cluster connectivity</b> (no public IPs), then back-end Private Link.</li><li><b>Data path</b>: compute to ADLS. Private endpoints on the storage account.</li></ul><p>Private Link on Azure needs the Premium tier.</p>", diagram:"net"},
  {type:"order", kind:"build", title:"Rebuild the user path", q:"Put the hops of a plant engineer’s query in order, from her laptop to the data.",
    items:["Laptop on the plant network","ExpressRoute to the Azure hub","Front-end Private Link to the workspace","Control plane schedules the query","Compute in the injected VNet","ADLS through a private endpoint"],
    why:"Users enter through the hub and front-end Private Link. The control plane hands work to compute in Halvorsen’s VNet, which reads storage privately."},
  {type:"concept", title:"Serverless is connected differently", body:"<p>Serverless compute runs in Databricks’ subscription in the same region, not in your VNet. To reach your storage privately you create a <b>network connectivity configuration (NCC)</b> in the account console, add <b>private endpoint rules</b> for each storage account, and approve them on the storage side. An NCC serves workspaces in one region. A <b>network policy</b> controls serverless egress: in restricted mode, serverless can reach only Unity Catalog locations and destinations you list.</p>", diagram:"netsilo"},
  {type:"mcq", q:"Halvorsen locks ADLS to private access only. Serverless SQL warehouses now fail to read tables. What is missing?",
    opts:[{t:"An NCC with an approved private endpoint rule to that storage account",ok:true,why:"Right. Serverless does not sit in Halvorsen’s VNet, so it needs its own private path through the NCC."},
          {t:"VNet injection for the SQL warehouse",why:"VNet injection applies to classic compute, not serverless."},
          {t:"A bigger SQL warehouse",why:"Size does not fix a network path."},
          {t:"A public IP on the storage account",why:"That reopens what security just closed."}]},
  {type:"concept", title:"Identity: sync groups, grant to groups", body:"<p>Entra ID stays the source of record. <b>Automatic identity management</b> syncs users, groups (including nested groups) and service principals into the account, and Databricks now recommends it over a SCIM app. Do not run both for the same identities.</p><ul><li><b>Groups</b> receive all grants. People join or leave groups in Entra ID.</li><li><b>Service principals</b> run production jobs and deployments, so nothing breaks when a person leaves.</li><li><b>Managed identities</b> (through an Access Connector) let Unity Catalog reach storage without secrets.</li></ul>", diagram:"ident"},
  {type:"sort", kind:"build", title:"Who should hold it?", q:"Match each need to the right kind of identity.",
    buckets:[{k:"g",n:"Entra group",s:"people"},{k:"sp",n:"Service principal",s:"automation"},{k:"mi",n:"Managed identity",s:"storage access"}],
    items:[
      {t:"SELECT on gold_operations for 120 plant analysts",k:"g",why:"Grant to a group; membership is managed in Entra ID."},
      {t:"Run the nightly SAP ingestion job in prod",k:"sp",why:"Production jobs run as a service principal, not a person."},
      {t:"CI/CD deploys bundles to the prod workspace",k:"sp",why:"Deployment automation uses a service principal."},
      {t:"Unity Catalog reads the EU prod ADLS account",k:"mi",why:"A storage credential backed by the Access Connector’s managed identity."},
      {t:"DPO’s audit team reads access logs",k:"g",why:"A group with SELECT on the audit system tables."},
      {t:"Power BI service refreshes the OEE model",k:"sp",why:"A service principal with read grants, not a shared personal login."}]},
  {type:"concept", title:"Same ideas on AWS and GCP", body:"<p>The design logic travels; the product names change. You need working knowledge for interviews:</p>", diagram:"cloud"},
  {type:"mcq", q:"An interviewer asks for the AWS equivalent of “VNet injection plus back-end Private Link”. Best answer?",
    opts:[{t:"A customer-managed VPC with secure cluster connectivity and back-end AWS PrivateLink",ok:true,why:"Right. On AWS the workspace uses your VPC, then PrivateLink connects compute to the control plane."},
          {t:"An S3 bucket policy",why:"That controls storage access, not the compute network path."},
          {t:"Private Service Connect",why:"That is the GCP name."},
          {t:"An IAM role",why:"IAM roles are identity for storage, not networking."}]},
  {type:"spot", title:"Spot the mistakes", q:"A design review contains these claims. Tap every wrong one, then check.",
    items:[
      {t:"Grant table access to individual users so it is easy to audit.",bad:true,ex:"Wrong. Grant to groups; audit who is in the group."},
      {t:"Production jobs should run as a service principal.",bad:false,ex:"True."},
      {t:"VNet injection also places serverless compute in our VNet.",bad:true,ex:"Wrong. Serverless is reached through an NCC."},
      {t:"Run SCIM and automatic identity management for the same groups to be safe.",bad:true,ex:"Wrong. Databricks recommends against it: duplicates and conflicts."},
      {t:"A storage credential on Azure can use a managed identity through an Access Connector.",bad:false,ex:"True."},
      {t:"Secure cluster connectivity means cluster nodes have no public IPs.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Halvorsen’s corporate network team runs hub VNets with Azure Firewall and ExpressRoute to all nine plants. Dana Okafor (DPO) wants to show auditors that no data path crosses the internet. Raj’s team will use serverless SQL warehouses for Power BI and classic jobs compute for pipelines.</p>",
    qs:[
      {q:"What does the network design need?",opts:[
        {t:"VNet injection and secure cluster connectivity in a spoke per region, front-end and back-end Private Link, storage private endpoints, and an NCC per region for serverless",ok:true,why:"Right. Every path is private, for both classic and serverless compute."},
        {t:"Public workspaces with IP access lists only",why:"IP lists restrict who connects but traffic still crosses the internet."},
        {t:"Private Link for users only",why:"Leaves the compute and storage paths open."}]},
      {q:"How do 900 Power BI users get access to gold tables?",opts:[
        {t:"Entra groups synced by automatic identity management, granted per gold schema",ok:true,why:"Right. One grant per group; joiners and leavers are handled in Entra ID."},
        {t:"900 individual grants",why:"Unmaintainable and impossible to audit."},
        {t:"One shared service account for everyone",why:"Destroys per-user audit, which the DPO needs."}]}]}
  ]},
{ id:"lesson-3", short:"Storage & Residency", title:"Storage, External Locations & Data Residency", badge:"RS", badgeName:"Residency Steward",
  goal:"Set up governed storage per region with storage credentials and external locations, and design for data residency and cost visibility.",
  blocks:[
  {type:"poll", kind:"hook", q:"A data engineer has the storage account key and reads Delta files directly from ADLS. What has he bypassed?",
    opts:["Nothing, files are files","Unity Catalog permissions, audit and lineage","Only performance optimisations"],
    reveal:"All governance. Databricks warns against giving users direct storage access to governed data. Access should go through Unity Catalog so it is permissioned, logged and traced."},
  {type:"concept", title:"The storage chain", body:"<p>Unity Catalog reaches ADLS through a chain of objects:</p><ul><li>An <b>Access Connector for Azure Databricks</b> holds a managed identity with a storage role on the account.</li><li>A <b>storage credential</b> wraps that identity inside Unity Catalog.</li><li>An <b>external location</b> pairs the credential with one ADLS path.</li><li>The location is then used for <b>catalog managed storage</b>, <b>volumes</b> (landing files) or external tables.</li></ul><p>Privileges on the credential decide who can create locations; privileges on the location decide who can use the path.</p>", diagram:"chain"},
  {type:"order", kind:"build", title:"Build the chain", q:"Put the setup steps in the order an admin performs them.",
    items:["Create the ADLS Gen2 account in the region","Create an Access Connector and give its identity a storage role","Create the storage credential in Unity Catalog","Create the external location for the path","Set it as the catalog’s managed storage","Grant groups on the catalog"],
    why:"Cloud resources first, then the Unity Catalog objects that point at them, then grants. Each step depends on the one before."},
  {type:"mcq", q:"Why give each catalog (e.g. hal_prod_eu) its own managed storage location?",
    opts:[{t:"So each environment and region writes to its own storage account, with its own access and lifecycle",ok:true,why:"Right. It keeps prod and dev data physically apart and makes residency and cost per storage account visible."},
          {t:"Because Unity Catalog cannot share storage",why:"It can; separating is a design choice for isolation."},
          {t:"To make queries faster",why:"Location does not change query speed much in the same region."},
          {t:"So users can read the files directly",why:"Users should never read governed files directly."}]},
  {type:"concept", title:"Residency is a design, not a checkbox", body:"<p>Residency means a named class of data is <b>stored and processed</b> only in an approved place. Make it real with layers that agree:</p><ul><li><b>Storage</b> in the right region, per catalog.</li><li><b>Compute</b> in workspaces of the same region.</li><li><b>Bindings</b> so other regions’ workspaces cannot reach it.</li><li><b>Sharing</b> only of agreed outputs, such as gold aggregates without personal data, with Delta Sharing.</li><li><b>Proof</b>: audit logs and lineage show where data went.</li></ul>"},
  {type:"sort", kind:"build", title:"Where may it go?", q:"Under Halvorsen’s rule “EU personal data stays in the EU”, can each dataset be shared to the NA region?",
    buckets:[{k:"stay",n:"Stays in the EU",s:"never shared out"},{k:"share",n:"May be shared",s:"after review"}],
    items:[
      {t:"Salesforce contacts for EU customers",k:"stay",why:"Personal data. Stays in the EU."},
      {t:"Field-visit records with technician names",k:"stay",why:"Employee names are personal data."},
      {t:"Daily OEE per EU plant",k:"share",why:"An aggregate with no personal data. Share after the DPO agrees."},
      {t:"Monthly contract margin per region",k:"share",why:"Business aggregate, no individuals."},
      {t:"Shift log with operator IDs per stoppage",k:"stay",why:"Operator IDs identify people."},
      {t:"Supplier defect rates by part",k:"share",why:"No personal data."}]},
  {type:"concept", title:"Cost tagging from day one", body:"<p>The CFO will ask what each region, plant domain and team costs. Tag before the first job runs:</p><ul><li><b>Workspace tags</b> (set in Azure) flow to compute and Azure cost reports.</li><li><b>Compute tags</b>, enforced with compute policies, on clusters, jobs and SQL warehouses.</li><li><b>Serverless usage policies</b> attach tags to serverless notebooks, jobs and pipelines.</li><li>Query the <b>billing usage system table</b> by tag.</li></ul><p>Never put personal data in tags.</p>"},
  {type:"mcq", q:"Priya Raman wants monthly cost split by domain (operations, service, finance, quality). What do you set up first?",
    opts:[{t:"A required domain tag through compute policies and serverless usage policies, reported from the billing system table",ok:true,why:"Right. Enforced tags make every DBU attributable; the system table makes it reportable."},
          {t:"A separate workspace per domain",why:"Workspaces are not a cost-allocation tool; tags are."},
          {t:"A spreadsheet maintained by Raj’s team",why:"Manual, late and disputed."},
          {t:"Nothing until the first invoice arrives",why:"Untagged history cannot be split later."}]},
  {type:"flash", title:"Recall: flip every card", cards:[
    ["Access Connector","Azure resource holding a managed identity that Unity Catalog uses to reach ADLS."],
    ["Storage credential","Unity Catalog object wrapping a cloud identity (managed identity or service principal)."],
    ["External location","A storage credential plus one storage path; grants control who uses it."],
    ["Managed storage location","Where a metastore, catalog or schema writes its managed tables."],
    ["Data residency","A data class is stored and processed only in an approved place."],
    ["Serverless usage policy","Applies custom tags to a user’s serverless usage for cost attribution."]]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>Halvorsen needs storage for dev and prod in each region. Supplier files and MES CSVs land as files first. Dana Okafor wants proof that EU personal data never leaves the EU. Priya Raman wants cost by region and domain.</p>",
    qs:[
      {q:"Which storage layout fits?",opts:[
        {t:"One ADLS account per region and environment, each with its own external locations; landing files in volumes; each catalog’s managed storage in its own account",ok:true,why:"Right. Clean isolation, residency by construction, cost visible per account."},
        {t:"One global storage account for all regions",why:"Breaks residency and mixes prod with dev."},
        {t:"One storage account per plant",why:"Nine-plus accounts of admin work with no matching boundary in the design."}]},
      {q:"What convinces the DPO?",opts:[
        {t:"EU catalogs bound only to EU workspaces, sharing limited to reviewed gold aggregates, with audit logs and lineage as evidence",ok:true,why:"Right. Controls at every layer, plus evidence."},
        {t:"A statement that the team will be careful",why:"Not a control and not evidence."},
        {t:"Encrypting the NA copy of EU data",why:"Encrypted or not, the data has left the EU."}]}]}
  ]},
{ id:"lesson-4", short:"MLOps Foundations", title:"MLOps Foundations: MLflow → Unity Catalog → Serving", badge:"ML", badgeName:"MLOps Starter",
  goal:"Explain the ML lifecycle on Databricks: track with MLflow, register in Unity Catalog with aliases, choose batch or endpoint serving, and monitor.",
  blocks:[
  {type:"poll", kind:"hook", q:"Halvorsen’s data scientists have a good bearing-failure model in a notebook. What usually stops it reaching production?",
    opts:["The algorithm is not advanced enough","No tracked versions, no owner, no way to deploy or roll back","Not enough GPUs"],
    reveal:"The second. Most models stall on lifecycle, not accuracy. MLflow and Unity Catalog give tracking, versions, aliases and permissions, so deployment and rollback become routine."},
  {type:"concept", title:"The lifecycle in six steps", body:"<p>Train on governed features, <b>track</b> each run with MLflow (parameters, metrics, the model itself), <b>register</b> a version in Unity Catalog as <code>catalog.schema.model</code>, point an <b>alias</b> such as <code>@champion</code> at the version to use, <b>serve</b> it in batch or behind an endpoint, and <b>monitor</b> inputs and outcomes.</p>", diagram:"mlops"},
  {type:"order", kind:"build", title:"Order the lifecycle", q:"Put the steps in order for a new model version.",
    items:["Train on gold feature table","Log run with MLflow","Register version in Unity Catalog","Move @champion alias","Batch job scores by alias","Monitor predictions and outcomes"],
    why:"Track before you register; register before you alias; consumers read the alias, so moving it is the release step."},
  {type:"concept", title:"Aliases are the release switch", body:"<p>Models in Unity Catalog use <b>aliases</b> instead of the old “Staging/Production” stages. Code loads <code>models:/hal_prod_eu.ml.a2_bearing_failure@champion</code>. To release, you move the alias to a new version; to roll back, you move it back. A batch job picks up the new version on its next run. New versions in Unity Catalog must have a <b>signature</b> (input and output schema), which MLflow infers from an input example.</p>"},
  {type:"mcq", q:"Version 4 of the bearing model misbehaves after release. What is the fastest safe rollback?",
    opts:[{t:"Point @champion back to version 3",ok:true,why:"Right. Consumers load by alias, so nothing else changes."},
          {t:"Delete version 4 and retrain",why:"Slow, and deletes evidence you need to investigate."},
          {t:"Edit every job to load version 3 by number",why:"Works but is slow and error-prone. That is what aliases avoid."},
          {t:"Copy version 3 into a new model name",why:"Breaks every consumer that uses the old name."}]},
  {type:"concept", title:"Batch first, endpoint when a request needs it", body:"<p>Pick the slowest serving pattern that meets the need, the same rule as week 1:</p><ul><li><b>Batch</b>: a scheduled job scores a table with the @champion model. Cheap and simple.</li><li><b>Streaming</b>: score readings as they arrive when alerts need seconds.</li><li><b>Model Serving</b>: a REST endpoint answers one request in milliseconds, for apps that ask one question at a time.</li></ul>", diagram:"serve"},
  {type:"tradeoff", kind:"build", title:"Turn the dials", q:"Maintenance planners review A2 bearing risk at the 07:30 shift handover and plan inspections for the day. Pick a serving pattern.",
    opts:[
      {n:"Model Serving endpoint",m:[95,70,75],verdict:"Millisecond answers that nobody asks for. An always-available endpoint adds cost and operations with no benefit for a daily plan.",ok:false},
      {n:"Nightly batch scoring at 05:00",m:[55,15,20],verdict:"Best fit. Scores are ready before handover, cost is one short job, and the team already runs jobs.",ok:true},
      {n:"Weekly batch scoring",m:[15,10,15],verdict:"Cheapest, but a bearing can degrade within days. Planners would act on stale risk.",ok:false}]},
  {type:"concept", title:"Monitoring basics", body:"<p>A model decays when the world changes. Watch three things:</p><ul><li><b>Input drift</b>: are sensor feature distributions moving?</li><li><b>Prediction drift</b>: is the share of high-risk scores changing?</li><li><b>Accuracy</b>: once real failures are known, were the scores right?</li></ul><p>On Databricks, <b>data quality monitoring</b> (formerly Lakehouse Monitoring) can profile an inference table of inputs and predictions over time.</p>"},
  {type:"mcq", q:"Only ~13% of A2 machines fail within 7 days. A model scores 85% accuracy. Why is that not reassuring?",
    opts:[{t:"Predicting “no failure” for every machine already scores about 87%",ok:true,why:"Right. With rare failures, accuracy flatters. Use AUC, recall on failures and the cost of a missed failure."},
          {t:"85% is always too low for production",why:"There is no universal threshold. The baseline matters."},
          {t:"Accuracy cannot be logged in MLflow",why:"It can. The issue is what it means."},
          {t:"The model must be overfitted",why:"Not necessarily. The metric is the problem."}]},
  {type:"spot", title:"Spot the mistakes", q:"A data scientist’s release note says these things. Tap every wrong one, then check.",
    items:[
      {t:"Jobs load the model by version number so we always know which one runs.",bad:true,ex:"Wrong. Load by alias; the alias records which version is live."},
      {t:"Every registered version has a signature.",bad:false,ex:"True. Unity Catalog requires one."},
      {t:"We gave the scoring job its own copy of the gold features to keep it fast.",bad:true,ex:"Wrong. Read the governed table; copies drift."},
      {t:"We will add a real-time endpoint because the plan is reviewed once a day.",bad:true,ex:"Wrong. Daily use is a batch need."},
      {t:"MLflow runs record parameters, metrics and the model artifact.",bad:false,ex:"True."},
      {t:"Model permissions are granted in Unity Catalog like tables.",bad:false,ex:"True."}]},
  {type:"case", title:"Apply it: Halvorsen Industrial Group", brief:"<p>The A2 compressor line bearing failure cost $1.2M, so A2 is the predictive pilot. Two data scientists will train in the EU dev workspace. Planners need a risk list before the 07:30 shift handover. The goal is −15% unplanned downtime on pilot lines in 12 months.</p>",
    qs:[
      {q:"Where is the production model registered?",opts:[
        {t:"In the EU prod catalog, e.g. hal_prod_eu.ml.a2_bearing_failure, deployed by a service principal",ok:true,why:"Right. The model lives with the EU data it was trained on, under the same governance."},
        {t:"In each data scientist’s home folder",why:"Personal, ungoverned and lost when they leave."},
        {t:"In the NA metastore, which is less busy",why:"A2 is an EU plant; keep the model and its data in the EU."}]},
      {q:"How will you show the CFO the model is worth it?",opts:[
        {t:"Track predicted-vs-actual failures and downtime avoided on A2 against the −15% goal",ok:true,why:"Right. Tie monitoring to the business goal, not just AUC."},
        {t:"Show the AUC from training",why:"A training metric is not a business result."},
        {t:"Count the number of models deployed",why:"Activity, not value."}]}]},
  {type:"boss", title:"Module boss round", q:"8 questions across all of CL01 and ML01. 90 seconds. Score 6 or more to earn the CL01 Cloud Architect badge.",
    qs:[
      {q:"Recommended number of metastores per cloud region?",o:["One","One per workspace","One per plant"],a:0},
      {q:"What blocks a prod catalog from dev even with grants?",o:["Row filters","Workspace-catalog binding","Photon"],a:1},
      {q:"How does serverless reach private ADLS on Azure?",o:["VNet injection","NCC private endpoint rule","Public IP"],a:1},
      {q:"Who should run production jobs?",o:["A service principal","The lead engineer","A shared admin login"],a:0},
      {q:"Which object pairs a credential with one ADLS path?",o:["Volume","Storage credential","External location"],a:2},
      {q:"GCP name for private connectivity?",o:["PrivateLink","Private Service Connect","ExpressRoute"],a:1},
      {q:"How do you roll back a UC model release?",o:["Move the alias back","Delete the version","Rename the model"],a:0},
      {q:"Daily planning list from a model needs…",o:["Model Serving","Batch scoring","Streaming"],a:1}]}
  ]}
];
const FINAL_BADGE = {k:"CL01",n:"CL01 Cloud Architect"};


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
    stage.appendChild(el("p","q",`You scored ${score} of ${order.length}. ${pass?"Badge earned: CL01 Cloud Architect.":"Score 6 or more to earn the badge. Try again."}`));
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
  const head=el("header","head",`<span class="mono eyebrow">CL01 · Lesson ${i+1} of ${LESSONS.length}</span><h1>${L.title}</h1><p class="goal"><b>By the end you can:</b> ${L.goal}</p>
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
